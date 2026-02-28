# SMCF Tariff Review Report - 2026

## Executive Summary

This document outlines the revised tariff structure for SMCF (Smart Money Cash Flow) organization, specifically addressing withdrawal fees to ensure organizational profitability while covering M-Pesa transaction costs.

**Date**: February 28, 2026  
**Status**: Implemented  
**Impact**: Revenue Protection & Profitability Enhancement

---

## Problem Identified

### Previous Withdrawal Fee Structure (UNPROFITABLE)

The previous tariff structure was causing significant financial losses to SMCF:

| Amount Range | Old SMCF Fee | Actual M-Pesa B2C Cost | Loss to SMCF |
|--------------|--------------|------------------------|--------------|
| KES 1 - 999 | KES 10 | Up to KES 23 | **Up to KES 13** |
| KES 1,000 - 4,999 | KES 20 | KES 28 - 75 | **Up to KES 55** |
| KES 5,000 - 9,999 | KES 30 | KES 87 - 115 | **Up to KES 85** |
| KES 10,000 - 19,999 | KES 40 | KES 167 - 185 | **Up to KES 145** |
| KES 20,000 - 49,999 | KES 60 | KES 197 - 278 | **Up to KES 218** |
| KES 50,000 - 100,000 | KES 80 | KES 288 - 300 | **Up to KES 220** |

**Critical Issue**: Every withdrawal transaction was costing SMCF money instead of generating revenue!

---

## M-Pesa B2C Transaction Costs (2026)

Reference costs for sending money from M-Pesa Till to Member mobile numbers:

| Amount Range | M-Pesa B2C Cost |
|--------------|-----------------|
| KES 10 - 100 | ~KES 11 |
| KES 101 - 500 | ~KES 13 |
| KES 501 - 1,000 | ~KES 23 |
| KES 1,001 - 2,500 | ~KES 28 |
| KES 2,501 - 5,000 | ~KES 75 |
| KES 5,001 - 10,000 | ~KES 115 |
| KES 10,001 - 20,000 | ~KES 185 |
| KES 20,001 - 50,000 | ~KES 278 |
| KES 50,001 - 100,000 | ~KES 300 |

---

## New Withdrawal Fee Structure (PROFITABLE)

### Design Principles

1. **Cover Actual Costs**: All fees must cover M-Pesa B2C transaction costs
2. **Profit Margin**: Include 25-35% markup for organizational sustainability
3. **Fair to Members**: Keep fees reasonable and transparent
4. **Competitive**: Remain competitive with market alternatives

### New Tariff Chart

| Amount Range | New SMCF Fee | M-Pesa Cost | SMCF Profit | Profit % |
|--------------|--------------|-------------|-------------|----------|
| KES 1 - 100 | **KES 15** | ~KES 11 | ~KES 4 | 36% |
| KES 101 - 500 | **KES 18** | ~KES 13 | ~KES 5 | 38% |
| KES 501 - 1,000 | **KES 30** | ~KES 23 | ~KES 7 | 30% |
| KES 1,001 - 2,500 | **KES 38** | ~KES 28 | ~KES 10 | 36% |
| KES 2,501 - 5,000 | **KES 95** | ~KES 75 | ~KES 20 | 27% |
| KES 5,001 - 10,000 | **KES 145** | ~KES 115 | ~KES 30 | 26% |
| KES 10,001 - 20,000 | **KES 235** | ~KES 185 | ~KES 50 | 27% |
| KES 20,001 - 50,000 | **KES 350** | ~KES 278 | ~KES 72 | 26% |
| KES 50,001 - 100,000 | **KES 385** | ~KES 300 | ~KES 85 | 28% |

**Average Profit Margin**: ~28-30%

---

## Financial Impact Analysis

### Revenue Projection (Based on 100 Monthly Withdrawals)

Assuming typical withdrawal distribution:

| Amount Range | Estimated Monthly Volume | Old Revenue | New Revenue | Revenue Increase |
|--------------|-------------------------|-------------|-------------|------------------|
| KES 1 - 1,000 | 30 withdrawals | KES 300 | KES 540 | +KES 240 |
| KES 1,001 - 5,000 | 40 withdrawals | KES 800 | KES 2,660 | +KES 1,860 |
| KES 5,001 - 20,000 | 20 withdrawals | KES 700 | KES 3,800 | +KES 3,100 |
| KES 20,001 - 100,000 | 10 withdrawals | KES 700 | KES 3,675 | +KES 2,975 |
| **TOTAL** | **100 withdrawals** | **KES 2,500** | **KES 10,675** | **+KES 8,175** |

**Monthly Revenue Increase**: ~KES 8,175 (327% increase)  
**Annual Revenue Increase**: ~KES 98,100

### From Losses to Profits

- **Previous Status**: Losing KES 5,000-10,000/month on withdrawals
- **New Status**: Generating KES 2,500-3,500/month profit from withdrawals
- **Net Monthly Improvement**: ~KES 10,000-12,000

---

## Other Transaction Fees (No Changes)

### Wallet-to-Wallet Transfers
**Status**: Remain unchanged (already profitable, low cost to SMCF)

| Amount Range | Fee |
|--------------|-----|
| KES 1 - 99 | Free |
| KES 100 - 499 | KES 5 |
| KES 500 - 999 | KES 10 |
| KES 1,000 - 1,999 | KES 20 |
| KES 2,000 - 4,999 | KES 30 |
| KES 5,000 - 9,999 | KES 40 |
| KES 10,000 - 19,999 | KES 50 |
| KES 20,000 - 49,999 | KES 70 |
| KES 50,000 - 100,000 | KES 100 |

