import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const fixWaswaDeposit = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Find Waswa
    const waswa = await Member.findOne({ 
      $or: [
        { name: /waswa/i },
        { member_id: { $regex: /waswa/i } }
      ]
    });

    if (!waswa) {
      console.log("❌ Waswa not found");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Found: ${waswa.name} (${waswa.member_id})`);

    console.log(`\n📊 Current State:`);
    console.log(`   Wallet Balance: KES ${waswa.wallet_balance || 0}`);
    console.log(`   Total Savings: KES ${waswa.total_savings || 0}`);

    // Set both to exactly 10,000
    waswa.wallet_balance = 10000;
    waswa.total_savings = 10000;
    await waswa.save();

    console.log(`\n✅ Fixed State:`);
    console.log(`   Wallet Balance: KES ${waswa.wallet_balance}`);
    console.log(`   Total Savings: KES ${waswa.total_savings}`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixWaswaDeposit();
