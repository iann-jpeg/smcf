import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const checkCycle4Payments = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Find all payments for cycle #4
    const cycle4Payments = await Payment.find({ 
      cycle_number: 4,
      status: "completed"
    }).populate('member_id', 'name member_id phone position');
    
    console.log(`💰 Payments for Cycle #4:`);
    console.log(`   Total Payments: ${cycle4Payments.length}\n`);
    
    if (cycle4Payments.length > 0) {
      console.log("📋 Payment Details:");
      for (const payment of cycle4Payments) {
        console.log(`   ✅ ${payment.member_id.name} (${payment.member_id.member_id})`);
        console.log(`      Amount: KES ${payment.amount}`);
        console.log(`      Date: ${payment.date}`);
        console.log(`      Payment ID: ${payment._id}`);
        console.log('');
      }
      
      // Get unique member IDs
      const uniqueMembers = new Set(cycle4Payments.map(p => p.member_id._id.toString()));
      console.log(`\n👥 Unique Members Paid: ${uniqueMembers.size}`);
      
      // Update member payment_status
      console.log("\n🔄 Updating member payment statuses...");
      for (const payment of cycle4Payments) {
        await Member.updateOne(
          { _id: payment.member_id._id },
          { 
            payment_status: "paid",
            payment_date: payment.date
          }
        );
      }
      console.log("✅ Updated payment statuses for members who paid in advance");
      
    } else {
      console.log("❌ No payments found for Cycle #4");
      
      // Check all payments to see what cycle numbers exist
      const allPayments = await Payment.find({ status: "completed" })
        .sort({ cycle_number: -1 })
        .limit(10);
      
      console.log("\n📊 Recent completed payments (last 10):");
      for (const payment of allPayments) {
        const member = await Member.findById(payment.member_id);
        console.log(`   Cycle #${payment.cycle_number} - ${member?.name || 'Unknown'} - KES ${payment.amount}`);
      }
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkCycle4Payments();