**Rationale**: Internal wallet transfers don't incur M-Pesa costs, only database operations.

### Wallet Top-Up Fees
**Status**: Remain unchanged

| Method | Fee |
|--------|-----|
| Direct Deposit | Free |
| STK Push | KES 5 |
| M-Pesa | KES 5 |

**Rationale**: Top-up costs are minimal and fees cover processing.

---

## Implementation Details

### Files Modified

1. **backend/services/feeService.js**
   - Updated `calculateWithdrawalFee()` function
   - Updated withdrawal fee tiers in `getFeeTiers()`
   - Added documentation explaining M-Pesa cost coverage

2. **src/components/TransactionFeesReport.tsx**
   - Updated UI tariff chart display
   - Shows new withdrawal fee structure to members

### Backward Compatibility

- All existing withdrawal transactions remain unchanged
- New fee structure applies to all new withdrawal requests
- Members will see updated fees in withdrawal preview

### Reserve Account Integration

All withdrawal fees continue to credit the Group Reserve Account when enabled:
- **Source Type**: `withdrawal_fee`
- **Auto-credited**: Yes (when reserve settings enabled)
- **Purpose**: Organizational sustainability fund

---

## Member Communication

### Key Messages to Members

1. **Transparency**: "Our new fees reflect the actual cost of M-Pesa transactions plus a small margin for sustainability"

2. **Fairness**: "SMCF must cover transaction costs to remain operational and serve you better"

3. **Alternatives**: "Consider combining smaller withdrawals to optimize fee efficiency"

4. **Value**: "Your savings still earn competitive interest, and internal transfers remain affordable"

### Example Member Impact

**Scenario 1: Small Withdrawal**
- Amount: KES 500
- Old Fee: KES 10
- New Fee: KES 18
- Increase: +KES 8
- Member receives: KES 482 (vs KES 490 before)

**Scenario 2: Medium Withdrawal**
- Amount: KES 5,000
- Old Fee: KES 20
- New Fee: KES 95
- Increase: +KES 75
- Member receives: KES 4,905 (vs KES 4,980 before)

**Scenario 3: Large Withdrawal**
- Amount: KES 20,000
- Old Fee: KES 40
- New Fee: KES 235
- Increase: +KES 195
- Member receives: KES 19,765 (vs KES 19,960 before)

---

## Recommendations

### For Members

1. **Plan Withdrawals**: Combine multiple small needs into fewer larger withdrawals
2. **Use Internal Transfers**: Transfer to other members at lower cost when possible
3. **Maintain Balance**: Keep funds earning interest rather than frequent small withdrawals

### For SMCF Management

1. **Monitor Metrics**: Track withdrawal patterns and fee collection monthly
2. **Annual Review**: Review M-Pesa rates annually and adjust fees if needed
3. **Member Education**: Provide clear communication about fee structure
4. **Alternative Payment Methods**: Explore cheaper disbursement options (bank transfers, bulk payments)

### Future Optimizations

1. **Bulk Disbursement**: Negotiate better rates with M-Pesa for bulk B2C
2. **Bank Integration**: Add direct bank transfer option (potentially lower fees)
3. **Tiered Membership**: VIP members with high volumes could get discounted fees
4. **Fee Caps**: Consider monthly fee caps for very active members

---

## Compliance & Governance

### Transparency
- All fees are clearly displayed before member confirmation
- Fee breakdown shown in transaction history
- Tariff chart publicly accessible in member dashboard

### Audit Trail
- All fees recorded in `TransactionFee` collection
- Linked to specific withdrawal transactions
- Reserve account credits tracked with full audit trail

### Regulatory Compliance
- Fees are reasonable and cost-based
- Full disclosure to members
- No hidden charges

---

## Conclusion

The new withdrawal tariff structure achieves the critical objectives:

✅ **Covers M-Pesa costs completely**  
✅ **Generates sustainable profit for SMCF (25-35% margin)**  
✅ **Transparent and fair to members**  
✅ **Ensures organizational financial health**  
✅ **Feeds into Group Reserve Account for emergencies**

**Status**: Implemented and effective immediately for all new withdrawals.

**Next Review**: Q1 2027 (or sooner if M-Pesa adjusts B2C rates)

---

## Technical Reference

### Code Examples

#### Calculate Withdrawal Fee
```javascript
import { calculateWithdrawalFee } from './services/feeService.js';

const amount = 5000;
const fee = calculateWithdrawalFee(amount); // Returns 95
const netAmount = amount - fee; // Member receives 4905
```

#### Get Fee Tiers
```javascript
import { getFeeTiers } from './services/feeService.js';

const withdrawalTiers = getFeeTiers('withdrawal');
// Returns array with all withdrawal fee brackets
```

#### Preview Withdrawal with Fee
```javascript
// GET /api/savings/check-early-withdrawal?amount=5000
// Response includes:
{
  "withdrawal_fee": 95,
  "final_amount": 4905,
  "requested_amount": 5000
}
```

---

## Appendix

### M-Pesa Rate Reference
Source: Safaricom M-Pesa B2C Tariffs 2026

### Change Log
- **2026-02-28**: Initial implementation of revised withdrawal fees
- **2026-02-28**: Documented rationale and financial impact

### Contact
For questions about this tariff review, contact SMCF Finance Team.

---

**Document Version**: 1.0  
**Last Updated**: February 28, 2026  
**Author**: SMCF Finance & Tech Team
