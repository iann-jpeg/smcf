/**
 * SMCF Trust Score — Behavioral Credit Score
 * Based on: Contribution Consistency (35%), Repayment Discipline (40%), Activity Level (25%)
 */

export interface TrustScoreBreakdown {
  overall: number; // 0-100
  grade: "A+" | "A" | "B+" | "B" | "C" | "D" | "F";
  label: string;
  color: string;
  contributionScore: number;
  repaymentScore: number;
  activityScore: number;
  insights: TrustInsight[];
}

export interface TrustInsight {
  factor: string;
  score: number;
  maxScore: number;
  status: "excellent" | "good" | "average" | "poor";
  detail: string;
}

interface MemberData {
  savings: number;
  shares: number;
  loan_balance: number;
  risk_score: number | null;
  status: string;
  join_date: string;
}

interface RepaymentData {
  status: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
}

interface SavingsEntry {
  amount: number;
  month: string;
}

interface TransactionData {
  type: string;
  amount: number;
  processed_at: string;
}

const WEIGHTS = { contribution: 0.35, repayment: 0.40, activity: 0.25 };

function statusOf(score: number): TrustInsight["status"] {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "average";
  return "poor";
}

function gradeOf(score: number): TrustScoreBreakdown["grade"] {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  if (score >= 30) return "D";
  return "F";
}

function labelOf(grade: TrustScoreBreakdown["grade"]): string {
  const map: Record<string, string> = {
    "A+": "Exceptional Trust",
    A: "Highly Trusted",
    "B+": "Trusted",
    B: "Reliable",
    C: "Building Trust",
    D: "Needs Improvement",
    F: "New / At Risk",
  };
  return map[grade] ?? "Unrated";
}

function colorOf(grade: TrustScoreBreakdown["grade"]): string {
  const map: Record<string, string> = {
    "A+": "text-emerald-600",
    A: "text-emerald-500",
    "B+": "text-green-500",
    B: "text-blue-500",
    C: "text-amber-500",
    D: "text-orange-500",
    F: "text-red-500",
  };
  return map[grade] ?? "text-muted-foreground";
}

// ─── Factor 1: Contribution Consistency (35%) ───

function calcContributionScore(
  member: MemberData,
  savingsHistory: SavingsEntry[]
): { score: number; insight: TrustInsight } {
  let score = 0;

  // Base: has savings at all → 20 pts
  if (Number(member.savings) > 0) score += 20;

  // Savings history consistency: monthly deposits
  if (savingsHistory.length >= 3) {
    const sorted = [...savingsHistory].sort((a, b) => a.month.localeCompare(b.month));
    // Check last 6 entries for consistency
    const recent = sorted.slice(-6);
    const positiveMonths = recent.filter((e) => Number(e.amount) > 0).length;
    const consistencyRatio = positiveMonths / recent.length;
    score += Math.round(consistencyRatio * 40); // up to 40 pts

    // Growth trend: are recent deposits growing?
    if (recent.length >= 2) {
      const first = Number(recent[0].amount);
      const last = Number(recent[recent.length - 1].amount);
      if (last > first && first > 0) score += 15; // growing
      else if (last === first && first > 0) score += 10; // stable
    }
  } else if (savingsHistory.length > 0) {
    score += 15; // some history
  }

  // Share capital contribution → up to 25 pts
  const shares = Number(member.shares);
  if (shares >= 100000) score += 25;
  else if (shares >= 50000) score += 20;
  else if (shares >= 20000) score += 15;
  else if (shares >= 5000) score += 10;
  else if (shares > 0) score += 5;

  score = Math.min(score, 100);

  return {
    score,
    insight: {
      factor: "Contribution Consistency",
      score,
      maxScore: 100,
      status: statusOf(score),
      detail:
        score >= 80
          ? "Your savings and share contributions are consistent and growing."
          : score >= 50
          ? "You're contributing regularly. Increase monthly savings for a higher score."
          : "Deposit savings more consistently to build your trust score.",
    },
  };
}

// ─── Factor 2: Repayment Discipline (40%) ───

