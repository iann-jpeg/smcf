import express from "express";
import { generateToken } from "../middleware/auth.js";
import Admin from "../models/Admin.js";
import Member from "../models/Member.js";
import { trackLoginAttempt, createUserSession } from "../middleware/activityTracker.js";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "auth",
    timestamp: new Date().toISOString(),
  });
});

// Login with phone and password
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Phone and password are required" });
    }

    // Hardcoded viewer account - read-only admin access
    if (phone === "0700000000" && password === "smcf-0000") {
      const token = generateToken("viewer-readonly", "viewer");
      return res.json({
        success: true,
        role: "admin",
        token,
        user: {
          id: "viewer-readonly",
          name: "Read-Only Viewer",
          phone: "0700000000",
          role: "viewer",
          is_active: true,
          permissions: {
            canAddMembers: false,
            canEditMembers: false,
            canDeleteMembers: false,
            canDisburseFunds: false,
            canApproveLoans: false,
            canViewReports: true,
          },
        },
      });
    }

    // Check if user is admin
    const admin = await Admin.findOne({ phone, is_active: true }).select(
      "+password"
    );
    if (admin) {
      const isPasswordValid = await admin.comparePassword(password);
      if (!isPasswordValid) {
        // Track failed login attempt
        await trackLoginAttempt(phone, false, admin._id, 'Admin', req, 'invalid_credentials');
        
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Track successful login
      await trackLoginAttempt(phone, true, admin._id, 'Admin', req);
      
      // Create session
      const session = await createUserSession(admin._id, 'Admin', admin.role, req);

      const token = generateToken(admin._id, admin.role);
      return res.json({
        success: true,
        role: "admin",
        token,
        sessionId: session?._id,
        user: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          role: admin.role,
          is_active: admin.is_active,
          permissions: admin.permissions,
        },
      });
    }

    // Check if member exists and was registered by admin
    console.log("🔍 Looking for member with phone:", phone);
    const member = await Member.findOne({ phone }).select("+password");
    
    if (!member) {
      console.log("❌ Member not found with phone:", phone);
      
      // Track failed login attempt
      await trackLoginAttempt(phone, false, null, null, req, 'account_not_found');
      
      return res.status(403).json({
        success: false,
        error: "Member not found. Please contact admin to register you first.",
      });
    }

    console.log("✅ Member found:", {
      member_id: member.member_id,
      name: member.name,
      phone: member.phone,
      status: member.status,
      registered_by_admin: member.registered_by_admin,
      has_password: !!member.password,
    });

    if (!member.registered_by_admin) {
      console.log("❌ Member not registered by admin");
      
      // Track failed login attempt
      await trackLoginAttempt(phone, false, member._id, 'Member', req, 'account_inactive');
      
      return res.status(403).json({
        success: false,
        error: "Your account needs to be activated by an admin.",
      });
    }

    if (member.status !== "active") {
      console.log("❌ Member status is not active:", member.status);
      
      // Track failed login attempt
      await trackLoginAttempt(phone, false, member._id, 'Member', req, 'account_inactive');
      
      return res.status(403).json({
        success: false,
        error: "Your account is not active. Please contact admin.",
      });
    }

    console.log("🔐 Comparing passwords...");
    const isPasswordValid = await member.comparePassword(password);
    console.log("Password valid:", isPasswordValid);
    
    if (!isPasswordValid) {
      console.log("❌ Invalid password for member:", member.member_id);
      
      // Track failed login attempt
      await trackLoginAttempt(phone, false, member._id, 'Member', req, 'invalid_credentials');
      
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    console.log("✅ Member login successful, generating token...");
    
    // Track successful login
    await trackLoginAttempt(phone, true, member._id, 'Member', req);
    
    // Create session
    const session = await createUserSession(member._id, 'Member', 'member', req);
    
    const token = generateToken(member._id, "member");
    
    const userData = {
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
      monthly_contribution: member.monthly_contribution || 224,
      join_date: member.join_date,
    };
    
    console.log("📤 Sending member login response:", { ...userData, token: "[HIDDEN]" });
    
    res.json({
      success: true,
      role: "member",
      token,
      sessionId: session?._id,
      user: userData,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
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
        is_active: admin.is_active,
      },
    });
  } catch (error) {
    console.error("Setup admin error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
