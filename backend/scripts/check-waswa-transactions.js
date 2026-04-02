import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkWaswaTransactions() {
  try {
    console.log("🔍 Checking Waswa's transactions...\n");

    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/smcf";
    await mongoose.connect(mongoUri);
    console.log("✅ Database connected\n");

    // Import Member model
    const Member = (await import("../models/Member.js")).default;
    
    // Find Waswa
    const waswa = await Member.findOne({ name: /waswa/i });
    if (!waswa) {
      console.log("❌ Waswa not found");
      process.exit(1);
    }

    console.log(`Found: ${waswa.name} (${waswa.member_id})`);
    console.log(`  wallet_balance: KES ${waswa.wallet_balance}`);
    console.log(`  total_savings: KES ${waswa.total_savings}\n`);

    // Get all savings transactions
    const Saving = (await import("../models/Saving.js")).default;
    const transactions = await Saving.find({ member_id: waswa._id }).sort({ created_at: 1 });

    console.log(`📋 Found ${transactions.length} transaction(s):\n`);
    
    transactions.forEach((t, idx) => {
      console.log(`${idx + 1}. Transaction ID: ${t._id}`);
      console.log(`   Type: ${t.transaction_type}`);
      console.log(`   Amount: KES ${t.amount}`);
      console.log(`   Status: ${t.status}`);
      console.log(`   Created: ${t.created_at}`);
      console.log(`   Reference: ${t.mpesa_receipt || 'N/A'}\n`);
    });

    // Calculate total deposits
    const totalDeposits = transactions
      .filter(t => t.transaction_type === "deposit" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log(`💰 Total Deposits (calculated): KES ${totalDeposits}`);
    console.log(`💰 Expected: KES 10000\n`);

    if (transactions.length > 1) {
      console.log("⚠️  Multiple transactions found. To delete the duplicate, run:");
      console.log(`   await Saving.findByIdAndDelete("${transactions[0]._id}");`);
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkWaswaTransactions();
