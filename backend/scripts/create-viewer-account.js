import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const createViewerAccount = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Check if viewer already exists
    const existingViewer = await Admin.findOne({ phone: "0700000000" });
    
    if (existingViewer) {
      console.log("⚠️  Viewer account already exists, updating...");
      
      // Update the existing account
      const hashedPassword = await bcrypt.hash("smcf-0000", 12);
      await Admin.updateOne(
        { phone: "0700000000" },
        { 
          $set: { 
            role: "viewer",
            password: hashedPassword,
            is_active: true,
            permissions: {
              canAddMembers: false,
              canEditMembers: false,
              canDeleteMembers: false,
              canDisburseFunds: false,
              canApproveLoans: false,
              canViewReports: true,
            }
          }
        }
      );
      console.log("✅ Viewer account updated successfully!");
    } else {
      // Create new viewer account
      const hashedPassword = await bcrypt.hash("smcf-0000", 12);
      
      const viewer = new Admin({
        name: "Read-Only Viewer",
        phone: "0700000000",
        role: "viewer",
        password: hashedPassword,
        is_active: true,
        permissions: {
          canAddMembers: false,
          canEditMembers: false,
          canDeleteMembers: false,
          canDisburseFunds: false,
          canApproveLoans: false,
          canViewReports: true,
        }
      });

      // Save without triggering password hashing (already hashed)
      await Admin.collection.insertOne({
        name: viewer.name,
        phone: viewer.phone,
        role: viewer.role,
        password: hashedPassword,
        is_active: viewer.is_active,
        permissions: viewer.permissions,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log("✅ Viewer account created successfully!");
    }

    console.log("\n📋 Viewer Account Details:");
    console.log("   Phone: 0700000000");
    console.log("   Password: smcf-0000");
    console.log("   Role: viewer (read-only access)");

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

createViewerAccount();
