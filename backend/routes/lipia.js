import express from "express";
import { protect } from "../middleware/auth.js";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";
import {
  initiateLipiaPayment,
  processLipiaCallback,
  queryLipiaPaymentStatus,
} from "../services/lipiaService.js";

const router = express.Router();

/**
 * @route   POST /api/lipia/stk-push
 * @desc    Initiate STK Push payment via Lipia Online
 * @access  Protected
 */
router.post("/stk-push", protect, async (req, res) => {
  try {
    const { phone, amount, cycleNumber, type, notes, recipientMemberId } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({
        success: false,
        error: "Phone number and amount are required",
      });
    }

    // Determine payment type (default to cycle_payment for backward compatibility)
    const paymentType = type || "cycle_payment";
    
    // Determine who the payment is for (payer vs recipient)
    const payerId = req.user._id;
    const recipientId = recipientMemberId || req.user._id; // Use recipient if provided (QR payment)

    // Generate unique reference
    const reference = `SMCF-${Date.now()}-${payerId}`;

    // Create description based on payment type
    let description = `SMCF Contribution - Cycle ${cycleNumber || "Current"}`;
    if (paymentType === "wallet_deposit") {
      description = notes || `Wallet deposit - KES ${amount}`;
    } else if (recipientMemberId && recipientMemberId !== payerId) {
      // QR payment for another member
      description = notes || `Cycle payment for another member`;
    }

    // Initiate payment via Lipia
    const result = await initiateLipiaPayment(
      phone,
      amount,
      reference,
      description
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        responseDescription: result.responseDescription,
      });
    }

    console.log("✅ STK Push successful! Creating payment record...");
    console.log("🔑 CheckoutRequestID from Lipia:", result.checkoutRequestID);
    console.log("🔑 MerchantRequestID from Lipia:", result.merchantRequestID);
    console.log("👤 Member ID:", req.user._id);
    console.log("💰 Amount:", amount);
    console.log("📋 Payment Type:", paymentType);
    console.log("🔢 Cycle Number:", cycleNumber);

    // Create pending payment record
    const payment = await Payment.create({
      member_id: recipientId, // Payment credited to recipient (or self if no recipient)
      paid_by: payerId, // Who actually paid (payer's phone receives STK)
      phone: phone,
      amount: parseFloat(amount),
      cycle_number: cycleNumber,
      status: "pending",
      type: paymentType, // Use the type from request body
      payment_method: recipientMemberId ? "qr_transfer" : "lipia", // QR transfer if paying for another
      mpesa_transaction_id: reference,
      checkout_request_id: result.checkoutRequestID,
      merchant_request_id: result.merchantRequestID,
      notes: notes || description,
      date: new Date(),
    });

    console.log("💾 Payment record created successfully!");
    console.log("   Payment ID:", payment._id);
    console.log("   checkout_request_id:", payment.checkout_request_id);
    console.log("   Status:", payment.status);

    res.json({
      success: true,
      message: result.customerMessage,
      ResponseCode: result.responseCode,
      ResponseDescription: result.responseDescription,
      CheckoutRequestID: result.checkoutRequestID,
      TransactionReference: result.checkoutRequestID, // For status queries
      MerchantRequestID: result.merchantRequestID,
      CustomerMessage: result.customerMessage,
      paymentId: payment._id,
    });
  } catch (error) {
    console.error("STK Push error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/lipia/query-status
 * @desc    Query payment status from Lipia Online
 * @access  Protected
 */
router.post("/query-status", protect, async (req, res) => {
  try {
    const { checkoutRequestID, transactionReference } = req.body;
    const reference = transactionReference || checkoutRequestID;

    console.log("🔍 ============ QUERY STATUS REQUEST ============");
    console.log("📥 Request body:", JSON.stringify(req.body, null, 2));
    console.log("🔑 CheckoutRequestID:", checkoutRequestID);
    console.log("🔑 TransactionReference:", transactionReference);
    console.log("🔑 Using reference:", reference);

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: "TransactionReference or CheckoutRequestID is required",
      });
    }

    console.log("📞 Calling Lipia API to check status...");
    const result = await queryLipiaPaymentStatus(reference);

    console.log("📊 ============ LIPIA API RESPONSE ============");
    console.log("✅ Success:", result.success);
    console.log("📌 Status:", result.status);
    console.log("🔢 ResultCode:", result.resultCode);
    console.log("💳 M-Pesa Receipt:", result.mpesaReceiptNumber);
    console.log("💰 Amount:", result.amount);
    console.log("📱 Phone:", result.phoneNumber);
    console.log("📅 Transaction Date:", result.transactionDate);
    console.log("📝 Full result:", JSON.stringify(result, null, 2));

    if (!result.success) {
      console.log("❌ Lipia API returned failure");
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    // Update payment status if completed - check multiple success indicators
    console.log("🔍 Checking if payment is completed...");
    console.log("   Status === 'completed'?", result.status === "completed");
    console.log("   ResultCode === '0'?", result.resultCode === "0");
    console.log("   ResultCode === 0?", result.resultCode === 0);
    console.log("   Has M-Pesa Receipt?", !!result.mpesaReceiptNumber);
    console.log("   M-Pesa Receipt value:", result.mpesaReceiptNumber);

    if (
      result.status === "completed" ||
      result.resultCode === "0" ||
      result.resultCode === 0 ||
      result.mpesaReceiptNumber
    ) {
      console.log("✅ Payment is COMPLETED! Updating database...");
      console.log(
        "🔍 Looking for payment with checkout_request_id:",
        checkoutRequestID
      );

      // Use atomic update with condition to prevent race conditions
      // Only update if deposit_processed is false (hasn't been processed yet)
      const payment = await Payment.findOneAndUpdate(
        { 
          checkout_request_id: checkoutRequestID,
          deposit_processed: { $ne: true } // Only process if not already processed
        },
        {
          status: "completed",
          mpesa_transaction_id:
            result.mpesaReceiptNumber ||
            result.transactionId ||
            checkoutRequestID,
          transaction_date: result.transactionDate || new Date(),
          deposit_processed: true, // Mark as processed atomically
        },
        { new: true }
      );

      if (!payment) {
        // Check if payment exists but was already processed (race condition prevention)
        const existingPayment = await Payment.findOne({ checkout_request_id: checkoutRequestID });
        
        if (existingPayment && existingPayment.deposit_processed) {
          console.log("⚠️ Payment already processed by another request (race condition prevented)");
          console.log("   Payment ID:", existingPayment._id);
          console.log("   checkout_request_id:", checkoutRequestID);
          return res.json({
            success: true,
            status: "completed",
            ResultCode: "0",
            ResultDescription: "Transaction already processed",
            MpesaReceiptNumber: existingPayment.mpesa_transaction_id,
          });
        }

        console.error("❌❌❌ PAYMENT NOT FOUND! ❌❌❌");
        console.error(
          "   Searched for checkout_request_id:",
          checkoutRequestID
        );
        console.error(
          "   This means the Payment record doesn't exist in database"
        );
        console.error(
          "   Check if STK push created the payment record properly"
        );

        // Try to find any payment with similar reference
        const anyPayment = await Payment.findOne({
          $or: [
            {
              mpesa_transaction_id: {
                $regex: checkoutRequestID,
                $options: "i",
              },
            },
            { merchant_request_id: checkoutRequestID },
          ],
        });

        if (anyPayment) {
          console.log("🔍 Found payment with different field:", {
            _id: anyPayment._id,
            checkout_request_id: anyPayment.checkout_request_id,
            mpesa_transaction_id: anyPayment.mpesa_transaction_id,
            merchant_request_id: anyPayment.merchant_request_id,
          });
        } else {
          console.log(
            "🔍 No payment found at all with any reference to:",
            checkoutRequestID
          );
        }

        return res.json({
          success: true,
          status: result.status,
          ResultCode: result.resultCode,
          message: "Payment record not found in database",
        });
      }

      console.log("✅✅✅ PAYMENT FOUND AND UPDATED! ✅✅✅");
      console.log("💾 Payment ID:", payment._id);
      console.log("👤 Member ID:", payment.member_id);
      console.log("💰 Amount:", payment.amount);
      console.log("📋 Type:", payment.type);
      console.log("✔️ Status:", payment.status);

      if (payment.status === "completed") {
        console.log("✅ Payment completed via query-status:", {
          paymentId: payment._id,
          type: payment.type,
          amount: payment.amount,
        });

        const member = await Member.findById(payment.member_id);

        // Handle based on payment type
        if (payment.type === "wallet_deposit") {
          console.log("💰 Processing wallet deposit for query-status:");
          console.log("   Payment ID:", payment._id);
          console.log("   Member ID:", payment.member_id);
          console.log("   Payment Amount:", payment.amount);
          console.log("   Payment Amount Type:", typeof payment.amount);
          console.log("   Full Payment Object:", JSON.stringify(payment, null, 2));
          
          // Wallet deposit - create Saving record
          const Saving = (await import("../models/Saving.js")).default;

          // Check if this transaction already exists (prevent duplicates)
          const existingSaving = await Saving.findOne({
            member_id: payment.member_id,
            transaction_ref: result.mpesaReceiptNumber,
            transaction_type: "deposit"
          });

          if (existingSaving) {
            console.log("⚠️ Deposit already recorded for transaction:", result.mpesaReceiptNumber);
            return res.json({
              success: true,
              status: "completed",
              ResultCode: "0",
              ResultDescription: "Transaction already processed",
              MpesaReceiptNumber: result.mpesaReceiptNumber,
            });
          }

          const lastSaving = await Saving.findOne({
            member_id: payment.member_id,
          }).sort({ created_at: -1 });
          const balanceBefore = lastSaving ? lastSaving.balance_after : 0;
          const depositAmount = parseFloat(payment.amount) || 0;
          const balanceAfter = balanceBefore + depositAmount;

          console.log("   Balance before:", balanceBefore);
          console.log("   Deposit amount (parsed):", depositAmount);
          console.log("   Balance after:", balanceAfter);

          // Calculate unlock date if lock period is specified
          let unlockDate = null;
          const lockPeriod = payment.lock_period_months || 0;
          if (lockPeriod > 0) {
            unlockDate = new Date();
            unlockDate.setMonth(unlockDate.getMonth() + lockPeriod);
          }

          // Use try-catch to handle unique index constraint violation (race condition fallback)
          let savingRecord;
          try {
            savingRecord = await Saving.create({
              member_id: payment.member_id,
              amount: depositAmount,
              transaction_type: "deposit",
              balance_before: balanceBefore,
              balance_after: balanceAfter,
              status: "completed",
              payment_method: "mpesa",
              transaction_ref: result.mpesaReceiptNumber,
              notes: `Wallet deposit via M-Pesa - ${result.mpesaReceiptNumber}${lockPeriod > 0 ? ` | Locked for ${lockPeriod} months` : ''}`,
              lock_period_months: lockPeriod,
              unlock_date: unlockDate,
              maturity_status: lockPeriod > 0 ? "locked" : "none",
              created_at: new Date(),
            });
          } catch (createError) {
            // Handle duplicate key error (E11000) - this means another request already created the record
            if (createError.code === 11000) {
              console.log("⚠️ Duplicate key error - deposit already recorded:", result.mpesaReceiptNumber);
              return res.json({
                success: true,
                status: "completed",
                ResultCode: "0",
                ResultDescription: "Transaction already processed (duplicate prevented)",
                MpesaReceiptNumber: result.mpesaReceiptNumber,
              });
            }
            throw createError; // Re-throw if it's a different error
          }

          console.log("✅ Saving record created:", {
            id: savingRecord._id,
            amount: savingRecord.amount,
            balance_after: savingRecord.balance_after,
            created_at: savingRecord.created_at,
          });

          await Member.findByIdAndUpdate(payment.member_id, {
            $inc: { total_savings: depositAmount },
          });

          console.log("✅ Wallet deposit completed:", {
            member: member?.name,
            amount: depositAmount,
            newBalance: balanceAfter,
            savingId: savingRecord._id,
          });

          // Emit Socket.IO events
          const io = req.app.get("io");
          if (io) {
            io.emit("payment:completed", {
              memberId: payment.member_id.toString(),
              checkoutRequestID: payment.checkout_request_id,
              mpesaReceiptNumber: result.mpesaReceiptNumber,
              payment: {
                _id: payment._id,
                amount: payment.amount,
                status: "completed",
              },
              amount: payment.amount,
              type: "wallet_deposit",
            });

            io.emit("saving:new", {
              memberId: payment.member_id.toString(),
              saving: savingRecord,
              member: member?.name,
            });

            io.emit("savingDeposit", {
              memberId: payment.member_id.toString(),
              amount: payment.amount,
              newBalance: balanceAfter,
            });
          }
        } else if (payment.type === "cycle_payment") {
          // Cycle payment - update member and cycle stats
          // Split payment: KES 200 cycle, KES 20 credit, KES 4 transaction fees
          const cycleAmount = 200;
          const creditAmount = 20;
          const feeAmount = 4;
          
          await Member.findByIdAndUpdate(payment.member_id, {
            payment_status: "paid",
            payment_date: new Date(),
            amount: payment.amount,
            $inc: { 
              total_contributed: payment.amount,
              total_cycle_contribution: cycleAmount,
              total_member_credit: creditAmount,
              total_transaction_fees: feeAmount,
            },
          });

          // Add member credit portion to reserve account (if enabled)
          try {
            const { addToReserve } = await import("../services/reserveAccountService.js");
            
            await addToReserve({
              amount: creditAmount,
              source_type: "cycle_contribution",
              description: `Member credit contribution from ${member?.name}: KES ${creditAmount}`,
              reference_type: "Payment",
              reference_id: payment._id.toString(),
              metadata: { 
                member_id: payment.member_id.toString(), 
                cycle_number: payment.cycle_number,
                total_payment: payment.amount,
              },
              is_automated: true,
            });

            console.log(`💰 Added KES ${creditAmount} to reserve from cycle member credit`);
          } catch (error) {
            console.error("Error adding cycle contribution to reserve:", error);
          }

          // Recalculate cycle stats from all completed payments
          const cycle = await Cycle.findOne({
            cycle_number: payment.cycle_number,
            status: "active",
          });

          if (cycle) {
            const payments = await Payment.find({
              cycle_number: payment.cycle_number,
              status: "completed",
            });
            const paidCount = new Set(
              payments.map((p) => p.member_id.toString())
            ).size;
            const totalCollected = payments.reduce(
              (sum, p) => sum + p.amount,
              0
            );

            cycle.paid_members_count = paidCount;
            cycle.total_amount_collected = totalCollected;
            await cycle.save();

            console.log("✅ Cycle payment completed:", {
              member: member?.name,
              amount: payment.amount,
              cycleNumber: payment.cycle_number,
              paidCount,
              totalCollected,
            });

            // Emit Socket.IO events
            const io = req.app.get("io");
            if (io) {
              const socketPayload = {
                memberId: payment.member_id.toString(), // Recipient (who got credited)
                payerId: payment.paid_by.toString(), // Payer (who actually paid)
                checkoutRequestID: payment.checkout_request_id,
                mpesaReceiptNumber: result.mpesaReceiptNumber,
                payment: {
                  _id: payment._id,
                  amount: payment.amount,
                  status: "completed",
                  cycle_number: payment.cycle_number,
                  payment_method: payment.payment_method,
                },
                amount: payment.amount,
                type: "cycle_payment",
                isQRPayment: payment.payment_method === "qr_transfer",
              };
              
              console.log("📡 Emitting payment:completed event:", JSON.stringify(socketPayload, null, 2));
              io.emit("payment:completed", socketPayload);

              io.emit("payment:new", payment);
              io.emit("cycle:updated", cycle);

              console.log("📡 Socket.IO events emitted for cycle payment");
            }
          }
        } else if (payment.type === "loan_repayment") {
          // Loan repayment - update loan payment history
          const Loan = (await import("../models/Loan.js")).default;

          // Extract loan ID from payment notes
          const loanIdMatch = payment.notes?.match(/loan ID: (.+)/);
          if (loanIdMatch) {
            const loanId = loanIdMatch[1];
            const loan = await Loan.findById(loanId).populate(
              "member_id",
              "name phone member_id"
            );

            if (loan) {
              // Add payment to loan history
              loan.payment_history.push({
                amount: payment.amount,
                payment_date: new Date(),
                payment_method: "mpesa",
                transaction_ref:
                  result.mpesaReceiptNumber || payment.mpesa_transaction_id,
                notes: `M-Pesa payment - ${result.mpesaReceiptNumber}`,
              });

              // Update paid amount
              loan.amount_paid = (loan.amount_paid || 0) + payment.amount;

              // Add interest portion to reserve account (97% of interest, excluding 3%)
              if (loan.interest_rate > 0) {
                const totalInterest = (loan.amount * loan.interest_rate) / 100;
                const totalRepayable = loan.amount + totalInterest;
                const previouslyPaid = loan.amount_paid - payment.amount;
                
                // Calculate interest portion of this payment
                let interestInThisPayment = 0;
                if (previouslyPaid < loan.amount) {
                  // Still paying principal, no interest yet
                  interestInThisPayment = Math.max(0, (previouslyPaid + payment.amount) - loan.amount);
                } else {
                  // All interest
                  interestInThisPayment = payment.amount;
                }
                
                if (interestInThisPayment > 0) {
                  try {
                    const { addToReserve } = await import("../services/reserveAccountService.js");
                    const { getReserveAccount } = await import("../services/reserveAccountService.js");
                    
                    // Get reserve config for interest percentage
                    const reserveAccount = await getReserveAccount();
                    const reservePercentage = reserveAccount.config.loan_interest_percentage || 97;
                    const reserveAmount = (interestInThisPayment * reservePercentage) / 100;
                    
                    await addToReserve({
                      amount: reserveAmount,
                      source_type: "loan_interest",
                      description: `Loan interest contribution (${reservePercentage}% of KES ${interestInThisPayment.toFixed(2)}) from ${loan.member_id.name}`,
                      reference_type: "Loan",
                      reference_id: loan._id.toString(),
                      metadata: { member_id: loan.member_id._id.toString(), interest_paid: interestInThisPayment },
                      is_automated: true,
                    });

                    console.log(`💰 Added KES ${reserveAmount.toFixed(2)} to reserve from loan interest`);
                  } catch (error) {
                    console.error("Error adding interest to reserve:", error);
                  }
                }
              }

              // Save will trigger pre-save hook to calculate remaining and update status
              await loan.save();

              console.log("✅ Loan repayment completed:", {
                member: loan.member_id?.name,
                loanId: loan._id,
                paymentAmount: payment.amount,
                totalPaid: loan.amount_paid,
                remaining: loan.amount_remaining,
                isFullyPaid: loan.status === "repaid",
              });

              // Emit Socket.IO event
              const io = req.app.get("io");
              if (io) {
                io.emit("loanPayment", {
                  loanId: loan._id,
                  memberId: loan.member_id._id,
                  memberName: loan.member_id.name,
                  paymentAmount: payment.amount,
                  totalPaid: loan.amount_paid,
                  remaining: loan.amount_remaining,
                  isFullyPaid: loan.status === "repaid",
                  timestamp: new Date(),
                });

                io.emit("payment:completed", {
                  memberId: payment.member_id.toString(),
                  payment: {
                    _id: payment._id,
                    amount: payment.amount,
                    status: "completed",
                  },
                  amount: payment.amount,
                  type: "loan_repayment",
                });

                console.log("📡 Socket.IO events emitted for loan repayment");
              }
            }
          }
        }
      }
    }

    res.json({
      success: true,
      status: result.status,
      ResultCode:
        result.status === "completed" ? "0" : result.resultCode || "pending",
      ResultDescription:
        result.resultDescription ||
        result.resultDesc ||
        "Payment query completed",
      MpesaReceiptNumber: result.mpesaReceiptNumber || result.transactionId,
      TransactionDate: result.transactionDate,
      PhoneNumber: result.phoneNumber,
      Amount: result.amount,
      data: result.data, // Include raw data for debugging
    });
  } catch (error) {
    console.error("Query status error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/lipia/send-money
 * @desc    Initiate disbursement - sends STK to admin's phone for authorization
 * @access  Protected (Admin only)
 */
router.post("/send-money", protect, async (req, res) => {
  try {
    console.log("💰 Disbursement request received");
    console.log("   User:", req.user?.name || req.user?._id);
    console.log("   Role:", req.user?.role);
    console.log("   UserRole:", req.userRole);
    console.log("   Permissions:", req.user?.permissions);

    // Check if user is admin using userRole from middleware
    if (req.userRole !== "admin") {
      console.error("❌ Unauthorized disbursement attempt");
      console.error("   UserRole:", req.userRole);
      console.error("   User Role:", req.user?.role);
      return res.status(403).json({
        success: false,
        error: "Unauthorized. Admin access required.",
      });
    }

    const { recipientPhone, amount, recipientId, notes } = req.body;

    console.log("📋 Disbursement details:", {
      recipientPhone,
      amount,
      recipientId,
      notes,
    });

    if (!recipientPhone || !amount || !recipientId) {
      console.error("❌ Missing required fields for disbursement");
      return res.status(400).json({
        success: false,
        error: "Recipient phone, amount, and recipientId are required",
      });
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error("❌ Invalid amount:", amount);
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
      });
    }

    // Get active cycle for cycle_number
    const activeCycle = await Cycle.findOne({ status: "active" });
    if (!activeCycle) {
      console.error("❌ No active cycle found");
      return res.status(400).json({
        success: false,
        error: "No active cycle found",
      });
    }

    console.log("✅ Active cycle found:", activeCycle.cycle_number);

    // Get admin's phone number for STK Push authorization
    // req.user is already the admin object from the protect middleware
    const admin = req.user;
    if (!admin) {
      console.error("❌ Admin information not found in request");
      return res.status(400).json({
        success: false,
        error: "Admin information not found",
      });
    }

    // Use specific phone number for disbursement authorization
    // This is the phone that will receive the STK Push to authorize disbursement
    const authorizationPhone = "0741255534";

    console.log("📱 Authorization phone set to:", authorizationPhone);

    // Generate unique reference for the disbursement
    const reference = `SMCF-DISBURSEMENT-${Date.now()}`;

    console.log("🔑 Generated reference:", reference);

    // Send STK Push to authorization phone for approval
    console.log("📤 Initiating STK Push to authorization phone...");

    const result = await initiateLipiaPayment(
      authorizationPhone,
      parsedAmount,
      reference,
      `Authorize disbursement of KSh ${parsedAmount} to member`
    );

    console.log("📥 Lipia response received:", result);

    if (!result.success) {
      console.error("❌ Lipia STK Push failed:", result.error);
      return res.status(400).json({
        success: false,
        error: result.error || "Failed to initiate STK Push",
        responseDescription: result.responseDescription,
      });
    }

    console.log("✅ STK Push initiated successfully");

    // Create PENDING disbursement record (will be completed after admin authorizes)
    console.log("💾 Creating disbursement record...");

    const disbursement = await Payment.create({
      member_id: recipientId,
      phone: recipientPhone, // Recipient's phone (for records)
      amount: parsedAmount,
      cycle_number: activeCycle.cycle_number,
      status: "pending",
      payment_type: "disbursement",
      transaction_reference: reference,
      checkout_request_id: result.checkoutRequestID, // Store Lipia's checkout ID
      merchant_request_id: result.merchantRequestID,
      date: new Date(),
      notes: notes || `Disbursement to member`,
    });

    console.log("✅ Disbursement record created:", disbursement._id);

    console.log(
      `📱 STK Push sent to ${authorizationPhone} for disbursement authorization`
    );
    console.log(
      `💰 Amount: KSh ${parsedAmount} to recipient: ${recipientPhone}`
    );
    console.log(`🔍 CheckoutRequestID: ${result.checkoutRequestID}`);

    res.json({
      success: true,
      message: "STK Push sent to admin for authorization",
      transactionReference: result.checkoutRequestID, // Use Lipia's checkout ID for queries
      disbursementId: disbursement._id,
      adminPhone: authorizationPhone,
      recipientPhone: recipientPhone,
      amount: parsedAmount,
      CheckoutRequestID: result.checkoutRequestID,
      MerchantRequestID: result.merchantRequestID,
    });
  } catch (error) {
    console.error("❌ Send money error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error during disbursement",
    });
  }
});

/**
 * @route   GET /api/lipia/next-recipient
 * @desc    Get the next member in line for disbursement
 * @access  Protected (Admin only)
 */
router.get("/next-recipient", protect, async (req, res) => {
  try {
    const activeCycle = await Cycle.findOne({ status: "active" }).populate(
      "next_recipient",
      "name member_id phone position total_received disbursement_status"
    );

    if (!activeCycle) {
      return res.status(404).json({
        success: false,
        error: "No active cycle found",
      });
    }

    // If no next recipient set, find the first member who hasn't received
    let nextRecipient = activeCycle.next_recipient;
    if (!nextRecipient) {
      nextRecipient = await Member.findOne({
        status: "active",
        disbursement_status: { $ne: "received" },
      }).sort({ disbursement_position: 1, position: 1 });

      if (nextRecipient) {
        activeCycle.next_recipient = nextRecipient._id;
        await activeCycle.save();
      }
    }

    // Get list of all members sorted by position
    const allMembers = await Member.find({ status: "active" })
      .select(
        "name member_id phone position total_received disbursement_status last_payout_date"
      )
      .sort({ position: 1 });

    res.json({
      success: true,
      cycle: {
        cycle_number: activeCycle.cycle_number,
        next_recipient: nextRecipient,
        recipient_paid: activeCycle.recipient_paid,
        disbursement_date: activeCycle.disbursement_date,
      },
      members: allMembers,
    });
  } catch (error) {
    console.error("❌ Disbursement initiation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to initiate disbursement",
    });
  }
});

