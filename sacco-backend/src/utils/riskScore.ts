import Member from '../models/Member';

// Lightweight score model used for quick updates after balance-changing events.
export async function recalculateMemberRiskScore(memberId: string): Promise<number | null> {
  const member = await Member.findById(memberId).select('savings shares loanBalance status');
  if (!member) return null;

  const savings = Math.max(0, Number(member.savings || 0));
  const shares = Math.max(0, Number(member.shares || 0));
  const loanBalance = Math.max(0, Number(member.loanBalance || 0));

  const deposits = savings + shares;

  let score = 0;

  // Savings capacity (0-25)
  if (savings >= 100000) score += 25;
  else if (savings >= 50000) score += 20;
  else if (savings >= 20000) score += 15;
  else if (savings >= 5000) score += 10;
  else if (savings > 0) score += 5;

  // Share capital strength (0-30)
  if (shares >= 100000) score += 30;
  else if (shares >= 50000) score += 24;
  else if (shares >= 20000) score += 18;
  else if (shares >= 5000) score += 12;
  else if (shares > 0) score += 6;

  // Leverage discipline (0-35)
  if (loanBalance === 0) {
    score += 35;
  } else if (deposits > 0) {
    const ratio = loanBalance / deposits;
    if (ratio <= 0.5) score += 30;
    else if (ratio <= 1) score += 24;
    else if (ratio <= 1.5) score += 16;
    else if (ratio <= 2) score += 8;
  }

  // Account status (0-10)
  if (member.status === 'active') score += 10;

  const normalized = Math.max(0, Math.min(100, Math.round(score)));

  await Member.findByIdAndUpdate(memberId, { riskScore: normalized });
  return normalized;
}
