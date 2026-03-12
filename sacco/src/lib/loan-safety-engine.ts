/**
 * SMCF Master Loan Safety Algorithm
 * 4-Layer Architecture:
 *   Layer 1 — Safe Loan Limit Engine
 *   Layer 2 — Risk Level Engine
 *   Layer 3 — Guarantor Requirement Engine
 *   Layer 4 — Capital Safety Engine
 *
 * Combined into one master evaluation function.
 */

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
export type CapitalSafetyStatus = "SAFE" | "CAUTION" | "DANGER";
export type LoanDecision = "APPROVE" | "REDUCE" | "REJECT";

export interface LoanSafetyInput {
  member: {
    savings: number;
    shares: number;
    loan_balance: number;
    risk_score: number | null;
    trust_score: number; // 0-100 from SMCF Trust Score engine
  };
  requestedLoan: number;
  guarantors: {
    id: string;
    name: string;
    savings: number;
    risk_score: number | null;
  }[];
  saccoCapital: number;       // total SACCO capital (savings + shares across all members)
  totalLoansIssued: number;   // sum of all outstanding loan balances
}

export interface SafeLoanLimitResult {
  savingsLimit: number;
  capitalLimit: number;
  safeLoanLimit: number;
  loanMultiplier: number;
  trustScoreTier: string;
}

export interface RiskLevelResult {
  riskScore: number;
  riskLevel: RiskLevel;
  factors: {
    label: string;
    weight: number;
    score: number;
    weighted: number;
  }[];
}

export interface GuarantorRequirementResult {
  requiredCount: number;
  providedCount: number;
  totalGuarantorSavings: number;
  requiredGuarantorSavings: number;
  guarantorStrengthMet: boolean;
  guarantorCountMet: boolean;
}

export interface CapitalSafetyResult {
  currentExposure: number;     // ratio 0-1
  projectedExposure: number;   // ratio 0-1
  status: CapitalSafetyStatus;
  maxSafeExposure: number;     // 0.40
}

export interface LoanSafetyResult {
  decision: LoanDecision;
  reasons: string[];
  suggestedAmount: number | null; // if REDUCE, the safe amount
  layer1: SafeLoanLimitResult;
  layer2: RiskLevelResult;
  layer3: GuarantorRequirementResult;
  layer4: CapitalSafetyResult;
}

// ═══════════════════════════════════════════════════
// LAYER 1: Safe Loan Limit Engine
// ═══════════════════════════════════════════════════

function getLoanMultiplier(trustScore: number): { multiplier: number; tier: string } {
  if (trustScore >= 80) return { multiplier: 4, tier: "Premium (4×)" };
  if (trustScore >= 60) return { multiplier: 3, tier: "Standard (3×)" };
  if (trustScore >= 40) return { multiplier: 2, tier: "Cautious (2×)" };
  return { multiplier: 1, tier: "Restricted (1×)" };
}

function calculateSafeLoanLimit(
  memberSavings: number,
  trustScore: number,
  saccoCapital: number
): SafeLoanLimitResult {
  const { multiplier, tier } = getLoanMultiplier(trustScore);
  const savingsLimit = memberSavings * multiplier;
  const capitalLimit = saccoCapital * 0.05; // no single member > 5% of SACCO capital
  const safeLoanLimit = Math.min(savingsLimit, capitalLimit);

  return {
    savingsLimit: Math.round(savingsLimit),
    capitalLimit: Math.round(capitalLimit),
    safeLoanLimit: Math.round(safeLoanLimit),
    loanMultiplier: multiplier,
    trustScoreTier: tier,
  };
}

// ═══════════════════════════════════════════════════
// LAYER 2: Risk Level Engine (5-factor)
// ═══════════════════════════════════════════════════

function classifyRisk(score: number): RiskLevel {
  if (score >= 80) return "LOW";
  if (score >= 60) return "MEDIUM";
  if (score >= 40) return "HIGH";
  return "VERY_HIGH";
}

