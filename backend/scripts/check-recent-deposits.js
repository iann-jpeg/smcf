import mongoose from "mongoose";
import Saving from "../models/Saving.js";
import Member from "../models/Member.js";

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf";

async function checkRecentDeposits() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find recent deposits (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentDeposits = await Saving.find({
      transaction_type: "deposit",
      created_at: { $gte: oneDayAgo }
    }).populate("member_id", "name phone").sort({ created_at: -1 });

    console.log(`\n📋 Recent deposits (last 24 hours): ${recentDeposits.length}\n`);

    // Group by member and amount to find potential duplicates
    const groupedByMemberAndAmount = {};
    
    for (const deposit of recentDeposits) {
      const memberName = deposit.member_id?.name || "Unknown";
      const key = `${memberName}_${deposit.amount}`;
      
      if (!groupedByMemberAndAmount[key]) {
        groupedByMemberAndAmount[key] = [];
      }
      groupedByMemberAndAmount[key].push(deposit);
    }

    console.log("--- All Recent Deposits ---");
    for (const deposit of recentDeposits) {
      const memberName = deposit.member_id?.name || "Unknown";
      console.log(`\n   Member: ${memberName}`);
      console.log(`   Amount: KES ${deposit.amount}`);
      console.log(`   Date: ${new Date(deposit.created_at).toISOString()}`);
      console.log(`   Transaction Ref: ${deposit.transaction_ref || "None"}`);
      console.log(`   Balance After: KES ${deposit.balance_after}`);
      console.log(`   ID: ${deposit._id}`);
    }

    // Check for duplicates by same member and amount within short time window
    console.log("\n\n--- Potential Duplicates (same member + amount) ---");
    for (const [key, deposits] of Object.entries(groupedByMemberAndAmount)) {
      if (deposits.length > 1) {
        console.log(`\n🚨 ${key}: ${deposits.length} deposits`);
        for (const d of deposits) {
          console.log(`   - ${new Date(d.created_at).toISOString()} | Ref: ${d.transaction_ref || "None"} | ID: ${d._id}`);
        }
      }
    }

    // Specifically look for KES 150 deposits
    console.log("\n\n--- KES 150 Deposits (specifically) ---");
    const deposits150 = recentDeposits.filter(d => d.amount === 150);
    console.log(`Found ${deposits150.length} deposits of KES 150`);
    for (const d of deposits150) {
      const memberName = d.member_id?.name || "Unknown";
      console.log(`   - ${memberName} | ${new Date(d.created_at).toISOString()} | Ref: ${d.transaction_ref || "None"}`);
    }

    await mongoose.disconnect();
    console.log("\n\nDisconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

checkRecentDeposits();
