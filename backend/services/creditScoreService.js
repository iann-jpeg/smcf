/**
 * Credit Score Service
 * Calculates member credit scores based on SMCF financial behavior
 * Score range: 0-100
 */

import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Loan from '../models/Loan.js';
import Saving from '../models/Saving.js';
import Cycle from '../models/Cycle.js';

/**
 * Calculate comprehensive credit score for a member
 * @param {String} memberId - Member ID
 * @returns {Object} - Credit score details
 */
export async function calculateCreditScore(memberId) {
  try {
    const member = await Member.findById(memberId);
    if (!member) {
      throw new Error('Member not found');
    }

    // Fetch member's financial data
    const payments = await Payment.find({ member_id: memberId, status: 'completed' }).sort({ date: -1 });
    const loans = await Loan.find({ member_id: memberId });
    const savings = await Saving.find({ member_id: memberId }).sort({ created_at: -1 });
    const currentCycle = await Cycle.findOne({ status: 'active' });

    // Initialize scores
    let savingsScore = 0;
    let cycleScore = 0;
    let repaymentScore = 0;
    let consistencyScore = 0;
    const reasons = [];
    const flags = [];

    // 1. SAVINGS CONTRIBUTION SCORE (0-40 points)
    const savingsData = calculateSavingsScore(member, savings, flags);
    savingsScore = savingsData.score;
    reasons.push(...savingsData.reasons);

    // 2. CYCLE PARTICIPATION SCORE (0-25 points)
    const cycleData = calculateCycleScore(member, payments, currentCycle);
    cycleScore = cycleData.score;
    reasons.push(...cycleData.reasons);

    // 3. REPAYMENT BEHAVIOR SCORE (0-25 points)
    const repaymentData = calculateRepaymentScore(loans);
    repaymentScore = repaymentData.score;
    reasons.push(...repaymentData.reasons);

    // 4. CONTRIBUTION CONSISTENCY SCORE (0-10 points)
    const consistencyData = calculateConsistencyScore(payments, member);
    consistencyScore = consistencyData.score;
    reasons.push(...consistencyData.reasons);

    // Calculate total score
    const totalScore = Math.min(100, Math.round(
      savingsScore + cycleScore + repaymentScore + consistencyScore
    ));

    // Determine decision
    let decision = 'Declined';
    let decisionColor = 'red';
    if (totalScore >= 70) {
      decision = 'Approved';
      decisionColor = 'green';
    } else if (totalScore >= 50) {
      decision = 'Review Required';
      decisionColor = 'orange';
    }

    return {
      score: totalScore,
      decision,
      decisionColor,
      breakdown: {
        savings: Math.round(savingsScore),
        cycle: Math.round(cycleScore),
        repayment: Math.round(repaymentScore),
        consistency: Math.round(consistencyScore),
      },
      reasons: reasons.slice(0, 4), // Top 4 reasons
      flags,
      calculatedAt: new Date(),
    };
  } catch (error) {
    console.error('Credit score calculation error:', error);
    throw error;
  }
}

/**
 * Calculate Savings Contribution Score (0-40 points)
 */
function calculateSavingsScore(member, savings, flags) {
  let score = 0;
  const reasons = [];

  // Total savings (0-15 points)
  const totalSavings = member.total_savings || 0;
  if (totalSavings >= 10000) {
    score += 15;
    reasons.push('Excellent savings balance (KES ' + totalSavings.toLocaleString() + ')');
  } else if (totalSavings >= 5000) {
    score += 10;
    reasons.push('Good savings balance');
  } else if (totalSavings >= 2000) {
    score += 5;
    reasons.push('Moderate savings balance');
  } else if (totalSavings > 0) {
    score += 2;
  }

  // Growth trend (0-10 points)
  if (savings.length >= 3) {
    const recentSavings = savings.slice(0, 3);
    const isGrowing = recentSavings[0].balance_after > recentSavings[2].balance_after;
    if (isGrowing) {
      score += 10;
      reasons.push('Positive savings growth trend');
    } else {
      score += 5;
    }
  }

  // Average monthly savings (0-10 points)
  const avgMonthlySavings = totalSavings / (getMonthsSinceJoining(member) || 1);
  if (avgMonthlySavings >= 1000) {
    score += 10;
  } else if (avgMonthlySavings >= 500) {
    score += 7;
  } else if (avgMonthlySavings >= 200) {
    score += 4;
  }

  // Check for suspicious large deposits (flag only)
  if (savings.length > 0) {
    const avgDeposit = savings.reduce((sum, s) => sum + (s.amount || 0), 0) / savings.length;
    const largeDeps = savings.filter(s => s.amount > avgDeposit * 5);
    if (largeDeps.length > 0 && largeDeps.length < 3) {
      flags.push('Unusually large deposit detected - verify source');
    }
  }

  // Wallet balance bonus (0-5 points)
  if (member.wallet_balance >= 1000) {
    score += 5;
    reasons.push('Healthy wallet balance');
  } else if (member.wallet_balance >= 500) {
    score += 3;
  }

  return { score: Math.min(40, score), reasons };
}

