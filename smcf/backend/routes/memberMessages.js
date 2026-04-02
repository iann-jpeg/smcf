import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import MemberMessage from "../models/MemberMessage.js";

const router = express.Router();
const bridgeKey = String(process.env.SACCO_BRIDGE_KEY || "").trim();

function sanitize(value) {
  return String(value || "").trim();
}

// Public message submission from landing page
router.post("/public", async (req, res) => {
  try {
    const source = sanitize(req.body?.source) || "landing-page";
    const sender_name = sanitize(req.body?.sender_name);
    const sender_contact = sanitize(req.body?.sender_contact);
    const subject = sanitize(req.body?.subject);
    const message = sanitize(req.body?.message);

    if (!sender_name || !subject || !message) {
      return res.status(400).json({ success: false, error: "Name, subject, and message are required" });
    }

    const created = await MemberMessage.create({
      source: ["landing-page", "members-section", "member-dashboard"].includes(source) ? source : "landing-page",
      sender_name,
      sender_contact,
      subject,
      message,
      status: "new",
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("member-message:new", created);
    }

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Authenticated member/admin message submission
router.post("/", protect, async (req, res) => {
  try {
    const source = sanitize(req.body?.source) || "member-dashboard";
    const subject = sanitize(req.body?.subject);
    const message = sanitize(req.body?.message);

    if (!subject || !message) {
      return res.status(400).json({ success: false, error: "Subject and message are required" });
    }

    const senderName = sanitize(req.user?.name) || "Member";
    const senderContact = sanitize(req.user?.phone || req.user?.email || "");

    const created = await MemberMessage.create({
      source: ["landing-page", "members-section", "member-dashboard"].includes(source) ? source : "member-dashboard",
      member_id: req.userRole === "member" ? req.user?._id || null : null,
      sender_name: senderName,
      sender_contact: senderContact,
      subject,
      message,
      status: "new",
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("member-message:new", created);
    }

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Cross-app bridge feed for SACCO admin inbox
router.get("/bridge-feed", async (req, res) => {
  try {
    if (!bridgeKey) {
      return res.status(503).json({ success: false, error: "Bridge feed is not configured" });
    }

    const providedKey = String(req.headers["x-bridge-key"] || "").trim();
    if (!providedKey || providedKey !== bridgeKey) {
      return res.status(401).json({ success: false, error: "Invalid bridge key" });
    }

    const items = await MemberMessage.find()
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    const data = items.map((m) => ({
      _id: String(m._id),
      source: m.source,
      senderName: m.sender_name,
      senderContact: m.sender_contact,
      subject: m.subject,
      message: m.message,
      status: m.status,
      createdAt: m.created_at,
      readAt: m.read_at || null,
      origin: "main-smcf",
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin inbox
router.get("/", protect, adminOnly, async (_req, res) => {
  try {
    const messages = await MemberMessage.find()
      .sort({ created_at: -1 })
      .limit(100)
      .populate("member_id", "name member_id phone");

    return res.json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Mark message as read
router.patch("/:id/read", protect, adminOnly, async (req, res) => {
  try {
    const updated = await MemberMessage.findByIdAndUpdate(
      req.params.id,
      {
        status: "read",
        read_by: req.user?._id || null,
        read_at: new Date(),
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("member-message:read", { _id: updated._id, status: updated.status, read_at: updated.read_at });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
