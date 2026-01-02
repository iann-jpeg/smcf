import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import Member from "../models/Member.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Not authorized to access this route",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Handle hardcoded viewer account
      if (decoded.id === "viewer-readonly" && decoded.role === "viewer") {
        req.admin = {
          _id: "viewer-readonly",
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
        };
        req.user = req.admin;
        req.user.role = "viewer";
        req.userRole = "admin";
        console.log("✅ Viewer authenticated: Read-Only Viewer");
        return next();
      }

      if (
        decoded.role === "admin" ||
        decoded.role === "superadmin" ||
        decoded.role === "treasurer" ||
        decoded.role === "viewer"
      ) {
        req.admin = await Admin.findById(decoded.id);

        if (!req.admin) {
          return res.status(401).json({
            success: false,
            error: "Admin account not found",
          });
        }

        req.user = req.admin; // Set req.user for compatibility
        req.user.role = decoded.role; // Ensure role is set
        req.userRole = "admin";

        console.log(
          "✅ Admin authenticated:",
          req.user.name,
          "Role:",
          decoded.role
        );
      } else {
        req.member = await Member.findById(decoded.id);

        if (!req.member) {
          return res.status(401).json({
            success: false,
            error: "Member account not found",
          });
        }

        req.user = req.member; // Set req.user for compatibility
        req.user.role = decoded.role || "member"; // Ensure role is set
        req.userRole = "member";
      }

      next();
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({
        success: false,
        error: "Not authorized to access this route",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Access denied. Admin privileges required.",
    });
  }
  next();
};

export const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};