function calculateRiskLevel(input: LoanSafetyInput): RiskLevelResult {
  const { member, requestedLoan, guarantors } = input;

  // Factor 1: Savings Consistency (25%)
  const savingsTotal = member.savings + member.shares;
  const savingsConsistency = Math.min(100, savingsTotal > 0
    ? Math.min(100, (member.savings / Math.max(savingsTotal, 1)) * 100 + (member.risk_score ?? 50) * 0.5)
    : 0);

  // Factor 2: Repayment History (25%) — use risk_score as proxy
  const repaymentHistory = Math.min(100, Math.max(0, member.risk_score ?? 50));

  // Factor 3: Trust Score (20%)
  const trustScore = Math.min(100, Math.max(0, member.trust_score));

  // Factor 4: Loan Size vs Savings (15%)
  const loanRatio = savingsTotal > 0 ? requestedLoan / savingsTotal : 10;
  const loanRatioScore = Math.max(0, Math.min(100, Math.round((1 - loanRatio / 5) * 100)));

  // Factor 5: Guarantor Strength (15%)
  const totalGuarantorSavings = guarantors.reduce((s, g) => s + g.savings, 0);
  const guarantorCoverage = requestedLoan > 0 ? totalGuarantorSavings / (requestedLoan * 1.2) : 0;
  const guarantorStrength = Math.min(100, Math.round(guarantorCoverage * 100));

  const factors = [
    { label: "Savings Consistency", weight: 0.25, score: Math.round(savingsConsistency), weighted: 0 },
    { label: "Repayment History", weight: 0.25, score: Math.round(repaymentHistory), weighted: 0 },
    { label: "Trust Score", weight: 0.20, score: Math.round(trustScore), weighted: 0 },
    { label: "Loan-to-Savings Ratio", weight: 0.15, score: Math.round(loanRatioScore), weighted: 0 },
    { label: "Guarantor Strength", weight: 0.15, score: Math.round(guarantorStrength), weighted: 0 },
  ];

  factors.forEach((f) => { f.weighted = Math.round(f.score * f.weight); });

  const riskScore = factors.reduce((s, f) => s + f.weighted, 0);

  return {
    riskScore: Math.min(100, Math.max(0, riskScore)),
    riskLevel: classifyRisk(riskScore),
    factors,
  };
}

// ═══════════════════════════════════════════════════
// LAYER 3: Guarantor Requirement Engine
// ═══════════════════════════════════════════════════

function getRequiredGuarantorCount(riskLevel: RiskLevel, loanAmount: number): number {
  const table: Record<RiskLevel, [number, number, number]> = {
    LOW:       [0, 1, 2],  // [<50K, 50K-150K, >150K]
    MEDIUM:    [1, 2, 3],
    HIGH:      [2, 3, 4],
    VERY_HIGH: [-1, -1, -1], // reject
  };

  if (riskLevel === "VERY_HIGH") return -1; // signals rejection

  const tier = table[riskLevel];
  if (loanAmount < 50_000) return tier[0];
  if (loanAmount <= 150_000) return tier[1];
  return tier[2];
}

function calculateGuarantorRequirement(
  riskLevel: RiskLevel,
  loanAmount: number,
  guarantors: LoanSafetyInput["guarantors"]
): GuarantorRequirementResult {
  const requiredCount = Math.max(0, getRequiredGuarantorCount(riskLevel, loanAmount));
  const totalGuarantorSavings = guarantors.reduce((s, g) => s + g.savings, 0);
  const requiredGuarantorSavings = Math.round(loanAmount * 1.2);

  return {
    requiredCount,
    providedCount: guarantors.length,
    totalGuarantorSavings: Math.round(totalGuarantorSavings),
    requiredGuarantorSavings,
    guarantorStrengthMet: totalGuarantorSavings >= requiredGuarantorSavings,
    guarantorCountMet: guarantors.length >= requiredCount,
  };
}

