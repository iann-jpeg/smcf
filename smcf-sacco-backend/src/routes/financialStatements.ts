import { Router } from 'express';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import AuditLog from '../models/AuditLog';
import FinancialStatement from '../models/FinancialStatement';
import FinancialStatementAdjustment from '../models/FinancialStatementAdjustment';
import FinancialStatementMapping from '../models/FinancialStatementMapping';
import Transaction from '../models/Transaction';
import Loan from '../models/Loan';
import RepaymentRecord from '../models/RepaymentRecord';
import Member from '../models/Member';
import ShareTransaction from '../models/ShareTransaction';
import ShareContribution from '../models/ShareContribution';
import ShareDividendDistribution, { ShareDividendRecordModel } from '../models/ShareDividendDistribution';
import ReserveFund, { ReserveFundTransactionModel } from '../models/ReserveFund';
import SystemConfig from '../models/SystemConfig';

const router = Router();

type PeriodType = 'monthly' | 'quarterly' | 'yearly' | 'custom';
type StatementType = 'income_statement' | 'balance_sheet' | 'cash_flow_statement';

type PeriodContext = {
  periodType: PeriodType;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
};

type NumericDict = Record<string, number>;
type GenericRecord = Record<string, unknown>;

type QueryInput = Record<string, string | number | undefined | null>;

type TransactionLike = {
  type?: string;
  status?: string;
  amount?: number;
};

type LoanLike = {
  totalPayable?: number;
  totalInterest?: number;
  principal?: number;
  balance?: number;
  status?: string;
};

type RepaymentLike = {
  loanId?: LoanLike;
  amountPaid?: number;
  penaltyAmount?: number;
  amountDue?: number;
  status?: string;
};

type ReserveTransactionLike = {
  transactionType?: 'inflow' | 'outflow' | string;
  status?: string;
  amount?: number;
  source?: string;
  description?: string;
  usageCategory?: string;
};

type ShareTransactionLike = {
  transactionType?: string;
  totalValue?: number;
};

type ShareContributionLike = {
  amount?: number;
};

type MemberLike = {
  shares?: number;
};

type ReserveFundLike = {
  currentBalance?: number;
};

type AdjustmentLike = {
  _id?: unknown;
  lineKey: string;
  amount: number;
};

type StatementComputationResult = {
  lines: NumericDict;
  summary: Record<string, number | boolean>;
  warnings?: string[];
  adjustmentsApplied: AdjustmentLike[];
};

type StatementDataResult = {
  statementType: StatementType;
  period: PeriodContext;
  lines: NumericDict;
  summary: Record<string, number | boolean>;
  comparison: Record<string, unknown>;
  trend: Array<Record<string, unknown>>;
  validation: {
    isValid: boolean;
    warnings: string[];
    requiresOverride: boolean;
  };
  adjustmentsApplied: AdjustmentLike[];
};

const KEYWORDS = {
  investment: ['investment', 'event', 'events', 'real estate', 'rental', 'property', 'venture'],
  staff: ['staff', 'allowance', 'salary', 'commission'],
  rentUtilities: ['rent', 'utility', 'water', 'electric', 'electricity', 'internet', 'office'],
  software: ['hosting', 'sms', 'software', 'system', 'license', 'subscription'],
  transport: ['transport', 'logistics', 'fuel', 'travel'],
  maintenance: ['maintenance', 'repair', 'service'],
  bankCharges: ['bank', 'charge', 'transaction fee', 'fee'],
  assetPurchase: ['asset', 'equipment', 'tent', 'chair', 'electronics', 'purchase', 'capital expenditure'],
};

const DEFAULT_MAPPINGS = [
  {
    sourceType: 'transaction',
    sourceKey: 'loan_repayment',
    incomeLineKey: 'loanInterestIncome',
    balanceSheetLineKey: 'outstandingLoansReceivable',
    cashFlowLineKey: 'loanRepaymentsReceived',
    cashFlowBucket: 'operating',
    direction: 'inflow',
  },
  {
    sourceType: 'transaction',
    sourceKey: 'loan_disbursement',
    incomeLineKey: null,
    balanceSheetLineKey: 'outstandingLoansReceivable',
    cashFlowLineKey: 'loanDisbursements',
    cashFlowBucket: 'financing',
    direction: 'outflow',
  },
  {
    sourceType: 'transaction',
    sourceKey: 'share_purchase',
    incomeLineKey: null,
    balanceSheetLineKey: 'shareCapital',
    cashFlowLineKey: 'shareCapitalContributionsReceived',
    cashFlowBucket: 'financing',
    direction: 'inflow',
  },
  {
    sourceType: 'transaction',
    sourceKey: 'deposit',
    incomeLineKey: null,
    balanceSheetLineKey: 'mobileMoneyWalletBalances',
    cashFlowLineKey: 'memberSavingsDepositsReceived',
    cashFlowBucket: 'operating',
    direction: 'inflow',
  },
  {
    sourceType: 'transaction',
    sourceKey: 'withdrawal',
    incomeLineKey: null,
    balanceSheetLineKey: 'memberWithdrawalsPayable',
    cashFlowLineKey: 'refundsWithdrawalsPaid',
    cashFlowBucket: 'operating',
    direction: 'outflow',
  },
  {
    sourceType: 'transaction',
    sourceKey: 'registration_fee',
    incomeLineKey: 'registrationFees',
    balanceSheetLineKey: 'retainedEarnings',
    cashFlowLineKey: 'registrationFeesReceived',
    cashFlowBucket: 'operating',
    direction: 'inflow',
  },
  {
    sourceType: 'share_transaction',
    sourceKey: 'transfer_out',
    incomeLineKey: 'shareTransferFees',
    balanceSheetLineKey: null,
    cashFlowLineKey: 'otherCashReceipts',
    cashFlowBucket: 'operating',
    direction: 'inflow',
  },
  {
    sourceType: 'reserve_transaction',
    sourceKey: 'inflow',
    incomeLineKey: 'otherOperatingIncome',
    balanceSheetLineKey: 'reserves',
    cashFlowLineKey: 'otherCashReceipts',
    cashFlowBucket: 'operating',
    direction: 'inflow',
  },
  {
    sourceType: 'reserve_transaction',
    sourceKey: 'outflow',
    incomeLineKey: null,
    balanceSheetLineKey: 'unpaidExpenses',
    cashFlowLineKey: 'otherCashPayments',
    cashFlowBucket: 'operating',
    direction: 'outflow',
  },
];

