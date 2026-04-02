import mongoose from "mongoose";
import Saving from "../models/Saving.js";
import Member from "../models/Member.js";

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf";

async function recalculateAllBalances() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get all members with savings
    const members = await Member.find({ 
      $or: [
        { total_savings: { $gt: 0 } },
        { wallet_balance: { $gt: 0 } }
      ]
    });

    console.log(`\n📋 Checking ${members.length} members with savings:\n`);

    let fixedCount = 0;

    for (const member of members) {
      // Calculate actual balance from transactions
      const transactions = await Saving.find({ member_id: member._id });
      
      let calculatedBalance = 0;
      for (const tx of transactions) {
        if (tx.transaction_type === "deposit" || tx.transaction_type === "interest") {
          calculatedBalance += tx.amount;
        } else if (tx.transaction_type === "withdrawal") {
          calculatedBalance -= tx.amount;
        }
      }

      const recordedBalance = member.total_savings || 0;
      const difference = recordedBalance - calculatedBalance;

      if (Math.abs(difference) > 0.01) {
        console.log(`\n🚨 MISMATCH: ${member.name}`);
        console.log(`   Recorded Balance: KES ${recordedBalance}`);
        console.log(`   Calculated Balance: KES ${calculatedBalance}`);
        console.log(`   Difference: KES ${difference}`);
        console.log(`   Transaction Count: ${transactions.length}`);

        // Fix the balance
        await Member.findByIdAndUpdate(member._id, {
          total_savings: calculatedBalance,
          wallet_balance: calculatedBalance
        });
        console.log(`   ✅ Fixed balance to KES ${calculatedBalance}`);
        fixedCount++;
      } else {
        console.log(`✓ ${member.name}: KES ${calculatedBalance} (OK)`);
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ Fixed ${fixedCount} member balances`);
    console.log(`========================================\n`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
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

recalculateAllBalances();
