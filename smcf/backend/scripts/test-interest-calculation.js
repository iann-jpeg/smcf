import mongoose from "mongoose";
import env from "../config/env.js";
import { applyMonthlyInterest } from "../services/interestService.js";

const MONGODB_URI = env.MONGODB_URI;

async function testInterestCalculation() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("💰 Running interest calculation...\n");
    const result = await applyMonthlyInterest();
    
    console.log("\n📊 Results:");
    console.log(`   Applied Count: ${result.appliedCount}`);
    console.log(`   Total Amount: KES ${result.totalAmount}`);

    await mongoose.disconnect();
    console.log("\n✅ Test complete");
  } catch (error) {
    console.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testInterestCalculation();
