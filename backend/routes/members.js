import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Member from "../models/Member.js";

const router = express.Router();

// Get all members (admin only)
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const members = await Member.find().sort({ position: 1, created_at: 1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single member
router.get("/:id", protect, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res
        .status(404)
        .json({ success: false, error: "Member not found" });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create member (admin only - this is how members are registered)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, phone, id_number, position, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Password is required",
      });
    }

    // Check if member with phone already exists
    const existingMember = await Member.findOne({ phone });
    if (existingMember) {
      return res.status(400).json({
        success: false,
        error: "Member with this phone number already exists",
      });
    }

    // Generate unique member ID
    const count = await Member.countDocuments();
    const member_id = `SMCF-${(count + 1).toString().padStart(4, "0")}`;

    const member = await Member.create({
      member_id,
      name,
      phone,
      password,
      id_number,
      position: position || count + 1,
      registered_by_admin: true,
      status: "active",
    });

    // Emit socket event
    if (req.app.get("io")) {
      req.app.get("io").emit("member:new", member);
    }

    res.status(201).json({ success: true, data: member });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update member
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const member = await Member.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!member) {
      return res
        .status(404)
        .json({ success: false, error: "Member not found" });
    }

    res.json({ success: true, data: member });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete member
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) {
      return res
        .status(404)
        .json({ success: false, error: "Member not found" });
    }
    res.json({ success: true, message: "Member deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reorder members
router.post("/reorder", protect, adminOnly, async (req, res) => {
  try {
    const updates = req.body; // Array of { id, position }

    const promises = updates.map(({ id, position }) =>
      Member.findByIdAndUpdate(id, { position }, { new: true })
    );

    await Promise.all(promises);

    res.json({ success: true, message: "Members reordered successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
