// Direct database script to recalculate member totals
import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment from current directory (should have .env file)
dotenv.config();

// Import models directly (assuming this file is in smcf/backend directory)
import Member from "./models/Member.js";
import Payment from "./models/Payment.js";

async function recalculateMemberTotals() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("   URI:", process.env.MONGODB_URI ? "Set" : "Not set");
    
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error("MongoDB URI not found in environment variables");
    }
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log("✅ Connected to MongoDB");
    console.log("\n🔄 Starting member totals recalculation...\n");
    
    console.log("🔍 Querying members...");
    const members = await Member.find().maxTimeMS(10000).lean();
    console.log(`📊 Found ${members.length} members\n`);
    
    if (members.length === 0) {
      console.log("⚠️  No members found in database");
      return;
    }
    
    let updatedCount = 0;
    let errors = [];
    
    for (const member of members) {
      try {
        // Get all completed payments for this member
        const payments = await Payment.find({
          member_id: member._id,
          status: "completed"
        });
        
        // Calculate totals
        const total_contributed = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        // Calculate breakdown: Each payment of 224 = 200 (cycle) + 20 (credit) + 4 (fees)
        const paymentCount = payments.length;
        const total_cycle_contribution = paymentCount * 200;
        const total_member_credit = paymentCount * 20;
        const total_transaction_fees = paymentCount * 4;
        
        // Update member
        await Member.findByIdAndUpdate(member._id, {
          total_contributed,
          total_cycle_contribution,
          total_member_credit,
          total_transaction_fees
        });
        
        console.log(`✅ ${member.name} (${member.member_id})`);
        console.log(`   Payments: ${paymentCount}`);
        console.log(`   Total: KES ${total_contributed}`);
        console.log(`   Breakdown: Cycle=KES ${total_cycle_contribution}, Credit=KES ${total_member_credit}, Fees=KES ${total_transaction_fees}\n`);
        
        updatedCount++;
      } catch (err) {
        console.error(`❌ Error updating ${member.name}:`, err.message);
        errors.push({ member: member.name, error: err.message });
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Recalculation complete!`);
    console.log(`   Updated: ${updatedCount}/${members.length} members`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      errors.forEach(err => {
        console.log(`   - ${err.member}: ${err.error}`);
      });
    }
    
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
}

recalculateMemberTotals();
