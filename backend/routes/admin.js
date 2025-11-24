import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Announcement from "../models/Announcement.js";
import Cycle from "../models/Cycle.js";
import Disbursement from "../models/Disbursement.js";
import Loan from "../models/Loan.js";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";

const router = express.Router();

// Check if any admin exists
router.get("/check-setup", async (req, res) => {
  try {
    const adminCount = await Admin.countDocuments();
    res.json({
      success: true,
      needsSetup: adminCount === 0,
      adminExists: adminCount > 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initial admin setup (only works if no admins exist)
router.post("/setup", async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    // Check if any admin already exists
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(400).json({
        success: false,
        error: "Admin already exists. Use change password instead.",
      });
    }

    // Validate input
    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, phone, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long",
      });
    }

    // Create first admin
    const admin = await Admin.create({
      name,
      phone,
      password, // Will be hashed by the model pre-save hook
      role: "admin",
      permissions: {
        manage_members: true,
        manage_payments: true,
        manage_loans: true,
        send_announcements: true,
        process_disbursements: true,
        view_reports: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password (requires authentication)
router.put("/change-password", protect, adminOnly, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters long",
      });
    }

    // Get admin with password field
    const admin = await Admin.findById(req.user._id).select("+password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found",
      });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset password by phone (for recovery - requires admin phone verification)
router.post("/reset-password", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;

    // Validate input
    if (!phone || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Phone and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long",
      });
    }

    // In production, you should verify this is the actual admin via SMS OTP
    // For now, we'll allow it but you should add verification

    const admin = await Admin.findOne({ phone });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin with this phone number not found",
      });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current admin profile
router.get("/profile", protect, adminOnly, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found",
      });
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update admin profile
router.put("/profile", protect, adminOnly, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const admin = await Admin.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found",
      });
    }

    if (name) admin.name = name;
    if (phone) admin.phone = phone;

    await admin.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset all data except admin (DANGEROUS - requires authentication)
router.post("/reset-database", protect, async (req, res) => {
  try {
    console.log("🔄 Starting database reset...");
    console.log("👤 User role:", req.userRole);
    console.log("👤 User:", JSON.stringify(req.user, null, 2));
    console.log("👤 Admin:", JSON.stringify(req.admin, null, 2));

    // Check if user is admin - check multiple ways
    const isAdmin =
      req.admin ||
      req.userRole === "admin" ||
      req.user?.role === "admin" ||
      req.user?.role === "superadmin" ||
      req.user?.role === "treasurer";

    if (!isAdmin) {
      console.log("❌ Access denied - user is not admin");
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    console.log("✅ Admin access verified");

    const { confirm } = req.body;
    if (confirm !== "DELETE_ALL_DATA") {
      return res.status(400).json({
        success: false,
        error:
          'Please confirm by sending { "confirm": "DELETE_ALL_DATA" } in the request body',
      });
    }

    // Delete all collections except Admin
    const membersDeleted = await Member.deleteMany({});
    const paymentsDeleted = await Payment.deleteMany({});
    const cyclesDeleted = await Cycle.deleteMany({});
    const loansDeleted = await Loan.deleteMany({});
    const disbursementsDeleted = await Disbursement.deleteMany({});
    const announcementsDeleted = await Announcement.deleteMany({});

    console.log("✅ Database reset complete:");
    console.log(`  - Members deleted: ${membersDeleted.deletedCount}`);
    console.log(`  - Payments deleted: ${paymentsDeleted.deletedCount}`);
    console.log(`  - Cycles deleted: ${cyclesDeleted.deletedCount}`);
    console.log(`  - Loans deleted: ${loansDeleted.deletedCount}`);
    console.log(
      `  - Disbursements deleted: ${disbursementsDeleted.deletedCount}`
    );
    console.log(
      `  - Announcements deleted: ${announcementsDeleted.deletedCount}`
    );
    console.log("  - Admin data preserved ✓");

    res.json({
      success: true,
      message: "Database reset successfully. All data deleted except admin.",
      deletedCounts: {
        members: membersDeleted.deletedCount,
        payments: paymentsDeleted.deletedCount,
        cycles: cyclesDeleted.deletedCount,
        loans: loansDeleted.deletedCount,
        disbursements: disbursementsDeleted.deletedCount,
        announcements: announcementsDeleted.deletedCount,
      },
    });
  } catch (error) {
    console.error("❌ Database reset failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset database",
      details: error.message,
    });
  }
});

export default router;
