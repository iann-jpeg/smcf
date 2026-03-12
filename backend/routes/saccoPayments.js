/**
 * SACCO Payment Bridge
 * Allows the SMCF SACCO portal frontend to initiate payments through the same
 * Lipia Online gateway used by the main SMCF app.
 *
 * Authentication: X-Sacco-Key header (configured via SACCO_API_KEY env var).
 * No member JWT is required — this endpoint is for cross-app payment tracking.
 */

import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// ── Model ──────────────────────────────────────────────────────────────────
// Lightweight log of payment initiations coming from the SACCO portal.
const saccoPaymentLogSchema = new mongoose.Schema({
  phone:       { type: String, required: true },
  amount:      { type: Number, required: true },
  type:        { type: String, default: "deposit" }, // deposit | loan_repay | share_subscribe
  description: { type: String },
  externalRef: { type: String }, // txnRef returned by sacco backend (if any)
  status:      { type: String, enum: ["initiated", "completed", "failed"], default: "initiated" },
  source:      { type: String, default: "sacco" },
  createdAt:   { type: Date,   default: Date.now },
});

// Compile lazily — model may already exist in hot-reload scenarios
const SaccoPaymentLog =
  mongoose.models.SaccoPaymentLog ||
  mongoose.model("SaccoPaymentLog", saccoPaymentLogSchema);

// ── Middleware: API-key guard ───────────────────────────────────────────────
function saccoApiKey(req, res, next) {
  const key = req.headers["x-sacco-key"];
  const expected = process.env.SACCO_API_KEY;

  if (!expected) {
    // No key configured — block all requests in production
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ success: false, error: "Payment bridge not configured" });
    }
    // In development, allow through with a warning
    console.warn("⚠️  SACCO_API_KEY not set — sacco payment bridge running in open mode");
    return next();
  }

  if (key !== expected) {
    return res.status(401).json({ success: false, error: "Unauthorized — invalid API key" });
  }
  next();
}

// ── POST /api/sacco-payments/initiate ─────────────────────────────────────
// Records a payment initiation from the SACCO portal and returns the
// Lipia payment link URL so the frontend can open it.
//
// Body: { phone, amount, type, description?, externalRef? }

router.post("/initiate", saccoApiKey, async (req, res) => {
  try {
    const { phone, amount, type, description, externalRef } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ success: false, error: "phone and amount are required" });
    }

    const num = Number(amount);
    if (!num || num < 1) {
      return res.status(400).json({ success: false, error: "amount must be a positive number" });
    }

    // Record the initiation in the main backend's DB
    await SaccoPaymentLog.create({
      phone: String(phone).trim(),
      amount: num,
      type: type || "deposit",
      description: description || `SMCF SACCO ${type || "payment"}`,
      externalRef: externalRef || null,
      status: "initiated",
      source: "sacco",
    });

    console.log(`💳 SACCO payment initiated — phone: ${phone}, amount: ${num}, type: ${type}`);

    return res.json({
      success: true,
      data: {
        lipiaPaymentUrl: "https://lipia-online.vercel.app/link/smcfholdings",
        till: "6938069",
        message: "Payment initiation recorded. Open the Lipia link to complete payment.",
      },
    });
  } catch (err) {
    console.error("❌ SACCO payment bridge error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/sacco-payments/health ────────────────────────────────────────
// Simple health check — lets the sacco frontend verify connectivity.

router.get("/health", saccoApiKey, (_req, res) => {
  res.json({ success: true, message: "SACCO payment bridge is online", till: "6938069" });
});

export default router;
