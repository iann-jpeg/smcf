import express from "express";
import { generateToken } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Member from "../models/Member.js";

const router = express.Router();

// Login with phone and password
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Phone and password are required" });
    }

    // Check if user is admin
    const admin = await Admin.findOne({ phone, is_active: true }).select(
      "+password"
    );
    if (admin) {
      const isPasswordValid = await admin.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      const token = generateToken(admin._id, admin.role);
      return res.json({
        success: true,
        role: "admin",
        token,
        user: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          role: admin.role,
          permissions: admin.permissions,
        },
      });
    }

    // Check if member exists and was registered by admin
    const member = await Member.findOne({ phone }).select("+password");
    if (!member) {
      return res.status(403).json({
        success: false,
        error: "Member not found. Please contact admin to register you first.",
      });
    }

    if (!member.registered_by_admin) {
      return res.status(403).json({
        success: false,
        error: "Your account needs to be activated by an admin.",
      });
    }

    if (member.status !== "active") {
      return res.status(403).json({
        success: false,
        error: "Your account is not active. Please contact admin.",
      });
    }

    const isPasswordValid = await member.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const token = generateToken(member._id, "member");
    res.json({
      success: true,
      role: "member",
      token,
      user: {
        _id: member._id,
        id: member._id,
        name: member.name,
        phone: member.phone,
        phoneNumber: member.phone,
        member_id: member.member_id,
        memberId: member.member_id,
        status: member.status,
        position: member.position,
        payment_status: member.payment_status || "pending",
        total_contributed: member.total_contributed || 0,
        total_received: member.total_received || 0,
        monthly_contribution: member.monthly_contribution || 204,
        join_date: member.join_date,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create initial admin (one-time setup)
router.post("/setup-admin", async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    // Check if any admin exists
    const existingAdmin = await Admin.findOne({});
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: "Admin already exists. Use normal login.",
      });
    }

    const admin = await Admin.create({
      name,
      phone,
      password,
      role: "superadmin",
      permissions: {
        canAddMembers: true,
        canEditMembers: true,
        canDeleteMembers: true,
        canDisburseFunds: true,
        canApproveLoans: true,
        canViewReports: true,
      },
    });

    const token = generateToken(admin._id, admin.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Setup admin error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
