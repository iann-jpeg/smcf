import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Member from "../models/Member.js";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const reassignAdvancePayments = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Find payments for deleted cycles (4, 5, 6)
    const orphanedPayments = await Payment.find({ 
      cycle_number: { $in: [4, 5, 6] },
      status: "completed"
    }).populate('member_id', 'name member_id');
    
    console.log(`📋 Found ${orphanedPayments.length} payments from old cycles #4, #5, #6\n`);
    
    if (orphanedPayments.length === 0) {
      console.log("✅ No orphaned payments to reassign");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Group by cycle number
    const byCycle = {};
    for (const payment of orphanedPayments) {
      if (!byCycle[payment.cycle_number]) {
        byCycle[payment.cycle_number] = [];
      }
      byCycle[payment.cycle_number].push(payment);
    }

    console.log("📊 Payments by old cycle:");
    for (const [cycleNum, payments] of Object.entries(byCycle)) {
      console.log(`   Cycle #${cycleNum}: ${payments.length} payments`);
    }
    console.log('');

    // Reassign to current cycle #4
    console.log("🔄 Reassigning payments to Cycle #4...\n");
    
    let reassignedCount = 0;
    for (const payment of orphanedPayments) {
      const oldCycle = payment.cycle_number;
      payment.cycle_number = 4;
      await payment.save();
      
      console.log(`   ✅ ${payment.member_id.name} - Payment moved from Cycle #${oldCycle} to #4`);
      reassignedCount++;
    }

    console.log(`\n✅ Reassigned ${reassignedCount} payments to Cycle #4`);

    // Update member payment statuses
    console.log("\n🔄 Updating member payment statuses...");
    const uniqueMemberIds = [...new Set(orphanedPayments.map(p => p.member_id._id.toString()))];
    
    for (const memberId of uniqueMemberIds) {
      const payment = orphanedPayments.find(p => p.member_id._id.toString() === memberId);
      await Member.updateOne(
        { _id: memberId },
        { 
          payment_status: "paid",
          payment_date: payment.date
        }
      );
    }
    
    console.log(`✅ Updated payment status for ${uniqueMemberIds.length} members`);

    // Show final count
    const cycle4Payments = await Payment.find({ 
      cycle_number: 4,
      status: "completed"
    });
    
    const uniquePayers = new Set(cycle4Payments.map(p => p.member_id.toString()));
    
    console.log(`\n📊 Final Count for Cycle #4:`);
    console.log(`   Total Payments: ${cycle4Payments.length}`);
    console.log(`   Unique Members: ${uniquePayers.size}/28`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

reassignAdvancePayments();