// ═══════════════════════════════════════════════════
// LAYER 4: Capital Safety Engine
// ═══════════════════════════════════════════════════

function calculateCapitalSafety(
  totalLoansIssued: number,
  saccoCapital: number,
  requestedLoan: number
): CapitalSafetyResult {
  const currentExposure = saccoCapital > 0 ? totalLoansIssued / saccoCapital : 0;
  const projectedExposure = saccoCapital > 0 ? (totalLoansIssued + requestedLoan) / saccoCapital : 1;

  let status: CapitalSafetyStatus;
  if (projectedExposure <= 0.40) status = "SAFE";
  else if (projectedExposure <= 0.60) status = "CAUTION";
  else status = "DANGER";

  return {
    currentExposure: Math.round(currentExposure * 10000) / 10000,
    projectedExposure: Math.round(projectedExposure * 10000) / 10000,
    status,
    maxSafeExposure: 0.40,
  };
}

// ═══════════════════════════════════════════════════
// MASTER ALGORITHM
// ═══════════════════════════════════════════════════

export function evaluateLoanSafety(input: LoanSafetyInput): LoanSafetyResult {
  const reasons: string[] = [];
  let decision: LoanDecision = "APPROVE";
  let suggestedAmount: number | null = null;

  // Layer 1
  const layer1 = calculateSafeLoanLimit(
    input.member.savings,
    input.member.trust_score,
    input.saccoCapital
  );

  if (input.requestedLoan > layer1.safeLoanLimit) {
    if (layer1.safeLoanLimit > 0) {
      decision = "REDUCE";
      suggestedAmount = layer1.safeLoanLimit;
      reasons.push(`Exceeds safe loan limit of KES ${layer1.safeLoanLimit.toLocaleString()}. Reduce to KES ${layer1.safeLoanLimit.toLocaleString()}.`);
    } else {
      decision = "REJECT";
      reasons.push("No borrowing capacity — savings too low or SACCO capital constraint.");
    }
  }

  // Layer 2
  const layer2 = calculateRiskLevel(input);

  if (layer2.riskLevel === "VERY_HIGH") {
    decision = "REJECT";
    reasons.push(`Risk score ${layer2.riskScore}/100 is VERY HIGH. Loan cannot be approved.`);
  }

  // Layer 3
  const layer3 = calculateGuarantorRequirement(
    layer2.riskLevel,
    input.requestedLoan,
    input.guarantors
  );

  if (layer2.riskLevel !== "VERY_HIGH") {
    if (!layer3.guarantorCountMet) {
      if (decision !== "REJECT") decision = "REJECT";
      reasons.push(`Need ${layer3.requiredCount} guarantor(s), only ${layer3.providedCount} selected.`);
    }
    if (!layer3.guarantorStrengthMet) {
      if (decision !== "REJECT") decision = "REJECT";
      reasons.push(
        `Guarantors' savings KES ${layer3.totalGuarantorSavings.toLocaleString()} < required KES ${layer3.requiredGuarantorSavings.toLocaleString()} (120% coverage).`
      );
    }
  }

  // Layer 4
  const layer4 = calculateCapitalSafety(
    input.totalLoansIssued,
    input.saccoCapital,
    input.requestedLoan
  );

  if (layer4.status === "DANGER") {
    decision = "REJECT";
    reasons.push(`SACCO exposure would reach ${(layer4.projectedExposure * 100).toFixed(1)}% — exceeds 60% danger threshold.`);
  } else if (layer4.status === "CAUTION" && decision === "APPROVE") {
    reasons.push(`SACCO exposure at ${(layer4.projectedExposure * 100).toFixed(1)}% — within caution zone (40-60%).`);
  }

  if (decision === "APPROVE" && reasons.length === 0) {
    reasons.push("All safety checks passed.");
  }

  return { decision, reasons, suggestedAmount, layer1, layer2, layer3, layer4 };
}
