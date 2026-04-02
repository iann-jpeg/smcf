import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Announcement from "../models/Announcement.js";

const router = express.Router();

// Get all announcements
router.get("/", protect, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate("created_by", "name role")
      .sort({ created_at: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create announcement (admin only)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { title, message, priority } = req.body;

    // Validate required fields
    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // Get admin ID from req.admin or req.user (both are set by protect middleware)
    const adminId = req.admin?._id || req.user?._id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication failed",
      });
    }

    console.log("📢 Creating announcement by admin:", adminId);

    const announcement = await Announcement.create({
      title: title || "Announcement",
      message: message.trim(),
      priority: priority || "medium",
      created_by: adminId,
    });

    // Populate the announcement before emitting
    const populatedAnnouncement = await Announcement.findById(
      announcement._id
    ).populate("created_by", "name role");

    console.log("✅ Announcement created:", populatedAnnouncement._id);

    // Emit socket event to all connected clients
    const io = req.app.get("io");
    if (io) {
      io.emit("announcementCreated", populatedAnnouncement);
      console.log(
        "📢 New announcement broadcasted:",
        populatedAnnouncement.message.substring(0, 50)
      );
    } else {
      console.warn("⚠️ Socket.IO not available for broadcasting");
    }

    res.status(201).json({ success: true, data: populatedAnnouncement });
  } catch (error) {
    console.error("❌ Announcement creation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete announcement
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res
        .status(404)
        .json({ success: false, error: "Announcement not found" });
    }
    res.json({ success: true, message: "Announcement deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
