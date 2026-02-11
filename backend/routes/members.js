import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Member from "../models/Member.js";

const router = express.Router();

// Mark member as paid for current cycle (no payment record)
router.put("/:id/mark-paid", protect, adminOnly, async (req, res) => {
  try {
    const { cycle_number, no_payment } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }
    
    // Prevent marking wallet-only members as paid for cycles
    if (member.member_type === "wallet_only") {
      return res.status(400).json({ 
        success: false, 
        error: "Wallet-only members do not participate in cycles" 
      });
    }
    
    // Check if member is already paid
    const wasPreviouslyPaid = member.payment_status === "paid";
    
    // Mark as paid for the current cycle
    member.payment_status = "paid";
    member.payment_date = new Date();
    await member.save();

    // Always create a payment record (even if no_payment is true)
    // This ensures the UI shows the member as paid
    const Payment = (await import("../models/Payment.js")).default;
    const existing = await Payment.findOne({ 
      member_id: member._id, 
      cycle_number, 
      type: "cycle_payment" 
    });
    
    if (!existing) {
      await Payment.create({
        member_id: member._id,
        amount: no_payment ? 0 : (member.monthly_contribution || 224),
        phone: member.phone,
        payment_method: "admin_manual",
        status: "completed",
        type: "cycle_payment",
        cycle_number,
        notes: no_payment 
          ? "Marked as paid by admin (no payment - waived)" 
          : "Marked as paid by admin (no payment)",
      });
    }

    // Update cycle paid members count
    const Cycle = (await import("../models/Cycle.js")).default;
    const cycle = await Cycle.findOne({ cycle_number, status: "active" });
    
    if (cycle) {
      // Recalculate paid members count from completed payments
      const payments = await Payment.find({
        cycle_number,
        status: "completed",
      });
      
      const paidCount = new Set(payments.map((p) => p.member_id.toString())).size;
      const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

      cycle.paid_members_count = paidCount;
      cycle.total_amount_collected = totalCollected;
      await cycle.save();
      
      console.log(`✅ Updated cycle #${cycle_number} stats:`, {
        paidCount,
        totalCollected,
        memberMarked: member.name,
        noPayment: no_payment
      });
    }

    // Emit socket events for real-time update across the system
    if (req.app.get("io")) {
      req.app.get("io").emit("memberUpdated", member);
      req.app.get("io").emit("member:paymentStatusChanged", {
        memberId: member._id,
        payment_status: "paid",
        cycle_number
      });
      req.app.get("io").emit("cycle:updated", {
        cycle_number,
        memberId: member._id,
        payment_status: "paid",
        paid_members_count: cycle?.paid_members_count,
        total_amount_collected: cycle?.total_amount_collected
      });
    }

    res.json({ success: true, data: member });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    console.log("📝 Creating new member with request body:", req.body);
    const { name, phone, id_number, position, password, member_type } = req.body;

    // Validate required fields
    if (!name || !phone) {
      console.error("❌ Missing required fields - name or phone");
      return res.status(400).json({
        success: false,
        error: "Name and phone are required",
      });
    }

    if (!password) {
      console.error("❌ Password is missing");
      return res.status(400).json({
        success: false,
        error: "Password is required",
      });
    }

    // Check if member with phone already exists
    const existingMember = await Member.findOne({ phone });
    if (existingMember) {
      console.error("❌ Member with phone already exists:", phone);
      return res.status(400).json({
        success: false,
        error: "Member with this phone number already exists",
      });
    }

    // Generate unique member ID - find ALL member IDs and get the highest number
    const allMembers = await Member.find().select("member_id").lean();
    
    console.log("📊 All existing member IDs:", allMembers.map(m => m.member_id));
    
    let maxNumber = 0;
    allMembers.forEach(member => {
      if (member.member_id) {
        const match = member.member_id.match(/SMCF-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    });
    
    // Try to find a unique ID, incrementing until we find one that doesn't exist
    let member_id = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!member_id && attempts < maxAttempts) {
      const tryNumber = maxNumber + 1 + attempts;
      const tryId = `SMCF-${tryNumber.toString().padStart(4, "0")}`;
      
      const exists = await Member.findOne({ member_id: tryId });
      if (!exists) {
        member_id = tryId;
        console.log("✅ Found unique member_id:", member_id, "after", attempts + 1, "attempts");
      } else {
        console.log("⚠️ ID", tryId, "already exists, trying next...");
        attempts++;
      }
    }
    
    if (!member_id) {
      console.error("❌ Could not generate unique member_id after", maxAttempts, "attempts");
      return res.status(500).json({
        success: false,
        error: "Could not generate unique member ID. Please try again.",
      });
    }

    // Create member data object
    const memberData = {
      member_id,
      name,
      phone,
      password,
      position: position || (maxNumber + 1 + attempts),
      registered_by_admin: true,
      status: "active",
      member_type: member_type || "regular", // Default to "regular" if not provided
    };

    // Only add id_number if it's provided and not empty
    if (id_number && id_number.trim() !== "") {
      memberData.id_number = id_number;
    }

    console.log("📦 Creating member with data:", { ...memberData, password: "[HIDDEN]" });

    const member = await Member.create(memberData);

    console.log("✅ Member created successfully with ID:", member._id);

    // Emit socket event
    if (req.app.get("io")) {
      req.app.get("io").emit("member:new", member);
    }

    // Update total_members in the active cycle
    const Cycle = (await import("../models/Cycle.js")).default;
    const activeCycle = await Cycle.findOne({ status: "active" });
    if (activeCycle) {
      // Only count regular members, exclude wallet_only members
      const totalMembers = await Member.countDocuments({ member_type: { $ne: "wallet_only" } });
      activeCycle.total_members = totalMembers;
      await activeCycle.save();
      // Emit socket event for real-time update
      if (req.app.get("io")) {
        req.app.get("io").emit("cycle:updated", activeCycle);
      }
    }

    res.status(201).json({ success: true, data: member });
  } catch (error) {
    console.error("❌ Error creating member:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    if (error.code === 11000) {
      // Duplicate key error
      console.error("Duplicate key error details:", error.keyValue);
      return res.status(400).json({
        success: false,
        error: "A member with this phone number or member ID already exists",
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update member
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const oldMember = await Member.findById(req.params.id);
    if (!oldMember) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }
    
    const wasPaymentStatusChanged = 
      req.body.payment_status && 
      req.body.payment_status !== oldMember.payment_status;
    
    // Update fields individually to ensure password hashing works
    const updateData = { ...req.body };
    
    // Apply updates to member document
    Object.keys(updateData).forEach(key => {
      oldMember[key] = updateData[key];
    });
    
    // Save will trigger pre-save hook for password hashing
    const member = await oldMember.save();

    if (!member) {
      return res
        .status(404)
        .json({ success: false, error: "Member not found" });
    }

    // If payment status was changed, update cycle stats
    if (wasPaymentStatusChanged) {
      const Cycle = (await import("../models/Cycle.js")).default;
      const Payment = (await import("../models/Payment.js")).default;
      
      // Get active cycle
      const activeCycle = await Cycle.findOne({ status: "active" });
      
      if (activeCycle) {
        // Recalculate paid members count from completed payments
        const payments = await Payment.find({
          cycle_number: activeCycle.cycle_number,
          status: "completed",
        });
        
        const paidCount = new Set(payments.map((p) => p.member_id.toString())).size;
        const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

        activeCycle.paid_members_count = paidCount;
        activeCycle.total_amount_collected = totalCollected;
        await activeCycle.save();
        
        console.log(`✅ Updated cycle #${activeCycle.cycle_number} stats after member update:`, {
          paidCount,
          totalCollected,
          memberUpdated: member.name,
          newStatus: member.payment_status
        });
        
        // Emit socket events for real-time update
        if (req.app.get("io")) {
          req.app.get("io").emit("cycle:updated", {
            cycle_number: activeCycle.cycle_number,
            memberId: member._id,
            payment_status: member.payment_status,
            paid_members_count: activeCycle.paid_members_count,
            total_amount_collected: activeCycle.total_amount_collected
          });
        }
      }
    }

    // Emit member updated event
    if (req.app.get("io")) {
      req.app.get("io").emit("memberUpdated", member);
      if (wasPaymentStatusChanged) {
        req.app.get("io").emit("member:paymentStatusChanged", {
          memberId: member._id,
          payment_status: member.payment_status
        });
      }
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

    // Update total_members in the active cycle
    const Cycle = (await import("../models/Cycle.js")).default;
    const activeCycle = await Cycle.findOne({ status: "active" });
    if (activeCycle) {
      const totalMembers = await Member.countDocuments();
      activeCycle.total_members = totalMembers;
      await activeCycle.save();
    }

    // Emit socket event for real-time update
    if (req.app.get("io")) {
      req.app.get("io").emit("member:deleted", { memberId: req.params.id });
      req.app.get("io").emit("cycle:updated", activeCycle);
    }

    res.json({ success: true, message: "Member deleted and cycle updated" });
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

// Upload profile picture
router.post("/upload-profile-picture", protect, async (req, res) => {
  try {
    const { profile_picture } = req.body; // Base64 image string
    
    if (!profile_picture) {
      return res.status(400).json({ 
        success: false, 
        error: "No profile picture provided" 
      });
    }

    // Validate base64 format
    if (!profile_picture.startsWith('data:image/')) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid image format" 
      });
    }

    // Get member ID from token (member can only update their own picture)
    const memberId = req.member ? req.member._id : req.body.member_id;
    
    const member = await Member.findByIdAndUpdate(
      memberId,
      { profile_picture },
      { new: true }
    );

    if (!member) {
      return res.status(404).json({ 
        success: false, 
        error: "Member not found" 
      });
    }

    // Emit socket event for real-time update
    if (req.app.get("io")) {
      req.app.get("io").emit("member:updated", { 
        memberId: member._id,
        profile_picture: member.profile_picture 
      });
    }

    res.json({ 
      success: true, 
      profile_picture: member.profile_picture,
      message: "Profile picture updated successfully" 
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
