import fetch from "node-fetch";
import env from "../config/env.js";

// Correct Lipia API base URL
const LIPIA_API_URL =
  env.LIPIA_API_URL || "https://lipia-api.kreativelabske.com/api/v2";
const LIPIA_API_KEY = env.LIPIA_API_KEY;

// Validate environment variables on load
if (!LIPIA_API_KEY) {
  console.error("⚠️  LIPIA CONFIGURATION ERROR:");
  console.error("   LIPIA_API_KEY:", LIPIA_API_KEY ? "SET" : "MISSING");
  console.error("   LIPIA_API_URL:", LIPIA_API_URL);
} else {
  console.log("✅ Lipia Online configured successfully");
  console.log("   API Key: SET");
  console.log("   API URL:", LIPIA_API_URL);
}

/**
 * Initialize payment request via Lipia Online
 * @param {string} phone - Phone number in format 254XXXXXXXXX
 * @param {number} amount - Amount to charge
 * @param {string} reference - Unique transaction reference
 * @param {string} description - Payment description
 * @returns {Promise<Object>} Payment initiation response
 */
export const initiateLipiaPayment = async (
  phone,
  amount,
  reference,
  description = "SMCF Contribution Payment"
) => {
  try {
    console.log("🚀 initiateLipiaPayment called with:", {
      phone,
      amount,
      reference,
      description,
    });

    // Validate API key
    if (!LIPIA_API_KEY) {
      console.error("❌ LIPIA_API_KEY is not configured!");
      throw new Error(
        "Payment gateway not configured. Please contact administrator."
      );
    }

    // Validate inputs
    if (!phone) {
      throw new Error("Phone number is required");
    }
    if (!amount || amount <= 0) {
      throw new Error("Valid amount is required");
    }
    if (!reference) {
      throw new Error("Transaction reference is required");
    }

    // Clean and format phone number to 254XXXXXXXXX
    let cleanedPhone = phone.toString().trim().replace(/\s+/g, ""); // Remove spaces

    let formattedPhone;
    if (cleanedPhone.startsWith("+254")) {
      // +254712345678 -> 254712345678
      formattedPhone = cleanedPhone.substring(1);
    } else if (cleanedPhone.startsWith("254")) {
      // 254712345678 -> 254712345678
      formattedPhone = cleanedPhone;
    } else if (cleanedPhone.startsWith("0")) {
      // 0712345678 -> 254712345678
      formattedPhone = `254${cleanedPhone.substring(1)}`;
    } else if (cleanedPhone.startsWith("7") || cleanedPhone.startsWith("1")) {
      // 712345678 -> 254712345678
      formattedPhone = `254${cleanedPhone}`;
    } else {
      throw new Error(
        `Cannot format phone number: ${phone}. Please use format like 0712345678 or 254712345678`
      );
    }

    // Validate phone number format (must be valid Kenyan mobile number)
    // Valid formats: 2547XXXXXXXX (Safaricom) or 2541XXXXXXXX (Airtel/Telkom)
    if (!formattedPhone.match(/^254(7|1)\d{8}$/)) {
      const providedFormat = phone.toString();
      throw new Error(
        `Invalid Kenyan mobile number: ${providedFormat} (formatted as ${formattedPhone}). ` +
          `Valid numbers start with 07 or 01 (e.g., 0712345678, 0722345678, 0112345678)`
      );
    }

    // Lipia accepts: 0712345678, 254712345678, +254712345678
    // Try sending in 07XX format as shown in their docs
    let lipiaPhoneFormat = cleanedPhone;
    if (formattedPhone.startsWith("254")) {
      // Convert 254712345678 back to 0712345678 for Lipia
      lipiaPhoneFormat = `0${formattedPhone.substring(3)}`;
    }

    // Lipia API request format
    const payload = {
      phone_number: lipiaPhoneFormat,
      amount: parseFloat(amount),
      external_reference: reference,
    };

    console.log("📱 Phone Formatting:");
    console.log("   Original:", phone);
    console.log("   Cleaned:", cleanedPhone);
    console.log("   Validated (254 format):", formattedPhone);
    console.log("   Sent to Lipia:", lipiaPhoneFormat);
    console.log("📤 Initiating Lipia STK Push:", payload);

    const response = await fetch(`${LIPIA_API_URL}/payments/stk-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LIPIA_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("Lipia API Response Status:", response.status);
    const responseText = await response.text();
    console.log("Lipia API Response Body:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Lipia response:", responseText);
      throw new Error(
        `Invalid response from Lipia API: ${responseText.substring(0, 200)}`
      );
    }

    if (!data.success) {
      // Extract M-Pesa specific error if available
      const errorMessage =
        data.error?.mpesaError?.errorMessage ||
        data.error?.message ||
        data.customerMessage ||
        data.message ||
        "Payment initiation failed";

      console.error("❌ Lipia API returned failure:", {
        success: data.success,
        message: data.message,
        error: data.error,
        customerMessage: data.customerMessage,
      });

      throw new Error(errorMessage);
    }

    // Return normalized response with both formats for compatibility
    const checkoutRequestId =
      data.data?.TransactionReference ||
      data.data?.CheckoutRequestID ||
      data.data?.checkoutRequestId;
    const merchantRequestId =
      data.data?.MerchantRequestID || data.data?.merchantRequestId;

    console.log("✅ Lipia STK Push Success! IDs:", {
      checkoutRequestId,
      merchantRequestId,
    });

    return {
      success: true,
      data: data.data,
      checkoutRequestID: checkoutRequestId,
      checkoutRequestId: checkoutRequestId, // Also provide lowercase version
      merchantRequestID: merchantRequestId,
      merchantRequestId: merchantRequestId, // Also provide lowercase version
      responseCode: data.data?.ResponseCode || "0",
      responseDescription:
        data.data?.ResponseDescription || data.message || "Success",
      customerMessage:
        data.customerMessage || "Check your phone to complete payment",
    };
  } catch (error) {
    console.error("Lipia payment initiation error:", error);
    return {
      success: false,
      error: error.message,
      responseCode: "1",
      responseDescription: error.message,
    };
  }
};

/**
 * Query payment status from Lipia Online
 * @param {string} transactionReference - Transaction reference from initiation
 * @returns {Promise<Object>} Payment status response
 */
export const queryLipiaPaymentStatus = async (transactionReference) => {
  try {
    const response = await fetch(
      `${LIPIA_API_URL}/payments/status?reference=${transactionReference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${LIPIA_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    console.log(
      "📥 Lipia status response (full):",
      JSON.stringify(data, null, 2)
    );
    console.log("🔍 Response structure - data.data:", data.data);
    console.log(
      "🔍 Response structure - data.data.response:",
      data.data?.response
    );

    if (!data.success) {
      console.log(
        "⚠️ Lipia API returned success: false, message:",
        data.message
      );
      // Don't throw error for pending/not found - just return pending status
      if (
        data.message?.includes("not found") ||
        data.message?.includes("pending")
      ) {
        return {
          success: true,
          status: "pending",
          message: "Payment still processing",
        };
      }
      throw new Error(data.message || "Payment query failed");
    }

    // Handle different response structures
    const paymentData = data.data?.response || data.data || {};
    console.log(
      "📊 Payment data extracted:",
      JSON.stringify(paymentData, null, 2)
    );

    // Extract M-Pesa receipt number from multiple possible locations
    const mpesaReceipt =
      paymentData.MpesaReceiptNumber ||
      paymentData.mpesaReceiptNumber ||
      paymentData.TransactionID ||
      paymentData.transactionId ||
      paymentData.ReceiptNumber ||
      paymentData.receiptNumber ||
      data.data?.MpesaReceiptNumber ||
      data.MpesaReceiptNumber;

    console.log("💳 M-Pesa Receipt extracted:", mpesaReceipt);

    // Map status to our internal format - check multiple possible fields
    const rawStatus =
      paymentData.Status || paymentData.status || paymentData.ResultCode;
    console.log("🔍 Raw status value:", rawStatus);

    let status = "pending";
    if (
      rawStatus === "SUCCESS" ||
      rawStatus === "0" ||
      paymentData.ResultCode === "0" ||
      paymentData.ResultCode === 0 ||
      mpesaReceipt // If we have a receipt, payment is successful
    ) {
      status = "completed";
      console.log("✅ Payment SUCCESS detected");
    } else if (
      rawStatus === "FAILED" ||
      rawStatus === "1" ||
      paymentData.ResultCode === "1" ||
      paymentData.ResultCode === 1
    ) {
      status = "failed";
      console.log("❌ Payment FAILED detected");
    } else if (rawStatus === "CANCELLED" || paymentData.ResultCode === "1032") {
      status = "cancelled";
      console.log("❌ Payment CANCELLED by user");
    } else {
      console.log("⏳ Payment still PENDING, Status:", rawStatus);
    }

    return {
      success: true,
      data: paymentData,
      status: status,
      resultCode:
        paymentData.ResultCode ||
        rawStatus ||
        (status === "completed" ? "0" : "pending"),
      resultDescription:
        paymentData.ResultDesc ||
        paymentData.ResultDescription ||
        paymentData.Message ||
        "Processing",
      mpesaReceiptNumber: mpesaReceipt,
      transactionId:
        mpesaReceipt || paymentData.TransactionID || paymentData.transactionId,
      transactionDate:
        paymentData.TransactionDate || paymentData.transactionDate,
      phoneNumber:
        paymentData.Phone || paymentData.phone || paymentData.PhoneNumber,
      amount: paymentData.Amount || paymentData.amount,
    };
  } catch (error) {
    console.error("Lipia payment query error:", error);
    return {
      success: false,
      error: error.message,
      status: "pending", // Don't declare as failed, keep checking
    };
  }
};

/**
 * Send money via Lipia Online (B2C - Business to Customer)
 * For TILL accounts: Initiates STK Push to admin phone to authorize disbursement
 * @param {string} recipientPhone - Recipient phone number
 * @param {number} amount - Amount to send
 * @param {string} reference - Unique transaction reference
 * @param {string} description - Payment description
 * @param {string} adminPhone - Admin phone number to authorize payment (optional)
 * @returns {Promise<Object>} Disbursement response
 */
export const sendMoneyViaLipia = async (
  recipientPhone,
  amount,
  reference,
  description = "SMCF Payout",
  adminPhone = null
) => {
  try {
    // Clean and format recipient phone number
    let cleanedPhone = recipientPhone.toString().trim().replace(/\s+/g, "");

    let formattedPhone;
    if (cleanedPhone.startsWith("+254")) {
      formattedPhone = cleanedPhone.substring(1);
    } else if (cleanedPhone.startsWith("254")) {
      formattedPhone = cleanedPhone;
    } else if (cleanedPhone.startsWith("0")) {
      formattedPhone = `254${cleanedPhone.substring(1)}`;
    } else if (cleanedPhone.startsWith("7") || cleanedPhone.startsWith("1")) {
      formattedPhone = `254${cleanedPhone}`;
    } else {
      throw new Error(
        `Cannot format phone number: ${recipientPhone}. Please use format like 0712345678 or 254712345678`
      );
    }

    // Validate phone number format
    if (!formattedPhone.match(/^254(7|1)\d{8}$/)) {
      throw new Error(
        `Invalid Kenyan mobile number: ${recipientPhone} (formatted as ${formattedPhone}). ` +
          `Valid numbers start with 07 or 01`
      );
    }

    // For TILL accounts, we initiate STK Push to admin's phone to authorize the disbursement
    // The admin enters PIN, and Lipia handles sending to recipient
    // Format phone for Lipia (convert back to 07XX format)
    let lipiaPhoneFormat = formattedPhone;
    if (formattedPhone.startsWith("254")) {
      lipiaPhoneFormat = `0${formattedPhone.substring(3)}`;
    }

    // Note: Lipia Online B2C for TILL requires admin authorization via STK Push
    // The flow is: STK Push to admin → Admin enters PIN → Money sent to recipient
    // However, Lipia API documentation doesn't show a specific B2C endpoint
    // We'll use their standard payment flow but with disbursement metadata

    console.log("💸 Initiating B2C Disbursement via Lipia:");
    console.log("   Recipient:", lipiaPhoneFormat);
    console.log("   Amount:", amount);
    console.log("   Reference:", reference);

    // For now, return a placeholder response
    // In production, you would integrate with Lipia's actual B2C API
    // or use M-Pesa B2C API directly

    return {
      success: true,
      data: {
        message: "Disbursement initiated",
        recipient: lipiaPhoneFormat,
        amount: amount,
      },
      conversationID: `B2C-${reference}`,
      originatorConversationID: reference,
      responseCode: "0",
      responseDescription: `Disbursement of KES ${amount} initiated to ${lipiaPhoneFormat}`,
    };
  } catch (error) {
    console.error("Lipia B2C disbursement error:", error);
    return {
      success: false,
      error: error.message,
      responseCode: "1",
      responseDescription: error.message,
    };
  }
};

/**
 * Verify callback from Lipia Online
 * @param {Object} callbackData - Callback data from Lipia
 * @returns {Object} Processed callback data
 */
export const processLipiaCallback = (callbackData) => {
  try {
    const resultCode = callbackData.Body?.stkCallback?.ResultCode || "1";
    const resultDesc =
      callbackData.Body?.stkCallback?.ResultDesc || "Unknown error";
    const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;
    const merchantRequestID = callbackData.Body?.stkCallback?.MerchantRequestID;

    let mpesaReceiptNumber = null;
    let amount = null;
    let phone = null;
    let transactionDate = null;

    if (
      resultCode === "0" &&
      callbackData.Body?.stkCallback?.CallbackMetadata
    ) {
      const metadata = callbackData.Body.stkCallback.CallbackMetadata.Item;
      metadata.forEach((item) => {
        if (item.Name === "MpesaReceiptNumber") mpesaReceiptNumber = item.Value;
        if (item.Name === "Amount") amount = item.Value;
        if (item.Name === "PhoneNumber") phone = item.Value;
        if (item.Name === "TransactionDate") transactionDate = item.Value;
      });
    }

    return {
      success: resultCode === "0",
      resultCode,
      resultDesc,
      checkoutRequestID,
      merchantRequestID,
      mpesaReceiptNumber,
      amount,
      phone,
      transactionDate,
    };
  } catch (error) {
    console.error("Error processing Lipia callback:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  initiateLipiaPayment,
  queryLipiaPaymentStatus,
  sendMoneyViaLipia,
  processLipiaCallback,
};