const transactionInflowTypes = new Set(['deposit', 'loan_repayment', 'share_purchase', 'registration_fee', 'savings_interest', 'dividend']);
const transactionOutflowTypes = new Set(['withdrawal', 'loan_disbursement']);

function parseDate(value?: string, fallback?: Date): Date {
  if (!value) return fallback ? new Date(fallback) : new Date();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback ? new Date(fallback) : new Date();
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getQuarter(month: number): number {
  return Math.floor(month / 3) + 1;
}

function buildPeriodContext(query: QueryInput): PeriodContext {
  const periodType = (String(query.periodType || 'monthly').toLowerCase() as PeriodType) || 'monthly';
  const now = new Date();

  if (periodType === 'custom') {
    const startDate = startOfDay(parseDate(String(query.startDate || now.toISOString())));
    const endDate = endOfDay(parseDate(String(query.endDate || now.toISOString())));
    return {
      periodType,
      periodLabel: `${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
      startDate,
      endDate,
    };
  }

  if (periodType === 'yearly') {
    const year = Number(query.year || now.getFullYear());
    const startDate = startOfDay(new Date(year, 0, 1));
    const endDate = endOfDay(new Date(year, 11, 31));
    return { periodType, periodLabel: `${year}`, startDate, endDate };
  }

  if (periodType === 'quarterly') {
    const year = Number(query.year || now.getFullYear());
    const quarter = Number(query.quarter || getQuarter(now.getMonth()));
    const qStartMonth = (Math.max(1, Math.min(4, quarter)) - 1) * 3;
    const startDate = startOfDay(new Date(year, qStartMonth, 1));
    const endDate = endOfDay(new Date(year, qStartMonth + 3, 0));
    return { periodType, periodLabel: `Q${quarter} ${year}`, startDate, endDate };
  }

  // monthly
  const year = Number(query.year || now.getFullYear());
  const month = Number(query.month || now.getMonth() + 1);
  const startDate = startOfDay(new Date(year, Math.max(1, month) - 1, 1));
  const endDate = endOfDay(new Date(year, Math.max(1, month), 0));
  const monthLabel = startDate.toLocaleString('en-KE', { month: 'long', year: 'numeric' });
  return { periodType: 'monthly', periodLabel: monthLabel, startDate, endDate };
}

function buildPreviousPeriodContext(period: PeriodContext): PeriodContext {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  const spanMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs + 1);

  return {
    periodType: period.periodType,
    periodLabel: `${prevStart.toISOString().slice(0, 10)} to ${prevEnd.toISOString().slice(0, 10)}`,
    startDate: startOfDay(prevStart),
    endDate: endOfDay(prevEnd),
  };
}

function textHasKeyword(input: string | null | undefined, keywords: string[]): boolean {
  const text = String(input || '').toLowerCase();
  return keywords.some((kw) => text.includes(kw));
}

function addAmount(dict: NumericDict, key: string, value: number) {
  dict[key] = (dict[key] || 0) + value;
}

function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function ensureDefaultMappings(userId?: string) {
  const existing = await FinancialStatementMapping.countDocuments();
  if (existing > 0) return;

  await FinancialStatementMapping.insertMany(
    DEFAULT_MAPPINGS.map((m) => ({
      ...m,
      updatedBy: userId || null,
      updatedAt: new Date(),
      isActive: true,
    }))
  );
}

async function getApprovedAdjustments(period: PeriodContext, statementType: StatementType) {
  return FinancialStatementAdjustment.find({
    status: 'approved',
    startDate: { $gte: period.startDate },
    endDate: { $lte: period.endDate },
    targetStatement: { $in: [statementType, 'all'] },
  }).sort({ createdAt: -1 });
}

function applyAdjustments(baseLines: NumericDict, adjustments: Array<{ lineKey: string; amount: number }>) {
  const lines = { ...baseLines };
  for (const adj of adjustments) {
    addAmount(lines, adj.lineKey, Number(adj.amount || 0));
  }
  return lines;
}

async function computeIncomeStatement(period: PeriodContext) {
  const [transactions, repayments, loansInPeriod, reserveTx, shareTx, config, adjustments] = await Promise.all([
    Transaction.find({
      status: 'completed',
      processedAt: { $gte: period.startDate, $lte: period.endDate },
    }).lean(),
    RepaymentRecord.find({
      paidDate: { $gte: period.startDate, $lte: period.endDate },
      status: { $in: ['paid', 'partial'] },
    }).populate('loanId').lean(),
    Loan.find({
      $or: [
        { approvedAt: { $gte: period.startDate, $lte: period.endDate } },
        { disbursedDate: { $gte: period.startDate, $lte: period.endDate } },
      ],
    }).lean(),
    ReserveFundTransactionModel.find({
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: { $in: ['completed', 'approved'] },
    }).lean(),
    ShareTransaction.find({
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: 'approved',
    }).lean(),
    SystemConfig.getConfig(),
    getApprovedAdjustments(period, 'income_statement'),
  ]);

  const lines: NumericDict = {
    loanInterestIncome: 0,
    penaltyIncome: 0,
    loanProcessingFees: 0,
    registrationFees: 0,
    shareTransferFees: 0,
    investmentIncome: 0,
    otherOperatingIncome: 0,
    operationalExpenses: 0,
    staffAllowancesCommissions: 0,
    rentUtilitiesOfficeExpenses: 0,
    systemHostingSmsSoftwareCosts: 0,
    transportLogisticsCosts: 0,
    maintenanceCosts: 0,
    bankTransactionCharges: 0,
    investmentOperatingExpenses: 0,
    badDebtExpenseProvision: 0,
    otherApprovedExpenses: 0,
  };

  for (const repayment of repayments as RepaymentLike[]) {
    const loan = repayment.loanId;
    const totalPayable = Number(loan?.totalPayable || 0);
    const totalInterest = Number(loan?.totalInterest || 0);
    const paidAmount = Number(repayment.amountPaid || 0);
    const estimatedInterest = totalPayable > 0 ? (paidAmount / totalPayable) * totalInterest : 0;
    lines.loanInterestIncome += Math.max(0, estimatedInterest);
    lines.penaltyIncome += Number(repayment.penaltyAmount || 0);
  }

  const processingFeeRate = Number(config?.processingFee || 0) / 100;
  for (const loan of loansInPeriod as LoanLike[]) {
    lines.loanProcessingFees += Number(loan.principal || 0) * processingFeeRate;
  }

  for (const txn of transactions as TransactionLike[]) {
    if (txn.type === 'registration_fee') lines.registrationFees += Number(txn.amount || 0);
  }

  for (const st of shareTx as ShareTransactionLike[]) {
    if (st.transactionType === 'transfer_out') {
      const possibleFee = Math.max(0, Number(st.totalValue || 0) * 0.01);
      lines.shareTransferFees += possibleFee;
    }
  }

  for (const rt of reserveTx as ReserveTransactionLike[]) {
    const amount = Number(rt.amount || 0);
    const descriptor = `${rt.source || ''} ${rt.description || ''} ${rt.usageCategory || ''}`;

    if (rt.transactionType === 'inflow') {
      if (textHasKeyword(descriptor, KEYWORDS.investment)) {
        lines.investmentIncome += amount;
      } else {
        lines.otherOperatingIncome += amount;
      }
      continue;
    }

    if (textHasKeyword(descriptor, KEYWORDS.staff)) {
      lines.staffAllowancesCommissions += amount;
    } else if (textHasKeyword(descriptor, KEYWORDS.rentUtilities)) {
      lines.rentUtilitiesOfficeExpenses += amount;
    } else if (textHasKeyword(descriptor, KEYWORDS.software)) {
      lines.systemHostingSmsSoftwareCosts += amount;
    } else if (textHasKeyword(descriptor, KEYWORDS.transport)) {
      lines.transportLogisticsCosts += amount;
    } else if (textHasKeyword(descriptor, KEYWORDS.maintenance)) {
      lines.maintenanceCosts += amount;
    } else if (textHasKeyword(descriptor, KEYWORDS.bankCharges)) {
      lines.bankTransactionCharges += amount;
    } else if (textHasKeyword(descriptor, KEYWORDS.investment)) {
      lines.investmentOperatingExpenses += amount;
    } else {
      lines.operationalExpenses += amount;
    }
  }

  const defaultedLoans = await Loan.find({
    status: 'defaulted',
    updatedAt: { $gte: period.startDate, $lte: period.endDate },
  }).lean();
  lines.badDebtExpenseProvision = defaultedLoans.reduce((sum: number, loan) => sum + Number((loan as LoanLike).balance || 0) * 0.05, 0);

  const adjustedLines = applyAdjustments(lines, (adjustments as AdjustmentLike[]).map((a) => ({ lineKey: a.lineKey, amount: a.amount })));

  const totalIncome =
    adjustedLines.loanInterestIncome +
    adjustedLines.penaltyIncome +
    adjustedLines.loanProcessingFees +
    adjustedLines.registrationFees +
    adjustedLines.shareTransferFees +
    adjustedLines.investmentIncome +
    adjustedLines.otherOperatingIncome;

  const totalExpenses =
    adjustedLines.operationalExpenses +
    adjustedLines.staffAllowancesCommissions +
    adjustedLines.rentUtilitiesOfficeExpenses +
    adjustedLines.systemHostingSmsSoftwareCosts +
    adjustedLines.transportLogisticsCosts +
    adjustedLines.maintenanceCosts +
    adjustedLines.bankTransactionCharges +
    adjustedLines.investmentOperatingExpenses +
    adjustedLines.badDebtExpenseProvision +
    adjustedLines.otherApprovedExpenses;

  const netProfitOrLoss = totalIncome - totalExpenses;

  return {
    lines: Object.fromEntries(Object.entries(adjustedLines).map(([k, v]) => [k, round2(v)])),
    summary: {
      totalIncome: round2(totalIncome),
      totalExpenses: round2(totalExpenses),
      netProfitOrLoss: round2(netProfitOrLoss),
    },
    adjustmentsApplied: adjustments,
  };
}

async function computeBalanceSheet(period: PeriodContext) {
  const [incomeStatement, loans, members, reserveFund, reserveTx, transactions, repayments, adjustments] = await Promise.all([
    computeIncomeStatement(period),
    Loan.find({
      status: { $in: ['approved', 'disbursed', 'active', 'pending', 'defaulted', 'completed'] },
      createdAt: { $lte: period.endDate },
    }).lean(),
    Member.find({ createdAt: { $lte: period.endDate } }).lean(),
    ReserveFund.findOne().lean(),
    ReserveFundTransactionModel.find({
      status: { $in: ['pending', 'approved', 'completed'] },
      createdAt: { $lte: period.endDate },
    }).lean(),
    Transaction.find({
      status: { $in: ['completed', 'pending'] },
      processedAt: { $lte: period.endDate },
    }).lean(),
    RepaymentRecord.find({ dueDate: { $lte: period.endDate } }).lean(),
    getApprovedAdjustments(period, 'balance_sheet'),
  ]);

  const cashIn = (transactions as TransactionLike[])
    .filter((t) => t.status === 'completed' && transactionInflowTypes.has(t.type))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const cashOut = (transactions as TransactionLike[])
    .filter((t) => t.status === 'completed' && transactionOutflowTypes.has(t.type))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const reserveNet = (reserveTx as ReserveTransactionLike[])
    .filter((r) => ['completed', 'approved'].includes(String(r.status || '')))
    .reduce((sum, r) => sum + (r.transactionType === 'inflow' ? Number(r.amount || 0) : -Number(r.amount || 0)), 0);

  const mobileWalletBalance = cashIn - cashOut + reserveNet;

  const outstandingLoansReceivable = (loans as LoanLike[])
    .filter((l) => ['approved', 'disbursed', 'active', 'defaulted'].includes(String(l.status)))
    .reduce((sum, l) => sum + Number(l.balance || 0), 0);

  const receivables = (repayments as RepaymentLike[])
    .filter((r) => ['pending', 'partial', 'overdue'].includes(String(r.status)))
    .reduce((sum, r) => sum + Math.max(0, Number(r.amountDue || 0) - Number(r.amountPaid || 0)), 0);

  const accruedInterestReceivable = (loans as LoanLike[]).reduce((sum, loan) => {
    const totalInterest = Number(loan.totalInterest || 0);
    const totalPayable = Number(loan.totalPayable || 0);
    const balance = Number(loan.balance || 0);
    if (totalPayable <= 0) return sum;
    const paidRatio = Math.max(0, Math.min(1, (totalPayable - balance) / totalPayable));
    const interestCollected = totalInterest * paidRatio;
    return sum + Math.max(0, totalInterest - interestCollected);
  }, 0);

  const pendingWithdrawals = (transactions as TransactionLike[])
    .filter((t) => t.type === 'withdrawal' && t.status === 'pending')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const pendingReserveOutflows = (reserveTx as ReserveTransactionLike[])
    .filter((r) => r.transactionType === 'outflow' && r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const shareCapital = (members as MemberLike[]).reduce((sum, m) => sum + Number(m.shares || 0), 0);

  const previousPeriod = buildPreviousPeriodContext(period);
  const retainedEarningsStatement = await computeIncomeStatement(previousPeriod);
  const retainedEarnings = Number(retainedEarningsStatement.summary.netProfitOrLoss || 0);
  const currentPeriodProfitLoss = Number(incomeStatement.summary.netProfitOrLoss || 0);

  const reserveBalance = Number((reserveFund as ReserveFundLike | null)?.currentBalance || 0);

  const lines: NumericDict = {
    cashOnHand: 0,
    bankBalances: 0,
    mobileMoneyWalletBalances: mobileWalletBalance,
    receivables,
    outstandingLoansReceivable,
    accruedInterestReceivable,
    shortTermInvestments: 0,
    equipmentAssets: 0,
    realEstateAssets: 0,
    landBuildingsAssets: 0,
    otherLongTermAssets: 0,
    memberWithdrawalsPayable: pendingWithdrawals,
    unpaidExpenses: pendingReserveOutflows,
    shortTermObligations: pendingReserveOutflows,
    pendingRefunds: pendingWithdrawals,
    externalBorrowings: 0,
    longTermPayables: 0,
    otherLiabilities: 0,
    shareCapital,
    retainedEarnings,
    currentPeriodProfitLoss,
    reserves: reserveBalance,
    otherEquityBalances: 0,
  };

  const adjustedLines = applyAdjustments(lines, (adjustments as AdjustmentLike[]).map((a) => ({ lineKey: a.lineKey, amount: a.amount })));

  const totalAssets =
    adjustedLines.cashOnHand +
    adjustedLines.bankBalances +
    adjustedLines.mobileMoneyWalletBalances +
    adjustedLines.receivables +
    adjustedLines.outstandingLoansReceivable +
    adjustedLines.accruedInterestReceivable +
    adjustedLines.shortTermInvestments +
    adjustedLines.equipmentAssets +
    adjustedLines.realEstateAssets +
    adjustedLines.landBuildingsAssets +
    adjustedLines.otherLongTermAssets;

  const totalLiabilities =
    adjustedLines.memberWithdrawalsPayable +
    adjustedLines.unpaidExpenses +
    adjustedLines.shortTermObligations +
    adjustedLines.pendingRefunds +
    adjustedLines.externalBorrowings +
    adjustedLines.longTermPayables +
    adjustedLines.otherLiabilities;

  const totalEquity =
    adjustedLines.shareCapital +
    adjustedLines.retainedEarnings +
    adjustedLines.currentPeriodProfitLoss +
    adjustedLines.reserves +
    adjustedLines.otherEquityBalances;

  const balanceDelta = round2(totalAssets - (totalLiabilities + totalEquity));

  const warnings: string[] = [];
  if (Math.abs(balanceDelta) > 0.01) {
    warnings.push(`Balance Sheet does not balance. Delta: KES ${balanceDelta.toLocaleString()}`);
  }

  return {
    lines: Object.fromEntries(Object.entries(adjustedLines).map(([k, v]) => [k, round2(v)])),
    summary: {
      totalAssets: round2(totalAssets),
      totalLiabilities: round2(totalLiabilities),
      totalEquity: round2(totalEquity),
      balanceDelta,
      isBalanced: Math.abs(balanceDelta) <= 0.01,
    },
    warnings,
    adjustmentsApplied: adjustments,
  };
}

async function computeCashFlow(period: PeriodContext) {
  const [transactionsInPeriod, reserveTxInPeriod, shareContributions, incomeStatement, balanceSheet, adjustments] = await Promise.all([
    Transaction.find({
      status: 'completed',
      processedAt: { $gte: period.startDate, $lte: period.endDate },
    }).lean(),
    ReserveFundTransactionModel.find({
      status: { $in: ['completed', 'approved'] },
      createdAt: { $gte: period.startDate, $lte: period.endDate },
    }).lean(),
    ShareContribution.find({
      status: 'approved',
      contributionDate: { $gte: period.startDate, $lte: period.endDate },
    }).lean(),
    computeIncomeStatement(period),
    computeBalanceSheet(period),
    getApprovedAdjustments(period, 'cash_flow_statement'),
  ]);

  const allTransactionsBeforeStart = await Transaction.find({
    status: 'completed',
    processedAt: { $lt: period.startDate },
  }).lean();

  const allReserveBeforeStart = await ReserveFundTransactionModel.find({
    status: { $in: ['completed', 'approved'] },
    createdAt: { $lt: period.startDate },
  }).lean();

  const openingFromTransactions = (allTransactionsBeforeStart as TransactionLike[]).reduce((sum, t) => {
    const amount = Number(t.amount || 0);
    if (transactionInflowTypes.has(t.type)) return sum + amount;
    if (transactionOutflowTypes.has(t.type)) return sum - Math.abs(amount);
    return sum;
  }, 0);

  const openingFromReserve = (allReserveBeforeStart as ReserveTransactionLike[]).reduce((sum, r) => {
    const amount = Number(r.amount || 0);
    return r.transactionType === 'inflow' ? sum + amount : sum - amount;
  }, 0);

  const openingCashBalance = openingFromTransactions + openingFromReserve;

  const lines: NumericDict = {
    memberSavingsDepositsReceived: 0,
    loanRepaymentsReceived: 0,
    loanInterestReceived: Number(incomeStatement.lines.loanInterestIncome || 0),
    shareCapitalContributionsReceived: 0,
    registrationFeesReceived: 0,
    investmentIncomeReceived: Number(incomeStatement.lines.investmentIncome || 0),
    otherCashReceipts: Number(incomeStatement.lines.otherOperatingIncome || 0),
    loanDisbursements: 0,
    refundsWithdrawalsPaid: 0,
    operatingExpensesPaid: 0,
    assetPurchases: 0,
    investmentProjectFunding: 0,
    rentSalariesTransportUtilitiesPaid: 0,
    bankTransactionChargesPaid: 0,
    otherCashPayments: 0,
  };

  for (const txn of transactionsInPeriod as TransactionLike[]) {
    const amount = Math.abs(Number(txn.amount || 0));
    if (txn.type === 'deposit') lines.memberSavingsDepositsReceived += amount;
    else if (txn.type === 'loan_repayment') lines.loanRepaymentsReceived += amount;
    else if (txn.type === 'share_purchase') lines.shareCapitalContributionsReceived += amount;
    else if (txn.type === 'registration_fee') lines.registrationFeesReceived += amount;
    else if (txn.type === 'loan_disbursement') lines.loanDisbursements += amount;
    else if (txn.type === 'withdrawal') lines.refundsWithdrawalsPaid += amount;
  }

  lines.shareCapitalContributionsReceived += (shareContributions as ShareContributionLike[]).reduce((sum, s) => sum + Number(s.amount || 0), 0);

  for (const rt of reserveTxInPeriod as ReserveTransactionLike[]) {
    const amount = Number(rt.amount || 0);
    const descriptor = `${rt.source || ''} ${rt.description || ''} ${rt.usageCategory || ''}`;

    if (rt.transactionType === 'inflow') {
      if (textHasKeyword(descriptor, KEYWORDS.investment)) lines.investmentIncomeReceived += amount;
      else lines.otherCashReceipts += amount;
      continue;
    }

    if (textHasKeyword(descriptor, KEYWORDS.assetPurchase)) lines.assetPurchases += amount;
    else if (textHasKeyword(descriptor, KEYWORDS.investment)) lines.investmentProjectFunding += amount;
    else if (textHasKeyword(descriptor, KEYWORDS.rentUtilities) || textHasKeyword(descriptor, KEYWORDS.staff) || textHasKeyword(descriptor, KEYWORDS.transport)) {
      lines.rentSalariesTransportUtilitiesPaid += amount;
    } else if (textHasKeyword(descriptor, KEYWORDS.bankCharges)) {
      lines.bankTransactionChargesPaid += amount;
    } else {
      lines.operatingExpensesPaid += amount;
    }
  }

  const adjustedLines = applyAdjustments(lines, (adjustments as AdjustmentLike[]).map((a) => ({ lineKey: a.lineKey, amount: a.amount })));

  const operatingInflows =
    adjustedLines.memberSavingsDepositsReceived +
    adjustedLines.loanRepaymentsReceived +
    adjustedLines.loanInterestReceived +
    adjustedLines.registrationFeesReceived +
    adjustedLines.otherCashReceipts;

  const operatingOutflows =
    adjustedLines.refundsWithdrawalsPaid +
    adjustedLines.operatingExpensesPaid +
    adjustedLines.rentSalariesTransportUtilitiesPaid +
    adjustedLines.bankTransactionChargesPaid +
    adjustedLines.otherCashPayments;

  const netCashFromOperatingActivities = operatingInflows - operatingOutflows;

  const netCashFromInvestingActivities =
    adjustedLines.investmentIncomeReceived - adjustedLines.assetPurchases - adjustedLines.investmentProjectFunding;

  const netCashFromFinancingActivities =
    adjustedLines.shareCapitalContributionsReceived - adjustedLines.loanDisbursements;

  const netIncreaseDecreaseInCash =
    netCashFromOperatingActivities + netCashFromInvestingActivities + netCashFromFinancingActivities;

  const closingCashBalance = openingCashBalance + netIncreaseDecreaseInCash;

  const actualCashBalanceAtEnd =
    Number(balanceSheet.lines.mobileMoneyWalletBalances || 0) +
    Number(balanceSheet.lines.cashOnHand || 0) +
    Number(balanceSheet.lines.bankBalances || 0);

  const reconciliationDelta = round2(closingCashBalance - actualCashBalanceAtEnd);
  const warnings: string[] = [];
  if (Math.abs(reconciliationDelta) > 0.01) {
    warnings.push(`Cash flow closing balance does not reconcile with system cash balances. Delta: KES ${reconciliationDelta.toLocaleString()}`);
  }

  return {
    lines: Object.fromEntries(Object.entries(adjustedLines).map(([k, v]) => [k, round2(v)])),
    summary: {
      openingCashBalance: round2(openingCashBalance),
      netCashFromOperatingActivities: round2(netCashFromOperatingActivities),
      netCashFromInvestingActivities: round2(netCashFromInvestingActivities),
      netCashFromFinancingActivities: round2(netCashFromFinancingActivities),
      netIncreaseDecreaseInCash: round2(netIncreaseDecreaseInCash),
      closingCashBalance: round2(closingCashBalance),
      actualCashBalanceAtEnd: round2(actualCashBalanceAtEnd),
      reconciliationDelta,
      reconciled: Math.abs(reconciliationDelta) <= 0.01,
    },
    warnings,
    adjustmentsApplied: adjustments,
  };
}

async function computeStatementByType(statementType: StatementType, period: PeriodContext): Promise<StatementComputationResult> {
  if (statementType === 'income_statement') return computeIncomeStatement(period);
  if (statementType === 'balance_sheet') return computeBalanceSheet(period);
  return computeCashFlow(period);
}

async function computeTrend(statementType: StatementType, period: PeriodContext): Promise<Array<Record<string, unknown>>> {
  const points: Array<Record<string, unknown>> = [];
  const cursor = new Date(period.startDate);

  for (let i = 0; i < 6; i += 1) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth() - (5 - i), 1);
    const monthEnd = endOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
    const ctx: PeriodContext = {
      periodType: 'monthly',
      periodLabel: monthStart.toLocaleString('en-KE', { month: 'short', year: 'numeric' }),
      startDate: startOfDay(monthStart),
      endDate: monthEnd,
    };

    const data = await computeStatementByType(statementType, ctx);

    if (statementType === 'income_statement') {
      points.push({ label: ctx.periodLabel, totalIncome: data.summary.totalIncome, totalExpenses: data.summary.totalExpenses, netProfitOrLoss: data.summary.netProfitOrLoss });
    } else if (statementType === 'balance_sheet') {
      points.push({ label: ctx.periodLabel, totalAssets: data.summary.totalAssets, totalLiabilities: data.summary.totalLiabilities, totalEquity: data.summary.totalEquity, balanceDelta: data.summary.balanceDelta });
    } else {
      points.push({ label: ctx.periodLabel, openingCashBalance: data.summary.openingCashBalance, closingCashBalance: data.summary.closingCashBalance, netIncreaseDecreaseInCash: data.summary.netIncreaseDecreaseInCash });
    }
  }

  return points;
}

async function computeComparison(statementType: StatementType, period: PeriodContext): Promise<Record<string, unknown>> {
  const prev = buildPreviousPeriodContext(period);
  const previousData = await computeStatementByType(statementType, prev);

  if (statementType === 'income_statement') {
    return {
      previousPeriod: prev,
      previous: previousData.summary,
      variance: {
        totalIncome: round2((previousData.summary.totalIncome || 0) === 0 ? 0 : 0),
        netProfitOrLossDelta: round2(Number(previousData.summary.netProfitOrLoss || 0)),
      },
    };
  }

  if (statementType === 'balance_sheet') {
    return {
      previousPeriod: prev,
      previous: previousData.summary,
      variance: {
        totalAssetsDelta: round2(Number(previousData.summary.totalAssets || 0)),
        totalLiabilitiesDelta: round2(Number(previousData.summary.totalLiabilities || 0)),
        totalEquityDelta: round2(Number(previousData.summary.totalEquity || 0)),
      },
    };
  }

  return {
    previousPeriod: prev,
    previous: previousData.summary,
    variance: {
      closingCashDelta: round2(Number(previousData.summary.closingCashBalance || 0)),
      operatingCashDelta: round2(Number(previousData.summary.netCashFromOperatingActivities || 0)),
    },
  };
}

async function computeAllStatementData(statementType: StatementType, period: PeriodContext): Promise<StatementDataResult> {
  const [statementData, comparison, trend] = await Promise.all([
    computeStatementByType(statementType, period),
    computeComparison(statementType, period),
    computeTrend(statementType, period),
  ]);

  const warnings = [...(statementData.warnings || [])];

  return {
    statementType,
    period,
    lines: statementData.lines,
    summary: statementData.summary,
    comparison,
    trend,
    validation: {
      isValid: warnings.length === 0,
      warnings,
      requiresOverride: warnings.length > 0,
    },
    adjustmentsApplied: statementData.adjustmentsApplied,
  };
}

function assertStatementType(type: string): StatementType {
  const normalized = String(type || '').toLowerCase();
  if (!['income_statement', 'balance_sheet', 'cash_flow_statement'].includes(normalized)) {
    throw new Error('Invalid statement type');
  }
  return normalized as StatementType;
}

async function writeAudit(req: AuthRequest, action: string, changes: GenericRecord) {
  await AuditLog.create({
    userId: req.userId || null,
    tableName: 'financial_statements',
    recordId: changes?.recordId ? String(changes.recordId) : null,
    action,
    changes,
    ipAddress: req.ip || null,
  });
}

router.use(protect, authorize('admin', 'credit_officer', 'treasurer', 'auditor'));

// GET /api/financial-statements/overview
router.get('/overview', async (req: AuthRequest, res, next) => {
  try {
    await ensureDefaultMappings(req.userId);
    const period = buildPeriodContext(req.query as QueryInput);

    const [income, balance, cash, historyCount] = await Promise.all([
      computeAllStatementData('income_statement', period),
      computeAllStatementData('balance_sheet', period),
      computeAllStatementData('cash_flow_statement', period),
      FinancialStatement.countDocuments(),
    ]);

    const overview = {
      period,
      netProfitOrLoss: income.summary.netProfitOrLoss,
      totalAssets: balance.summary.totalAssets,
      totalLiabilities: balance.summary.totalLiabilities,
      totalEquity: balance.summary.totalEquity,
      openingCashBalance: cash.summary.openingCashBalance,
      closingCashBalance: cash.summary.closingCashBalance,
      cashMovementSummary: cash.summary.netIncreaseDecreaseInCash,
      statementStatus: {
        income: income.validation.isValid ? 'valid' : 'warning',
        balance: balance.validation.isValid ? 'valid' : 'warning',
        cash: cash.validation.isValid ? 'valid' : 'warning',
      },
      generatedAt: new Date(),
      historyCount,
    };

    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-statements/report-pack/preview
router.get('/report-pack/preview', async (req: AuthRequest, res, next) => {
  try {
    const period = buildPeriodContext(req.query as QueryInput);
    const [income, balance, cash] = await Promise.all([
      computeAllStatementData('income_statement', period),
      computeAllStatementData('balance_sheet', period),
      computeAllStatementData('cash_flow_statement', period),
    ]);

    const warnings = [
      ...income.validation.warnings,
      ...balance.validation.warnings,
      ...cash.validation.warnings,
    ];

    res.json({
      success: true,
      data: {
        period,
        income,
        balance,
        cash,
        validation: {
          isValid: warnings.length === 0,
          warnings,
          requiresOverride: warnings.length > 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-statements/:statementType/preview
router.get('/:statementType/preview', async (req: AuthRequest, res, next) => {
  try {
    await ensureDefaultMappings(req.userId);
    const statementType = assertStatementType(req.params.statementType);
    const period = buildPeriodContext(req.query as QueryInput);
    const data = await computeAllStatementData(statementType, period);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-statements/:statementType/generate
router.post('/:statementType/generate', async (req: AuthRequest, res, next) => {
  try {
    const statementType = assertStatementType(req.params.statementType);
    const period = buildPeriodContext({ ...(req.body || {}), ...(req.query || {}) });

    const allowOverride = Boolean(req.body?.allowOverride);
    const allowVersioning = Boolean(req.body?.allowVersioning);
    const notesToAccounts = typeof req.body?.notesToAccounts === 'string' ? req.body.notesToAccounts.trim() || null : null;

    const computed = await computeAllStatementData(statementType, period);

    if (!computed.validation.isValid && !allowOverride) {
      return res.status(400).json({
        success: false,
        message: 'Statement validation failed. Provide allowOverride=true if authorized.',
        data: computed,
      });
    }

    const lockedExisting = await FinancialStatement.findOne({
      statementType,
      periodLabel: period.periodLabel,
      status: 'locked',
    });

    if (lockedExisting && !allowVersioning) {
      return res.status(409).json({
        success: false,
        message: `A locked ${statementType} statement already exists for this period. Enable versioning to generate another version.`,
      });
    }

    const latestVersion = await FinancialStatement.findOne({
      statementType,
      periodLabel: period.periodLabel,
    }).sort({ version: -1 });

    const version = latestVersion ? Number(latestVersion.version || 1) + 1 : 1;

    const statement = await FinancialStatement.create({
      statementType,
      periodType: period.periodType,
      periodLabel: period.periodLabel,
      startDate: period.startDate,
      endDate: period.endDate,
      version,
      status: 'draft',
      isValid: computed.validation.isValid,
      validationWarnings: computed.validation.warnings,
      overrideUsed: !computed.validation.isValid && allowOverride,
      generatedBy: req.userId,
      generatedAt: new Date(),
      notesToAccounts,
      lines: computed.lines,
      summary: computed.summary,
      comparison: computed.comparison,
      trend: computed.trend,
      adjustmentsApplied: computed.adjustmentsApplied.map((a) => a._id),
      pdfMeta: {
        fileName: `${statementType}-${period.startDate.toISOString().slice(0, 10)}-${period.endDate.toISOString().slice(0, 10)}-v${version}.pdf`,
        generatedAt: new Date(),
      },
    });

    await writeAudit(req, 'statement_generate', {
      recordId: statement._id,
      statementType,
      periodLabel: period.periodLabel,
      version,
      overrideUsed: statement.overrideUsed,
    });

    res.status(201).json({ success: true, data: statement });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-statements/history
router.get('/history/list', async (req: AuthRequest, res, next) => {
  try {
    const statementType = req.query.statementType ? assertStatementType(String(req.query.statementType)) : null;
    const periodLabel = String(req.query.periodLabel || '').trim();
    const status = String(req.query.status || '').trim();

    const filter: Record<string, unknown> = {};
    if (statementType) filter.statementType = statementType;
    if (periodLabel) filter.periodLabel = periodLabel;
    if (status) filter.status = status;

    const rows = await FinancialStatement.find(filter)
      .populate('generatedBy', 'email fullName roles')
      .populate('approvedBy', 'email fullName roles')
      .populate('lockedBy', 'email fullName roles')
      .sort({ generatedAt: -1 })
      .limit(300);

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-statements/history/:id
router.get('/history/:id', async (req: AuthRequest, res, next) => {
  try {
    const row = await FinancialStatement.findById(req.params.id)
      .populate('generatedBy', 'email fullName roles')
      .populate('approvedBy', 'email fullName roles')
      .populate('lockedBy', 'email fullName roles')
      .populate('adjustmentsApplied');

    if (!row) return res.status(404).json({ success: false, message: 'Statement not found' });
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/financial-statements/history/:id/approve
router.patch('/history/:id/approve', authorize('admin', 'treasurer', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const row = await FinancialStatement.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Statement not found' });

    row.status = row.status === 'locked' ? 'locked' : 'approved';
    row.approvedAt = new Date();
    row.approvedBy = req.userId ? (req.userId as unknown as typeof row.approvedBy) : null;
    await row.save();

    await writeAudit(req, 'statement_approve', {
      recordId: row._id,
      statementType: row.statementType,
      periodLabel: row.periodLabel,
      version: row.version,
    });

    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/financial-statements/history/:id/lock
router.patch('/history/:id/lock', authorize('admin', 'treasurer', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const row = await FinancialStatement.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Statement not found' });

    const duplicateLock = await FinancialStatement.findOne({
      _id: { $ne: row._id },
      statementType: row.statementType,
      periodLabel: row.periodLabel,
      status: 'locked',
    });

    if (duplicateLock) {
      return res.status(409).json({ success: false, message: 'Another locked statement exists for this type and period.' });
    }

    row.status = 'locked';
    row.lockedAt = new Date();
    row.lockedBy = req.userId ? (req.userId as unknown as typeof row.lockedBy) : null;
    await row.save();

    await writeAudit(req, 'statement_lock', {
      recordId: row._id,
      statementType: row.statementType,
      periodLabel: row.periodLabel,
      version: row.version,
    });

    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/financial-statements/history/:id/unlock
router.patch('/history/:id/unlock', authorize('admin'), async (req: AuthRequest, res, next) => {
  try {
    const row = await FinancialStatement.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Statement not found' });

    row.status = row.approvedBy ? 'approved' : 'draft';
    row.lockedAt = null;
    row.lockedBy = null;
    await row.save();

    await writeAudit(req, 'statement_unlock', {
      recordId: row._id,
      statementType: row.statementType,
      periodLabel: row.periodLabel,
      version: row.version,
    });

    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-statements/adjustments
router.get('/adjustments/list', async (req: AuthRequest, res, next) => {
  try {
    const periodLabel = String(req.query.periodLabel || '').trim();
    const targetStatement = String(req.query.targetStatement || '').trim();
    const status = String(req.query.status || '').trim();

    const filter: Record<string, unknown> = {};
    if (periodLabel) filter.periodLabel = periodLabel;
    if (targetStatement) filter.targetStatement = targetStatement;
    if (status) filter.status = status;

    const rows = await FinancialStatementAdjustment.find(filter)
      .populate('createdBy', 'email fullName roles')
      .populate('approvedBy', 'email fullName roles')
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-statements/adjustments
router.post('/adjustments', authorize('admin', 'treasurer'), async (req: AuthRequest, res, next) => {
  try {
    const period = buildPeriodContext(req.body || {});
    const targetStatement = String(req.body?.targetStatement || 'all');
    const lineKey = String(req.body?.lineKey || '').trim();
    const category = String(req.body?.category || lineKey || 'adjustment').trim();
    const note = String(req.body?.note || '').trim();
    const amount = Number(req.body?.amount || 0);

    if (!lineKey) return res.status(400).json({ success: false, message: 'lineKey is required' });
    if (!note) return res.status(400).json({ success: false, message: 'note is required' });
    if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ success: false, message: 'amount must be non-zero' });

    const status = req.user?.roles?.includes('admin') ? 'approved' : 'pending';

    const row = await FinancialStatementAdjustment.create({
      targetStatement,
      periodLabel: period.periodLabel,
      startDate: period.startDate,
      endDate: period.endDate,
      lineKey,
      category,
      amount,
      note,
      status,
      createdBy: req.userId,
      approvedBy: status === 'approved' ? req.userId : null,
      approvedAt: status === 'approved' ? new Date() : null,
    });

    await writeAudit(req, 'statement_adjustment_add', {
      recordId: row._id,
      targetStatement,
      periodLabel: period.periodLabel,
      lineKey,
      amount,
      status,
    });

    res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/financial-statements/adjustments/:id/approve
router.patch('/adjustments/:id/approve', authorize('admin', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const row = await FinancialStatementAdjustment.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Adjustment not found' });

    row.status = 'approved';
    row.approvedBy = req.userId ? (req.userId as unknown as typeof row.approvedBy) : null;
    row.approvedAt = new Date();
    await row.save();

    await writeAudit(req, 'statement_adjustment_approve', {
      recordId: row._id,
      lineKey: row.lineKey,
      amount: row.amount,
      periodLabel: row.periodLabel,
    });

    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/financial-statements/adjustments/:id/reject
router.patch('/adjustments/:id/reject', authorize('admin', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const row = await FinancialStatementAdjustment.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Adjustment not found' });

    row.status = 'rejected';
    row.approvedBy = req.userId ? (req.userId as unknown as typeof row.approvedBy) : null;
    row.approvedAt = new Date();
    await row.save();

    await writeAudit(req, 'statement_adjustment_reject', {
      recordId: row._id,
      lineKey: row.lineKey,
      amount: row.amount,
      periodLabel: row.periodLabel,
    });

    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-statements/mappings
router.get('/mappings/list', async (req: AuthRequest, res, next) => {
  try {
    await ensureDefaultMappings(req.userId);
    const rows = await FinancialStatementMapping.find().sort({ sourceType: 1, sourceKey: 1 });

    // Detect missing mappings from known source categories
    const existingKeys = new Set(rows.map((r) => `${r.sourceType}:${r.sourceKey}`));
    const required = [
      'transaction:deposit',
      'transaction:withdrawal',
      'transaction:loan_disbursement',
      'transaction:loan_repayment',
      'transaction:share_purchase',
      'transaction:registration_fee',
      'share_transaction:transfer_out',
      'reserve_transaction:inflow',
      'reserve_transaction:outflow',
    ];
    const missing = required.filter((key) => !existingKeys.has(key));

    res.json({ success: true, data: { mappings: rows, missing } });
  } catch (error) {
    next(error);
  }
});

// PUT /api/financial-statements/mappings
router.put('/mappings', authorize('admin', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const updates = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'mappings array is required' });
    }

    const bulkOps = updates
      .filter((m: GenericRecord) => m && m.sourceType && m.sourceKey)
      .map((m: GenericRecord) => ({
        updateOne: {
          filter: { sourceType: String(m.sourceType), sourceKey: String(m.sourceKey) },
          update: {
            $set: {
              incomeLineKey: m.incomeLineKey ?? null,
              balanceSheetLineKey: m.balanceSheetLineKey ?? null,
              cashFlowLineKey: m.cashFlowLineKey ?? null,
              cashFlowBucket: m.cashFlowBucket ?? null,
              direction: m.direction ?? 'neutral',
              isActive: m.isActive !== false,
              updatedBy: req.userId,
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

    if (bulkOps.length > 0) await FinancialStatementMapping.bulkWrite(bulkOps);

    await writeAudit(req, 'statement_mapping_update', {
      count: bulkOps.length,
    });

    const rows = await FinancialStatementMapping.find().sort({ sourceType: 1, sourceKey: 1 });
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-statements/audit-log
router.get('/audit-log/list', async (req: AuthRequest, res, next) => {
  try {
    const periodLabel = String(req.query.periodLabel || '').trim();
    const action = String(req.query.action || '').trim();
    const limit = Number(req.query.limit || 300);

    const filter: Record<string, unknown> = { tableName: 'financial_statements' };
    if (action) filter.action = action;
    if (periodLabel) filter['changes.periodLabel'] = periodLabel;

    const rows = await AuditLog.find(filter)
      .populate('userId', 'email fullName roles')
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(1000, limit)));

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