/**
 * Calculate Cycle Participation Score (0-25 points)
 */
function calculateCycleScore(member, payments, currentCycle) {
  let score = 0;
  const reasons = [];

  // Current cycle participation (0-10 points)
  if (member.payment_status === 'paid') {
    score += 10;
    reasons.push('Paid current cycle contribution');
  } else {
    score += 0;
    reasons.push('Pending payment for current cycle');
  }

  // Total contributions (0-10 points)
  const totalContributed = member.total_contributed || 0;
  if (totalContributed >= 5000) {
    score += 10;
    reasons.push('Strong contribution history');
  } else if (totalContributed >= 2000) {
    score += 7;
  } else if (totalContributed >= 500) {
    score += 4;
  }

  // Payment count (0-5 points)
  const paymentCount = payments.length;
  if (paymentCount >= 10) {
    score += 5;
  } else if (paymentCount >= 5) {
    score += 3;
  } else if (paymentCount >= 2) {
    score += 1;
  }

  return { score: Math.min(25, score), reasons };
}

/**
 * Calculate Repayment Behavior Score (0-25 points)
 */
function calculateRepaymentScore(loans) {
  let score = 0;
  const reasons = [];

  const repaidLoans = loans.filter(l => l.status === 'repaid');
  const activeLoans = loans.filter(l => l.status === 'disbursed');
  const defaultedLoans = loans.filter(l => l.status === 'rejected' && l.rejection_reason?.includes('default'));

  // Repaid loans (0-15 points)
  if (repaidLoans.length >= 3) {
    score += 15;
    reasons.push('Excellent loan repayment history (' + repaidLoans.length + ' loans)');
  } else if (repaidLoans.length >= 2) {
    score += 12;
    reasons.push('Good loan repayment record');
  } else if (repaidLoans.length === 1) {
    score += 8;
    reasons.push('Successfully repaid previous loan');
  } else if (loans.length === 0) {
    score += 10; // New borrower - neutral
    reasons.push('New borrower - no loan history');
  }

  // Active loans penalty (0 to -10 points)
  if (activeLoans.length === 0) {
    score += 10;
  } else if (activeLoans.length === 1) {
    score += 5;
    reasons.push('One active loan currently');
  } else {
    score += 0;
    reasons.push('Multiple active loans - high risk');
  }

  // Default penalty
  if (defaultedLoans.length > 0) {
    score -= 15;
    reasons.push('⚠️ Loan default history detected');
  }

  return { score: Math.max(0, Math.min(25, score)), reasons };
}

/**
 * Calculate Contribution Consistency Score (0-10 points)
 */
function calculateConsistencyScore(payments, member) {
  let score = 0;
  const reasons = [];

  // Payment frequency (0-5 points)
  if (payments.length >= 6) {
    score += 5;
    reasons.push('Regular payment patterns');
  } else if (payments.length >= 3) {
    score += 3;
  }

  // Recent activity (0-5 points)
  if (payments.length > 0) {
    const lastPayment = payments[0];
    const daysSinceLastPayment = (new Date() - new Date(lastPayment.date)) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPayment <= 30) {
      score += 5;
      reasons.push('Active member - recent payment');
    } else if (daysSinceLastPayment <= 60) {
      score += 3;
    }
  }

  return { score: Math.min(10, score), reasons };
}

/**
 * Helper: Calculate months since member joined
 */
function getMonthsSinceJoining(member) {
  const joinDate = new Date(member.join_date || member.created_at);
  const now = new Date();
  const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
  return Math.max(1, months);
}
