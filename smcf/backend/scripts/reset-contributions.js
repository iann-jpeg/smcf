import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const resetContributions = async () => {
  try {
    // Use connection string from environment or default
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Reset all members' contributions and received amounts to 0
    const result = await Member.updateMany(
      {},
      {
        $set: {
          total_contributed: 0,
          total_received: 0,
        },
      }
    );

    console.log("✅ Successfully reset contributions for all members");
    console.log(`   Modified ${result.modifiedCount} members`);
    console.log("   All total_contributed and total_received set to 0");

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting contributions:", error);
    process.exit(1);
  }
};

resetContributions();
