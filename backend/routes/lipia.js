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
    const { phone, amount, cycleNumber } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({
        success: false,
        error: "Phone number and amount are required",
      });
    }

    // Generate unique reference
    const reference = `SMCF-${Date.now()}-${req.user._id}`;

    // Initiate payment via Lipia
    const result = await initiateLipiaPayment(
      phone,
      amount,
      reference,
      `SMCF Contribution - Cycle ${cycleNumber || "Current"}`
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        responseDescription: result.responseDescription,
      });
    }

    // Create pending payment record
    const payment = await Payment.create({
      member_id: req.user._id,
      phone: phone,
      amount: parseFloat(amount),
      cycle_number: cycleNumber,
      status: "pending",
      type: "cycle_payment", // Explicitly mark as cycle payment
      mpesa_transaction_id: reference,
      checkout_request_id: result.checkoutRequestID,
      merchant_request_id: result.merchantRequestID,
      date: new Date(),
    });

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

    console.log("🔍 Query-status request:", { checkoutRequestID, transactionReference, reference });

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: "TransactionReference or CheckoutRequestID is required",
      });
    }

    const result = await queryLipiaPaymentStatus(reference);

    console.log("📊 Query-status result:", {
      success: result.success,
      status: result.status,
      resultCode: result.resultCode,
      mpesaReceipt: result.mpesaReceiptNumber,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    // Update payment status if completed - check multiple success indicators
    if (result.status === "completed" || result.resultCode === "0" || result.mpesaReceiptNumber) {
      console.log("💳 Attempting to complete payment with checkoutRequestID:", checkoutRequestID);
      
      const payment = await Payment.findOneAndUpdate(
        { checkout_request_id: checkoutRequestID },
        {
          status: "completed",
          mpesa_transaction_id: result.mpesaReceiptNumber || checkoutRequestID,
          transaction_date: result.transactionDate || new Date(),
        },
        { new: true }
      );

      if (!payment) {
        console.error("❌ Payment not found with checkout_request_id:", checkoutRequestID);
        return res.json({
          success: true,
          status: result.status,
          ResultCode: result.resultCode,
          message: "Payment record not found",
        });
      }

      if (payment.status === "completed") {
        console.log("✅ Payment completed via query-status:", {
          paymentId: payment._id,
          type: payment.type,
          amount: payment.amount,
        });

        const member = await Member.findById(payment.member_id);

        // Handle based on payment type
        if (payment.type === "wallet_deposit") {
          // Wallet deposit - create Saving record
          const Saving = (await import("../models/Saving.js")).default;

          const lastSaving = await Saving.findOne({
            member_id: payment.member_id,
          }).sort({ created_at: -1 });
          const balanceBefore = lastSaving ? lastSaving.balance_after : 0;
          const balanceAfter = balanceBefore + payment.amount;

          const savingRecord = await Saving.create({
            member_id: payment.member_id,
            amount: payment.amount,
            transaction_type: "deposit",
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            status: "completed",
            payment_method: "mpesa",
            transaction_ref: result.mpesaReceiptNumber,
            notes: `Wallet deposit via M-Pesa - ${result.mpesaReceiptNumber}`,
          });

          await Member.findByIdAndUpdate(payment.member_id, {
            $inc: { total_savings: payment.amount },
          });

          console.log("✅ Wallet deposit completed:", {
            member: member?.name,
            amount: payment.amount,
            newBalance: balanceAfter,
          });

          // Emit Socket.IO events
          const io = req.app.get("io");
          if (io) {
            io.emit("payment:completed", {
              memberId: payment.member_id.toString(),
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
          await Member.findByIdAndUpdate(payment.member_id, {
            payment_status: "paid",
            payment_date: new Date(),
            amount: payment.amount,
            $inc: { total_contributed: payment.amount },
          });

          // Recalculate cycle stats from all completed payments
          const cycle = await Cycle.findOne({ 
            cycle_number: payment.cycle_number,
            status: "active"
          });
          
          if (cycle) {
            const payments = await Payment.find({
              cycle_number: payment.cycle_number,
              status: "completed",
            });
            const paidCount = new Set(payments.map((p) => p.member_id.toString())).size;
            const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

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
              io.emit("payment:completed", {
                memberId: payment.member_id.toString(),
                payment: {
                  _id: payment._id,
                  amount: payment.amount,
                  status: "completed",
                  cycle_number: payment.cycle_number,
                },
                amount: payment.amount,
                type: "cycle_payment",
              });

              io.emit("payment:new", payment);
              io.emit("cycle:updated", cycle);

              console.log("📡 Socket.IO events emitted for cycle payment");
            }
          }
        }
      }
    }

    res.json({
      success: true,
      status: result.status,
      ResultCode: result.status === "completed" ? "0" : result.resultCode,
      ResultDescription: result.resultDescription,
      MpesaReceiptNumber: result.mpesaReceiptNumber,
      TransactionDate: result.transactionDate,
      PhoneNumber: result.phoneNumber,
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

    // Update payment status
    const payment = await Payment.findOne({
      checkout_request_id: callbackData.checkoutRequestID,
    });

    if (!payment) {
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
      payment.status = "completed";
      payment.mpesa_transaction_id = callbackData.mpesaReceiptNumber;
      payment.transaction_date = callbackData.transactionDate;
      await payment.save();

      // Update member payment status
      const updatedMember = await Member.findByIdAndUpdate(
        payment.member_id,
        {
          payment_status: "paid",
          $inc: { total_contributed: payment.amount },
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
          memberId: payment.member_id,
          amount: payment.amount,
          transactionId: callbackData.mpesaReceiptNumber,
          timestamp: new Date(),
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
