const fs = require('fs');
const path = 'd:/smart money cash flow/smcfsacco/smcf-sacco-backend/src/routes/mpesa.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("const regFee = pendingRegistrationFees.get(CheckoutRequestID);")) {
  const marker = "    // ── Loan repayment ───────────────────────────────────────────────────\n    const repayment = pendingRepayments.get(CheckoutRequestID);";
  const block = `    const regFee = pendingRegistrationFees.get(CheckoutRequestID);\n    if (regFee) {\n      if (ResultCode !== 0) {\n        regFee.status = 'failed';\n        regFee.resultDesc = ResultDesc || 'Payment cancelled or failed';\n      } else {\n        const amt = paidAmt || regFee.amount;\n        if (amt === REGISTRATION_FEE_AMOUNT) {\n          await settleRegistrationFeePayment({\n            memberId: regFee.memberId,\n            amount: amt,\n            phone: regFee.phone,\n            mpesaRef,\n            checkoutRequestId: CheckoutRequestID,\n            source: 'callback',\n          });\n          regFee.status = 'success';\n          regFee.mpesaRef = mpesaRef;\n          regFee.amount = amt;\n        } else {\n          regFee.status = 'failed';\n          regFee.resultDesc = 'Invalid amount for registration fee';\n          await Transaction.findOneAndUpdate({ checkoutRequestId: CheckoutRequestID, type: 'registration_fee' }, { status: 'failed', processedAt: new Date() });\n        }\n      }\n      pendingRegistrationFees.set(CheckoutRequestID, regFee);\n      return;\n    }\n\n    // ── Loan repayment ───────────────────────────────────────────────────\n    const repayment = pendingRepayments.get(CheckoutRequestID);`;
  if (!content.includes(marker)) throw new Error('loan marker not found for callback patch');
  content = content.replace(marker, block);
}

if (!content.includes("const regFee = pendingRegistrationFees.get(checkoutRequestId);")) {
  const marker = "    // Fallback: DB lookup (handles server restart where Map was cleared)\n    const txn = await Transaction.findOne({\n      checkoutRequestId,\n      type: { $in: ['deposit', 'share_purchase'] },\n    }).select('status mpesaRef amount type');";
  const block = `    const regFee = pendingRegistrationFees.get(checkoutRequestId);\n    if (regFee) {\n      return res.json({\n        success: true,\n        data: {\n          type: 'registration_fee',\n          status: regFee.status,\n          mpesaRef: regFee.mpesaRef,\n          amount: regFee.amount,\n          resultDesc: regFee.resultDesc,\n        },\n      });\n    }\n\n    // Fallback: DB lookup (handles server restart where Map was cleared)\n    const txn = await Transaction.findOne({\n      checkoutRequestId,\n      type: { $in: ['deposit', 'share_purchase', 'registration_fee'] },\n    }).select('status mpesaRef amount type');`;
  if (!content.includes(marker)) throw new Error('status marker not found');
  content = content.replace(marker, block);
}

fs.writeFileSync(path, content, 'utf8');
console.log('patched mpesa callback/status');