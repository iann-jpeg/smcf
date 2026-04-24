import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

// Import models
import Announcement from "../models/Announcement.js";
import Cycle from "../models/Cycle.js";
import Disbursement from "../models/Disbursement.js";
import Loan from "../models/Loan.js";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";

async function directReset() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/smcf"
    );
    console.log("✅ MongoDB Connected\n");

    console.log("🔄 Starting database reset...");
    console.log("⚠️  This will delete ALL data except admin accounts!\n");

    // Delete all collections except Admin
    const membersDeleted = await Member.deleteMany({});
    const paymentsDeleted = await Payment.deleteMany({});
    const cyclesDeleted = await Cycle.deleteMany({});
    const loansDeleted = await Loan.deleteMany({});
    const disbursementsDeleted = await Disbursement.deleteMany({});
    const announcementsDeleted = await Announcement.deleteMany({});

    console.log("✅ Database reset complete!\n");
    console.log("📊 Deleted counts:");
    console.log(`   ✓ Members: ${membersDeleted.deletedCount}`);
    console.log(`   ✓ Payments: ${paymentsDeleted.deletedCount}`);
    console.log(`   ✓ Cycles: ${cyclesDeleted.deletedCount}`);
    console.log(`   ✓ Loans: ${loansDeleted.deletedCount}`);
    console.log(`   ✓ Disbursements: ${disbursementsDeleted.deletedCount}`);
    console.log(`   ✓ Announcements: ${announcementsDeleted.deletedCount}`);
    console.log("\n✓ Admin data preserved");
    console.log("\n🎉 All data has been reset to zero!");

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

directReset();
