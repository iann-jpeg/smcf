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

    const announcement = await Announcement.create({
      title,
      message,
      priority: priority || "medium",
      created_by: req.admin._id,
    });

    // Populate the announcement before emitting
    const populatedAnnouncement = await Announcement.findById(
      announcement._id
    ).populate("created_by", "name role");

    // Emit socket event to all connected clients
    const io = req.app.get("io");
    if (io) {
      io.emit("announcementCreated", populatedAnnouncement);
      console.log(
        "📢 New announcement broadcasted:",
        populatedAnnouncement.message
      );
    }

    res.status(201).json({ success: true, data: populatedAnnouncement });
  } catch (error) {
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
