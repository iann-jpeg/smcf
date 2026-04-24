import mongoose from "mongoose";
import Saving from "../models/Saving.js";
import Member from "../models/Member.js";

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf";

async function checkMemberDeposits() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find Winnie C member
    const member = await Member.findOne({ name: /Winnie/i });
    
    if (!member) {
      console.log("Member not found");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`\n📋 Checking deposits for: ${member.name}`);
    console.log(`   Member ID: ${member._id}`);
    console.log(`   Total Savings (from member): KES ${member.total_savings || 0}`);
    console.log(`   Wallet Balance (from member): KES ${member.wallet_balance || 0}`);

    // Get all savings transactions for this member
    const transactions = await Saving.find({ member_id: member._id })
      .sort({ created_at: -1 });

    console.log(`\n📋 All transactions: ${transactions.length}\n`);

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalInterest = 0;

    for (const tx of transactions) {
      console.log(`   ${tx.transaction_type.toUpperCase()} | KES ${tx.amount}`);
      console.log(`      Date: ${new Date(tx.created_at).toISOString()}`);
      console.log(`      Ref: ${tx.transaction_ref || "None"}`);
      console.log(`      Balance After: KES ${tx.balance_after}`);
      console.log(`      Notes: ${tx.notes || "None"}`);
      console.log(`      ID: ${tx._id}`);
      console.log("");

      if (tx.transaction_type === "deposit") totalDeposits += tx.amount;
      if (tx.transaction_type === "withdrawal") totalWithdrawals += tx.amount;
      if (tx.transaction_type === "interest") totalInterest += tx.amount;
    }

    // Calculate expected balance
    const expectedBalance = totalDeposits + totalInterest - totalWithdrawals;
    
    console.log("\n--- Summary ---");
    console.log(`   Total Deposits: KES ${totalDeposits}`);
    console.log(`   Total Withdrawals: KES ${totalWithdrawals}`);
    console.log(`   Total Interest: KES ${totalInterest}`);
    console.log(`   Expected Balance: KES ${expectedBalance}`);
    console.log(`   Member's Recorded Balance: KES ${member.total_savings || 0}`);
    
    if (Math.abs(expectedBalance - (member.total_savings || 0)) > 0.01) {
      console.log("\n🚨 MISMATCH DETECTED! Member balance doesn't match transactions");
      console.log(`   Difference: KES ${(member.total_savings || 0) - expectedBalance}`);
    }

    // Check for deposits with same amounts (potential duplicates even if different refs)
    console.log("\n\n--- Checking for potential duplicates (deposits within 5 minutes of each other) ---");
    const deposits = transactions.filter(t => t.transaction_type === "deposit").reverse(); // chronological order
    
    for (let i = 0; i < deposits.length - 1; i++) {
      const current = deposits[i];
      const next = deposits[i + 1];
      
      const timeDiff = Math.abs(new Date(next.created_at) - new Date(current.created_at)) / 1000 / 60; // minutes
      
      if (current.amount === next.amount && timeDiff < 5) {
        console.log(`\n🚨 Potential duplicate found!`);
        console.log(`   Deposit 1: ${new Date(current.created_at).toISOString()} | KES ${current.amount} | Ref: ${current.transaction_ref}`);
        console.log(`   Deposit 2: ${new Date(next.created_at).toISOString()} | KES ${next.amount} | Ref: ${next.transaction_ref}`);
        console.log(`   Time difference: ${timeDiff.toFixed(2)} minutes`);
      }
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

checkMemberDeposits();
