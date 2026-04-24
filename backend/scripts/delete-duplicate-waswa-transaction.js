import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function deleteDuplicateTransaction() {
  try {
    console.log("🗑️  Deleting duplicate Waswa transaction...\n");

    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/smcf";
    await mongoose.connect(mongoUri);
    console.log("✅ Database connected\n");

    // Import models
    const Saving = (await import("../models/Saving.js")).default;
    const Member = (await import("../models/Member.js")).default;
    
    // Find Waswa
    const waswa = await Member.findOne({ name: /waswa/i });
    if (!waswa) {
      console.log("❌ Waswa not found");
      process.exit(1);
    }

    console.log(`Found: ${waswa.name} (${waswa.member_id})\n`);

    // Check transactions before deletion
    const beforeCount = await Saving.countDocuments({ member_id: waswa._id });
    console.log(`Transactions before deletion: ${beforeCount}`);

    // Delete the first duplicate transaction
    const transactionIdToDelete = "693961afef6bba4be90b4d02";
    const deleted = await Saving.findByIdAndDelete(transactionIdToDelete);

    if (deleted) {
      console.log(`✅ Deleted transaction: ${deleted._id}`);
      console.log(`   Type: ${deleted.transaction_type}`);
      console.log(`   Amount: KES ${deleted.amount}`);
      console.log(`   Created: ${deleted.created_at}\n`);
    } else {
      console.log("❌ Transaction not found\n");
    }

    // Check transactions after deletion
    const afterCount = await Saving.countDocuments({ member_id: waswa._id });
    console.log(`Transactions after deletion: ${afterCount}\n`);

    // Calculate new total
    const remainingTransactions = await Saving.find({ 
      member_id: waswa._id,
      transaction_type: "deposit",
      status: "completed"
    });

    const totalDeposits = remainingTransactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`💰 New Total Deposits (calculated): KES ${totalDeposits}`);
    console.log(`💰 Member.total_savings: KES ${waswa.total_savings}`);
    console.log(`✅ Both should now match!\n`);

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

deleteDuplicateTransaction();