function calcRepaymentScore(
  repayments: RepaymentData[]
): { score: number; insight: TrustInsight } {
  if (repayments.length === 0) {
    return {
      score: 50, // neutral if no loans yet
      insight: {
        factor: "Repayment Discipline",
        score: 50,
        maxScore: 100,
        status: "average",
        detail: "No loan history yet. Taking and repaying a loan on time will boost your score.",
      },
    };
  }

  const total = repayments.length;
  const paid = repayments.filter((r) => r.status === "paid").length;
  const overdue = repayments.filter((r) => r.status === "overdue").length;
  const pending = repayments.filter((r) => r.status === "pending").length;

  // On-time ratio (paid / total non-pending)
  const settled = total - pending;
  const onTimeRatio = settled > 0 ? paid / settled : 0;

  let score = Math.round(onTimeRatio * 70); // up to 70 pts

  // Penalty for overdue
  const overdueRatio = settled > 0 ? overdue / settled : 0;
  score -= Math.round(overdueRatio * 30);

  // Bonus for full repayment history with zero overdue
  if (overdue === 0 && paid >= 3) score += 30;
  else if (overdue === 0 && paid > 0) score += 15;

  score = Math.max(0, Math.min(score, 100));

  return {
    score,
    insight: {
      factor: "Repayment Discipline",
      score,
      maxScore: 100,
      status: statusOf(score),
      detail:
        overdue > 0
          ? `You have ${overdue} overdue payment${overdue > 1 ? "s" : ""}. Clearing these will significantly improve your score.`
          : score >= 80
          ? "Excellent repayment track record. Keep it up!"
          : "Continue making timely payments to strengthen your score.",
    },
  };
}

// ─── Factor 3: Activity Level (25%) ───

function calcActivityScore(
  member: MemberData,
  transactions: TransactionData[],
  savingsHistory: SavingsEntry[]
): { score: number; insight: TrustInsight } {
  let score = 0;

  // Membership tenure
  const joinDate = new Date(member.join_date);
  const monthsActive = Math.max(1, Math.floor((Date.now() - joinDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
  if (monthsActive >= 24) score += 30;
  else if (monthsActive >= 12) score += 25;
  else if (monthsActive >= 6) score += 15;
  else score += 5;

  // Transaction frequency (last 20 transactions)
  if (transactions.length >= 15) score += 25;
  else if (transactions.length >= 10) score += 20;
  else if (transactions.length >= 5) score += 15;
  else if (transactions.length > 0) score += 5;

  // Recent activity: any transaction in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentTx = transactions.filter((t) => new Date(t.processed_at) >= thirtyDaysAgo);
  if (recentTx.length >= 3) score += 25;
  else if (recentTx.length >= 1) score += 15;

  // Savings diversity
  if (savingsHistory.length >= 6) score += 20;
  else if (savingsHistory.length >= 3) score += 10;

  score = Math.min(score, 100);

  return {
    score,
    insight: {
      factor: "Activity Level",
      score,
      maxScore: 100,
      status: statusOf(score),
      detail:
        score >= 80
          ? `Active for ${monthsActive} months with strong engagement. Great standing!`
          : score >= 50
          ? "Good activity level. More frequent transactions will improve your score."
          : "Increase your SACCO engagement — save, transact, and participate regularly.",
    },
  };
}

// ─── Public API ───

export function calculateTrustScore(
  member: MemberData,
  repayments: RepaymentData[],
  savingsHistory: SavingsEntry[],
  transactions: TransactionData[]
): TrustScoreBreakdown {
  const contribution = calcContributionScore(member, savingsHistory);
  const repayment = calcRepaymentScore(repayments);
  const activity = calcActivityScore(member, transactions, savingsHistory);

  const overall = Math.round(
    contribution.score * WEIGHTS.contribution +
      repayment.score * WEIGHTS.repayment +
      activity.score * WEIGHTS.activity
  );

  const grade = gradeOf(overall);

  return {
    overall,
    grade,
    label: labelOf(grade),
    color: colorOf(grade),
    contributionScore: contribution.score,
    repaymentScore: repayment.score,
    activityScore: activity.score,
    insights: [contribution.insight, repayment.insight, activity.insight],
  };
}
