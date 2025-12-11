/**
 * Fee Calculation Service for SMCF Wallet System
 * Implements 2026 Member-to-Member Transfer Tariff Chart
 */

/**
 * Calculate wallet-to-wallet transfer fee based on amount
 * @param {number} amount - Transfer amount in KES
 * @returns {number} Fee amount in KES
 */
export const calculateTransferFee = (amount) => {
  if (amount < 100) return 0; // Free for 1-99 KES
  if (amount < 500) return 5;
  if (amount < 1000) return 10;
  if (amount < 2000) return 20;
  if (amount < 5000) return 30;
  if (amount < 10000) return 40;
  if (amount < 20000) return 50;
  if (amount < 50000) return 70;
  if (amount <= 100000) return 100;
  
  // For amounts above 100,000 KES
  return 100;
};

/**
 * Calculate wallet top-up fee based on payment method
 * @param {string} method - Payment method ('direct_deposit', 'stk_push', etc.)
 * @param {number} amount - Top-up amount in KES
 * @returns {number} Fee amount in KES
 */
export const calculateTopUpFee = (method, amount) => {
  if (method === 'direct_deposit' || method === 'cash' || method === 'till') {
    return 0; // Free for direct deposits
  }
  
  if (method === 'stk_push' || method === 'mpesa' || method === 'lipia') {
    return 5; // 5 KES per STK Push transaction
  }
  
  return 0; // Default: no fee
};

/**
 * Calculate wallet withdrawal fee based on amount
 * @param {number} amount - Withdrawal amount in KES
 * @returns {number} Fee amount in KES
 */
export const calculateWithdrawalFee = (amount) => {
  if (amount < 1000) return 10;
  if (amount < 5000) return 20;
  if (amount < 10000) return 30;
  if (amount < 20000) return 40;
  if (amount < 50000) return 60;
  if (amount <= 100000) return 80;
  
  // For amounts above 100,000 KES
  return 80;
};

/**
 * Get fee breakdown for display purposes
 * @param {string} transactionType - Type of transaction
 * @param {number} amount - Transaction amount
 * @param {string} method - Payment method (for top-ups)
 * @returns {object} Fee breakdown
 */
export const getFeeBreakdown = (transactionType, amount, method = null) => {
  let fee = 0;
  let feeDescription = '';
  
  switch (transactionType) {
    case 'transfer':
      fee = calculateTransferFee(amount);
      feeDescription = fee === 0 
        ? 'Free transfer (under KES 100)'
        : `Transfer fee for KES ${amount.toLocaleString()}`;
      break;
      
    case 'top_up':
      fee = calculateTopUpFee(method, amount);
      feeDescription = fee === 0
        ? 'Free top-up (direct deposit)'
        : 'STK Push transaction fee';
      break;
      
    case 'withdrawal':
      fee = calculateWithdrawalFee(amount);
      feeDescription = `Withdrawal fee for KES ${amount.toLocaleString()}`;
      break;
      
    default:
      fee = 0;
      feeDescription = 'No fee';
  }
  
  return {
    fee,
    feeDescription,
    totalAmount: amount + fee,
    netAmount: amount,
  };
};

/**
 * Get fee tier information for a specific transaction type
 * @param {string} transactionType - Type of transaction
 * @returns {array} Array of fee tiers
 */
export const getFeeTiers = (transactionType) => {
  switch (transactionType) {
    case 'transfer':
      return [
        { min: 1, max: 99, fee: 0, description: 'Free' },
        { min: 100, max: 499, fee: 5, description: 'KES 5' },
        { min: 500, max: 999, fee: 10, description: 'KES 10' },
        { min: 1000, max: 1999, fee: 20, description: 'KES 20' },
        { min: 2000, max: 4999, fee: 30, description: 'KES 30' },
        { min: 5000, max: 9999, fee: 40, description: 'KES 40' },
        { min: 10000, max: 19999, fee: 50, description: 'KES 50' },
        { min: 20000, max: 49999, fee: 70, description: 'KES 70' },
        { min: 50000, max: 100000, fee: 100, description: 'KES 100' },
      ];
      
    case 'withdrawal':
      return [
        { min: 1, max: 999, fee: 10, description: 'KES 10' },
        { min: 1000, max: 4999, fee: 20, description: 'KES 20' },
        { min: 5000, max: 9999, fee: 30, description: 'KES 30' },
        { min: 10000, max: 19999, fee: 40, description: 'KES 40' },
        { min: 20000, max: 49999, fee: 60, description: 'KES 60' },
        { min: 50000, max: 100000, fee: 80, description: 'KES 80' },
      ];
      
    default:
      return [];
  }
};

export default {
  calculateTransferFee,
  calculateTopUpFee,
  calculateWithdrawalFee,
  getFeeBreakdown,
  getFeeTiers,
};
