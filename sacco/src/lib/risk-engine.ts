// SMCF Risk Scoring Engine
// Calculates member risk scores on a 0-100 scale based on three weighted factors:
// 1. Savings Consistency (30%) - regularity and growth of savings deposits
// 2. Repayment History (40%) - loan repayment track record
// 3. Loan-to-Savings Ratio (30%) - financial leverage assessment

export interface RiskMember {
  id: string;
  name: string;
  savings: number;
  shares: number;
  loan_balance: number;
  risk_score: number | null;
  status: string;
}

export interface RiskBreakdown {
  memberId: string;
  memberName: string;
  savingsConsistency: number;
  repaymentHistory: number;
  loanToSavingsRatio: number;
  compositeScore: number;
  riskLevel: "low" | "medium" | "high";
  factors: RiskFactor[];
}

export interface RiskFactor {
  label: string;
  impact: "positive" | "negative" | "neutral";
  detail: string;
}

const WEIGHTS = {
  savingsConsistency: 0.3,
  repaymentHistory: 0.4,
  loanToSavingsRatio: 0.3,
};

function calcSavingsConsistency(member: RiskMember): { score: number; factors: RiskFactor[] } {
  // Use the member's risk_score as a proxy for savings consistency when we don't have history
  const score = Math.min(100, Math.max(0, member.risk_score ?? 50));
  const factors: RiskFactor[] = [];
  if (member.savings > 100000) {
    factors.push({ label: "Strong Savings", impact: "positive", detail: `KES ${member.savings.toLocaleString()} in savings` });
  } else if (member.savings < 20000) {
    factors.push({ label: "Low Savings", impact: "negative", detail: `Only KES ${member.savings.toLocaleString()} in savings` });
  }
  return { score, factors };
}

function calcRepaymentHistory(member: RiskMember): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  if (member.loan_balance === 0) {
    return { score: 100, factors: [{ label: "No Outstanding Loans", impact: "positive", detail: "Zero leverage" }] };
  }
  // Use risk_score as proxy
  const score = Math.min(100, Math.max(0, member.risk_score ?? 50));
  if (score >= 75) {
    factors.push({ label: "Good Repayment", impact: "positive", detail: "Strong repayment track record" });
  } else if (score < 50) {
    factors.push({ label: "Weak Repayment", impact: "negative", detail: "Poor repayment history" });
  }
  return { score, factors };
}

function calcLoanToSavingsRatio(member: RiskMember): { score: number; factors: RiskFactor[] } {
  const totalDeposits = member.savings + member.shares;
  if (totalDeposits === 0) return { score: 0, factors: [{ label: "No Deposits", impact: "negative", detail: "Cannot assess leverage without deposits" }] };

  if (member.loan_balance === 0) {
    return { score: 100, factors: [{ label: "No Outstanding Loans", impact: "positive", detail: "Zero leverage" }] };
  }

  const ratio = member.loan_balance / totalDeposits;
  const score = Math.round(Math.max(0, Math.min(100, (1 - ratio / 3) * 100)));

  const factors: RiskFactor[] = [];
  if (ratio > 2) {
    factors.push({ label: "High Leverage", impact: "negative", detail: `Loan balance is ${ratio.toFixed(1)}x deposits` });
  } else if (ratio > 1) {
    factors.push({ label: "Moderate Leverage", impact: "negative", detail: `Loan balance exceeds deposits (${ratio.toFixed(1)}x)` });
  } else {
    factors.push({ label: "Conservative Leverage", impact: "positive", detail: `Loan balance is ${(ratio * 100).toFixed(0)}% of deposits` });
  }

  return { score, factors };
}

export function calculateRiskScore(member: RiskMember): RiskBreakdown {
  const savings = calcSavingsConsistency(member);
  const repayment = calcRepaymentHistory(member);
  const leverage = calcLoanToSavingsRatio(member);

  const composite = Math.round(
    savings.score * WEIGHTS.savingsConsistency +
    repayment.score * WEIGHTS.repaymentHistory +
    leverage.score * WEIGHTS.loanToSavingsRatio
  );

  const riskLevel = composite >= 75 ? "low" : composite >= 50 ? "medium" : "high";

  return {
    memberId: member.id,
    memberName: member.name,
    savingsConsistency: savings.score,
    repaymentHistory: repayment.score,
    loanToSavingsRatio: leverage.score,
    compositeScore: composite,
    riskLevel,
    factors: [...savings.factors, ...repayment.factors, ...leverage.factors],
  };
}

export function calculateAllRiskScores(members: RiskMember[]): RiskBreakdown[] {
  return members.map(calculateRiskScore).sort((a, b) => a.compositeScore - b.compositeScore);
}
