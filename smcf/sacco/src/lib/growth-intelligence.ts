/**
 * Financial Growth Intelligence System
 * Analyzes member behavior and generates personalized growth tips.
 */

export interface GrowthTip {
  id: string;
  icon: "savings" | "loan" | "shares" | "streak" | "risk" | "dividend" | "guarantor" | "milestone";
  title: string;
  message: string;
  impact: "high" | "medium" | "low";
  badge?: string; // optional milestone badge label
}

interface MemberData {
  savings: number;
  shares: number;
  loan_balance: number;
  risk_score: number | null;
  status: string;
}

interface LoanData {
  principal: number;
  balance: number;
  status: string;
  monthly_installment: number;
  term_months: number;
}

interface SavingsEntry {
  amount: number;
  month: string;
}

const LOAN_MULTIPLIER = 3; // Loan limit = savings × multiplier

export function generateGrowthTips(
  member: MemberData,
  loans: LoanData[],
  savingsHistory: SavingsEntry[]
): GrowthTip[] {
  const tips: GrowthTip[] = [];

  const savings = Number(member.savings);
  const shares = Number(member.shares);
  const loanBalance = Number(member.loan_balance);
  const currentLoanLimit = savings * LOAN_MULTIPLIER;

  // Tip 1: Savings boost → loan limit increase
  const savingsIncrements = [500, 1000, 2000, 5000];
  const increment = savingsIncrements.find((inc) => inc <= savings * 0.3) ?? 500;
  const additionalLoanLimit = increment * 6 * LOAN_MULTIPLIER;
  tips.push({
    id: "savings-boost",
    icon: "savings",
    title: "Boost Your Loan Limit",
    message: `If you save KES ${increment.toLocaleString()} more monthly, your loan limit increases by KES ${additionalLoanLimit.toLocaleString()} in 6 months.`,
    impact: "high",
  });

  // Tip 2: Share capital growth
  if (shares < 50000) {
    const targetShares = Math.min(shares + 10000, 50000);
    const benefit = targetShares >= 50000 ? "unlock premium loan products" : "increase your dividend earnings";
    tips.push({
      id: "shares-growth",
      icon: "shares",
      title: "Grow Your Shares",
      message: `Increasing your share capital to KES ${targetShares.toLocaleString()} will ${benefit}.`,
      impact: "medium",
    });
  }

  // Tip 3: Savings consistency streak
  if (savingsHistory.length >= 2) {
    const sorted = [...savingsHistory].sort((a, b) => a.month.localeCompare(b.month));
    const lastThree = sorted.slice(-3);
    const avgRecent = lastThree.reduce((s, e) => s + Number(e.amount), 0) / lastThree.length;
    if (avgRecent > 0) {
      const projectedIn12 = savings + avgRecent * 12;
      tips.push({
        id: "savings-streak",
        icon: "streak",
        title: "Great Savings Streak!",
        message: `At your current pace, you'll reach KES ${Math.round(projectedIn12).toLocaleString()} in savings within 12 months — unlocking a loan limit of KES ${Math.round(projectedIn12 * LOAN_MULTIPLIER).toLocaleString()}.`,
        impact: "medium",
      });
    }
  }

  // Tip 4: Loan repayment acceleration
  const activeLoans = loans.filter((l) => ["active", "disbursed"].includes(l.status));
  if (activeLoans.length > 0) {
    const totalBalance = activeLoans.reduce((s, l) => s + Number(l.balance), 0);
    const totalMonthly = activeLoans.reduce((s, l) => s + Number(l.monthly_installment), 0);
    if (totalMonthly > 0) {
      const extraPayment = Math.round(totalMonthly * 0.2);
      const currentMonthsLeft = Math.ceil(totalBalance / totalMonthly);
      const newMonthsLeft = Math.ceil(totalBalance / (totalMonthly + extraPayment));
      const monthsSaved = currentMonthsLeft - newMonthsLeft;
      if (monthsSaved > 0) {
        tips.push({
          id: "loan-accelerate",
          icon: "loan",
          title: "Pay Off Faster",
          message: `Adding KES ${extraPayment.toLocaleString()} extra per month could clear your loan ${monthsSaved} month${monthsSaved > 1 ? "s" : ""} earlier, saving you on interest.`,
          impact: "high",
        });
      }
    }
  }

  // Tip 5: Risk score improvement
  const riskScore = member.risk_score ?? 50;
  if (riskScore < 75) {
    const improvement = riskScore < 50 ? "significantly" : "further";
    tips.push({
      id: "risk-improve",
      icon: "risk",
      title: "Improve Your Credit Score",
      message: `Your credit score is ${riskScore}/100. Consistent savings and timely repayments can ${improvement} improve it, unlocking better loan terms.`,
      impact: riskScore < 50 ? "high" : "medium",
    });
  }

  // Tip 6: No loan — encourage first application
  if (activeLoans.length === 0 && loanBalance === 0 && savings > 0) {
    tips.push({
      id: "first-loan",
      icon: "loan",
      title: "Ready for Your First Loan?",
      message: `With KES ${savings.toLocaleString()} in savings, you could qualify for a loan up to KES ${currentLoanLimit.toLocaleString()}. Apply today!`,
      impact: "medium",
    });
  }

  // Tip 7: Dividend projection
  const ASSUMED_DIVIDEND_RATE = 0.10; // 10% annual return assumption
  const totalContribution = savings + shares;
  if (totalContribution > 0) {
    const projectedDividend = Math.round(totalContribution * ASSUMED_DIVIDEND_RATE);
    const boostedContribution = totalContribution + 2000 * 12;
    const boostedDividend = Math.round(boostedContribution * ASSUMED_DIVIDEND_RATE);
    tips.push({
      id: "dividend-projection",
      icon: "dividend",
      title: "Your Dividend Forecast",
      message: `Based on your KES ${totalContribution.toLocaleString()} in savings & shares, your projected annual dividend is ~KES ${projectedDividend.toLocaleString()}. Save KES 2,000 more monthly to boost it to ~KES ${boostedDividend.toLocaleString()}.`,
      impact: "high",
    });
  }

  // Tip 8: Guarantor capacity
  const guarantorCapacity = Math.max(0, savings - loanBalance);
  if (guarantorCapacity > 0) {
    tips.push({
      id: "guarantor-capacity",
      icon: "guarantor",
      title: "You Can Help Fellow Members",
      message: `You have a guarantor capacity of KES ${guarantorCapacity.toLocaleString()}. By guaranteeing loans for others, you strengthen the SACCO community and build your standing.`,
      impact: "low",
    });
  }
  if (guarantorCapacity <= 0 && loanBalance > 0) {
    const neededSavings = loanBalance - savings + 5000;
    tips.push({
      id: "guarantor-unlock",
      icon: "guarantor",
      title: "Unlock Guarantor Ability",
      message: `You currently can't guarantee other members' loans. Saving an extra KES ${neededSavings.toLocaleString()} would give you guarantor capacity.`,
      impact: "medium",
    });
  }

  // Tip 9: Savings milestone badges
  const milestones = [
    { threshold: 5000, label: "🌱 Seedling Saver", next: 10000 },
    { threshold: 10000, label: "🌿 Growing Saver", next: 25000 },
    { threshold: 25000, label: "🌳 Steady Saver", next: 50000 },
    { threshold: 50000, label: "⭐ Star Saver", next: 100000 },
    { threshold: 100000, label: "💎 Diamond Saver", next: 250000 },
    { threshold: 250000, label: "🏆 Elite Saver", next: 500000 },
    { threshold: 500000, label: "👑 SACCO Champion", next: null },
  ];
  const achieved = milestones.filter((m) => savings >= m.threshold);
  const current = achieved[achieved.length - 1];
  const nextMilestone = current?.next;
  if (current) {
    const remaining = nextMilestone ? nextMilestone - savings : 0;
    tips.push({
      id: "milestone-badge",
      icon: "milestone",
      title: current.label,
      message: nextMilestone
        ? `You've earned the ${current.label} badge! Save KES ${remaining.toLocaleString()} more to reach the next milestone.`
        : `Congratulations! You've reached the highest savings milestone — ${current.label}. You're a true SACCO champion!`,
      impact: nextMilestone ? "medium" : "high",
      badge: current.label,
    });
  } else if (savings > 0) {
    const firstTarget = milestones[0].threshold;
    tips.push({
      id: "milestone-first",
      icon: "milestone",
      title: "Earn Your First Badge!",
      message: `Save KES ${(firstTarget - savings).toLocaleString()} more to earn the ${milestones[0].label} badge. Milestones unlock as you grow!`,
      impact: "medium",
    });
  }

  return tips;
}