/**
 * @route   POST /api/lipia/check-disbursement
 * @desc    Check disbursement status after admin authorizes STK
 * @access  Protected (Admin only)
 */
router.post("/check-disbursement", protect, async (req, res) => {
  try {
    const { transactionReference, disbursementId } = req.body;

    if (!transactionReference) {
      return res.status(400).json({
        success: false,
        error: "Transaction reference is required",
      });
    }

    // Query Lipia API for payment status
    const statusResult = await queryLipiaPaymentStatus(transactionReference);

    // Find the disbursement record
    const disbursement = await Payment.findById(disbursementId);
    if (!disbursement) {
      return res.status(404).json({
        success: false,
        error: "Disbursement record not found",
      });
    }

    // If Lipia API returns error or payment not found yet, treat as pending
    if (!statusResult.success || statusResult.status === "pending") {
      return res.json({
        success: true,
        status: "pending",
        message: "Waiting for admin authorization",
      });
    }

    // If payment is completed and disbursement is still pending
    if (
      statusResult.status === "completed" &&
      disbursement.status === "pending"
    ) {
      // Update disbursement record
      disbursement.status = "completed";
      disbursement.mpesa_transaction_id = statusResult.mpesaReceiptNumber;
      await disbursement.save();

      // Update member received amount and status
      const updatedMember = await Member.findByIdAndUpdate(
        disbursement.member_id,
        {
          $inc: { total_received: parseFloat(disbursement.amount) },
          last_payout_date: new Date(),
          last_payout_amount: parseFloat(disbursement.amount),
          disbursement_status: "received",
        },
        { new: true }
      );

      // Update active cycle and next recipient
      const activeCycle = await Cycle.findOne({ status: "active" });
      if (activeCycle) {
        activeCycle.recipient_paid = true;
        activeCycle.disbursement_date = new Date();

        // Find next member in queue who hasn't received yet
        const nextMember = await Member.findOne({
          status: "active",
          disbursement_status: { $ne: "received" },
          _id: { $ne: disbursement.member_id },
        }).sort({ disbursement_position: 1, position: 1 });

        if (nextMember) {
          activeCycle.next_recipient = nextMember._id;
          activeCycle.recipient_paid = false;
          await activeCycle.save();

          console.log(
            `✅ Next recipient set to: ${nextMember.name} (${nextMember.member_id})`
          );
        } else {
          // All members have received, cycle complete
          activeCycle.next_recipient = null;
          await activeCycle.save();
          console.log(
            "🎉 All members have received disbursements for this cycle!"
          );
        }

        // Emit real-time updates
        const io = req.app.get("io");
        if (io && updatedMember) {
          io.emit("disbursementCompleted", {
            memberId: disbursement.member_id,
            memberName: updatedMember.name,
            amount: parseFloat(disbursement.amount),
            phone: disbursement.phone,
            transactionId: statusResult.mpesaReceiptNumber,
            timestamp: new Date(),
          });

          io.emit("memberUpdated", {
            memberId: disbursement.member_id,
            total_received: updatedMember.total_received,
            last_payout_date: updatedMember.last_payout_date,
            last_payout_amount: updatedMember.last_payout_amount,
            disbursement_status: "received",
          });

          // Emit cycle update with next recipient info
          const updatedCycle = await Cycle.findOne({
            status: "active",
          }).populate("next_recipient", "name member_id phone position");

          if (updatedCycle) {
            io.emit("cycleUpdated", {
              cycle_number: updatedCycle.cycle_number,
              next_recipient: updatedCycle.next_recipient,
              recipient_paid: updatedCycle.recipient_paid,
              disbursement_date: updatedCycle.disbursement_date,
            });

            io.emit("nextRecipientUpdated", {
              nextRecipient: updatedCycle.next_recipient,
              previousRecipient: {
                name: updatedMember.name,
                memberId: updatedMember.member_id,
              },
            });
          }
        }
      }

      return res.json({
        success: true,
        status: "completed",
        message: "Disbursement completed successfully",
        mpesaReceiptNumber: statusResult.mpesaReceiptNumber,
        disbursement,
      });
    }

    // Return current status
    res.json({
      success: true,
      status: statusResult.status,
      message:
        statusResult.status === "pending"
          ? "Waiting for admin authorization"
          : "Payment failed",
    });
  } catch (error) {
    console.error("❌ Check disbursement error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to check disbursement status",
    });
  }
});

