import mongoose from "mongoose";
import Saving from "../models/Saving.js";
import Member from "../models/Member.js";

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf";

async function fixDuplicateDeposits() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all duplicate deposits by grouping by transaction_ref
    const duplicates = await Saving.aggregate([
      {
        $match: {
          transaction_type: "deposit",
          transaction_ref: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: {
            member_id: "$member_id",
            transaction_ref: "$transaction_ref",
            transaction_type: "$transaction_type"
          },
          count: { $sum: 1 },
          docs: { $push: "$_id" },
          amounts: { $push: "$amount" },
          created_dates: { $push: "$created_at" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`\n📋 Found ${duplicates.length} groups of duplicate deposits:\n`);

    let totalRemoved = 0;
    let totalAmountFixed = 0;

    for (const dup of duplicates) {
      console.log(`\n--- Duplicate Group ---`);
      console.log(`   Member ID: ${dup._id.member_id}`);
      console.log(`   Transaction Ref: ${dup._id.transaction_ref}`);
      console.log(`   Count: ${dup.count}`);
      console.log(`   Amounts: ${dup.amounts.join(", ")}`);
      console.log(`   Dates: ${dup.created_dates.map(d => new Date(d).toISOString()).join(", ")}`);

      // Keep the first record, remove the rest
      const toKeep = dup.docs[0];
      const toRemove = dup.docs.slice(1);
      const amountToRemove = dup.amounts.slice(1).reduce((sum, amt) => sum + amt, 0);

      console.log(`   Keeping: ${toKeep}`);
      console.log(`   Removing: ${toRemove.join(", ")}`);
      console.log(`   Amount to subtract from member total: KES ${amountToRemove}`);

      // Remove duplicate records
      const deleteResult = await Saving.deleteMany({
        _id: { $in: toRemove }
      });

      console.log(`   ✅ Deleted ${deleteResult.deletedCount} duplicate records`);

      // Update member's total_savings
      await Member.findByIdAndUpdate(dup._id.member_id, {
        $inc: { 
          total_savings: -amountToRemove,
          wallet_balance: -amountToRemove
        }
      });

      console.log(`   ✅ Adjusted member balance by -KES ${amountToRemove}`);

      totalRemoved += toRemove.length;
      totalAmountFixed += amountToRemove;
    }

    // Recalculate balances for affected members
    if (duplicates.length > 0) {
      console.log("\n\n🔄 Recalculating balances for affected members...\n");
      
      const affectedMemberIds = [...new Set(duplicates.map(d => d._id.member_id.toString()))];
      
      for (const memberId of affectedMemberIds) {
        // Get all transactions for this member in chronological order
        const transactions = await Saving.find({ member_id: memberId })
          .sort({ created_at: 1 });
        
        let runningBalance = 0;
        
        for (const tx of transactions) {
          const oldBalanceAfter = tx.balance_after;
          tx.balance_before = runningBalance;
          
          if (tx.transaction_type === "deposit" || tx.transaction_type === "interest") {
            runningBalance += tx.amount;
          } else if (tx.transaction_type === "withdrawal") {
            runningBalance -= tx.amount;
          }
          
          tx.balance_after = runningBalance;
          
          if (oldBalanceAfter !== runningBalance) {
            await tx.save();
            console.log(`   Fixed balance for transaction ${tx._id}: ${oldBalanceAfter} -> ${runningBalance}`);
          }
        }
        
        // Update member's final balance
        await Member.findByIdAndUpdate(memberId, {
          total_savings: runningBalance,
          wallet_balance: runningBalance
        });
        
        const member = await Member.findById(memberId);
        console.log(`   ✅ Updated ${member?.name || memberId}: new balance = KES ${runningBalance}`);
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ Fixed ${totalRemoved} duplicate deposit records`);
    console.log(`✅ Total amount corrected: KES ${totalAmountFixed}`);
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

fixDuplicateDeposits();