/**
 * @route   POST /api/lipia/callback
 * @desc    Handle payment callback from Lipia Online
 * @access  Public (webhook)
 */
router.post("/callback", async (req, res) => {
  try {
    console.log("Lipia callback received:", JSON.stringify(req.body, null, 2));

    const callbackData = processLipiaCallback(req.body);

    if (!callbackData.checkoutRequestID) {
      return res.status(400).json({
        success: false,
        error: "Invalid callback data",
      });
    }

    // Use atomic update to prevent race conditions - only process if not already processed
    const payment = await Payment.findOneAndUpdate(
      {
        checkout_request_id: callbackData.checkoutRequestID,
        deposit_processed: { $ne: true }, // Only process if not already processed
      },
      {
        status: callbackData.success ? "completed" : "failed",
        mpesa_transaction_id: callbackData.mpesaReceiptNumber,
        transaction_date: callbackData.transactionDate,
        deposit_processed: callbackData.success ? true : false, // Mark as processed atomically
      },
      { new: true }
    );

    if (!payment) {
      // Check if it was already processed
      const existingPayment = await Payment.findOne({
        checkout_request_id: callbackData.checkoutRequestID,
      });

      if (existingPayment && existingPayment.deposit_processed) {
        console.log("⚠️ Callback: Payment already processed (race condition prevented)");
        return res.json({
          success: true,
          ResultCode: "0",
          ResultDescription: "Transaction already processed",
        });
      }

      console.error(
        "Payment not found for callback:",
        callbackData.checkoutRequestID
      );
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    if (callbackData.success) {
      const member = await Member.findById(payment.member_id);

      // Handle based on payment type
      if (payment.type === "wallet_deposit") {
        console.log("💰 Processing wallet deposit for callback:");
        console.log("   Payment ID:", payment._id);
        console.log("   Member ID:", payment.member_id);
        console.log("   Payment Amount:", payment.amount);
        console.log("   Payment Amount Type:", typeof payment.amount);
        
        // Wallet deposit - create Saving record
        const Saving = (await import("../models/Saving.js")).default;

        // Double-check if this transaction already exists (belt and suspenders)
        const existingSaving = await Saving.findOne({
          member_id: payment.member_id,
          transaction_ref: callbackData.mpesaReceiptNumber,
          transaction_type: "deposit"
        });

        if (existingSaving) {
          console.log("⚠️ Deposit already recorded via callback for transaction:", callbackData.mpesaReceiptNumber);
          return res.json({
            success: true,
            ResultCode: "0",
            ResultDescription: "Transaction already processed",
          });
        }

        const lastSaving = await Saving.findOne({
          member_id: payment.member_id,
        }).sort({ created_at: -1 });
        const balanceBefore = lastSaving ? lastSaving.balance_after : 0;
        const depositAmount = parseFloat(payment.amount) || 0;
        const balanceAfter = balanceBefore + depositAmount;

        console.log("   Balance before:", balanceBefore);
        console.log("   Deposit amount (parsed):", depositAmount);
        console.log("   Balance after:", balanceAfter);

        // Calculate unlock date if lock period is specified
        let unlockDate = null;
        const lockPeriod = payment.lock_period_months || 0;
        if (lockPeriod > 0) {
          unlockDate = new Date();
          unlockDate.setMonth(unlockDate.getMonth() + lockPeriod);
        }

        // Use try-catch to handle unique index constraint violation (race condition fallback)
        let savingRecord;
        try {
          savingRecord = await Saving.create({
            member_id: payment.member_id,
            amount: depositAmount,
            transaction_type: "deposit",
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            status: "completed",
            payment_method: "mpesa",
            transaction_ref: callbackData.mpesaReceiptNumber,
            notes: `Wallet deposit via M-Pesa - ${callbackData.mpesaReceiptNumber}${lockPeriod > 0 ? ` | Locked for ${lockPeriod} months` : ''}`,
            lock_period_months: lockPeriod,
            unlock_date: unlockDate,
            maturity_status: lockPeriod > 0 ? "locked" : "none",
            created_at: new Date(),
          });
        } catch (createError) {
          // Handle duplicate key error (E11000) - this means another request already created the record
          if (createError.code === 11000) {
            console.log("⚠️ Callback: Duplicate key error - deposit already recorded:", callbackData.mpesaReceiptNumber);
            return res.json({
              success: true,
              ResultCode: "0",
              ResultDescription: "Transaction already processed (duplicate prevented)",
            });
          }
          throw createError; // Re-throw if it's a different error
        }

        console.log("✅ Saving record created via callback:", {
          id: savingRecord._id,
          amount: savingRecord.amount,
          balance_after: savingRecord.balance_after,
          created_at: savingRecord.created_at,
        });

        await Member.findByIdAndUpdate(payment.member_id, {
          $inc: { total_savings: depositAmount },
        });

        console.log("✅ Wallet deposit completed via callback:", {
          member: member?.name,
          amount: depositAmount,
          newBalance: balanceAfter,
          savingId: savingRecord._id,
        });

        // Emit Socket.IO events
        const io = req.app.get("io");
        if (io) {
          io.emit("payment:completed", {
            memberId: payment.member_id.toString(),
            checkoutRequestID: payment.checkout_request_id,
            mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
            payment: {
              _id: payment._id,
              amount: payment.amount,
              status: "completed",
            },
            amount: payment.amount,
            type: "wallet_deposit",
          });

          io.emit("saving:new", {
            memberId: payment.member_id.toString(),
            saving: savingRecord,
            member: member?.name,
          });

          io.emit("savingDeposit", {
            memberId: payment.member_id.toString(),
            amount: payment.amount,
            newBalance: balanceAfter,
          });
        }
      } else if (payment.type === "cycle_payment") {
        // Cycle payment - update member and cycle stats
        // Split payment: KES 200 cycle, KES 20 credit, KES 4 transaction fees
        const cycleAmount = 200;
        const creditAmount = 20;
        const feeAmount = 4;
        
        const updatedMember = await Member.findByIdAndUpdate(
          payment.member_id,
          {
            payment_status: "paid",
            $inc: { 
              total_contributed: payment.amount,
              total_cycle_contribution: cycleAmount,
              total_member_credit: creditAmount,
              total_transaction_fees: feeAmount,
            },
          },
          { new: true }
        );

        // Update cycle stats
        const updatedCycle = await Cycle.findOneAndUpdate(
          { cycle_number: payment.cycle_number, status: "active" },
          {
            $inc: {
              paid_members_count: 1,
              total_amount_collected: payment.amount,
            },
          },
          { new: true }
        );

        console.log(
          "Payment completed successfully:",
          callbackData.mpesaReceiptNumber
        );

        // Emit Socket.IO events for real-time updates
        const io = req.app.get("io");
        if (io) {
          console.log("💰 Callback - Broadcasting real-time payment updates");

          io.emit("paymentCompleted", {
            paymentId: payment._id,
            memberId: payment.member_id.toString(),
            payerId: payment.paid_by.toString(),
            amount: payment.amount,
            transactionId: callbackData.mpesaReceiptNumber,
            timestamp: new Date(),
            isQRPayment: payment.payment_method === "qr_transfer",
            type: "cycle_payment",
          });

          io.emit("payment:completed", {
            memberId: payment.member_id.toString(),
            payerId: payment.paid_by.toString(),
            checkoutRequestID: payment.checkout_request_id,
            mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
            payment: {
              _id: payment._id,
              amount: payment.amount,
              status: "completed",
              cycle_number: payment.cycle_number,
              payment_method: payment.payment_method,
            },
            amount: payment.amount,
            type: "cycle_payment",
            isQRPayment: payment.payment_method === "qr_transfer",
          });

          io.emit("memberUpdated", {
            memberId: updatedMember._id,
            name: updatedMember.name,
            payment_status: "paid",
            total_contributed: updatedMember.total_contributed,
          });

          if (updatedCycle) {
            io.emit("cycleUpdated", {
              cycle_number: updatedCycle.cycle_number,
              paid_members_count: updatedCycle.paid_members_count,
              total_amount_collected: updatedCycle.total_amount_collected,
            });
          }
        }
      }
    } else {
      payment.status = "failed";
      payment.failure_reason = callbackData.resultDesc;
      await payment.save();

      console.log("Payment failed:", callbackData.resultDesc);

      // Emit payment failure event
      const io = req.app.get("io");
      if (io) {
        io.emit("paymentFailed", {
          paymentId: payment._id,
          memberId: payment.member_id,
          reason: callbackData.resultDesc,
          timestamp: new Date(),
        });
      }
    }

    res.json({
      success: true,
      message: "Callback processed",
    });
  } catch (error) {
    console.error("Callback processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
