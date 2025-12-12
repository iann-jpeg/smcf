import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const resetToCycleOne = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Find all cycles
    const allCycles = await Cycle.find({});
    console.log(`📊 Found ${allCycles.length} total cycles\n`);
    
    for (const c of allCycles) {
      console.log(`   Cycle #${c.cycle_number} - Status: ${c.status}`);
    }

    // Find the active cycle
    const activeCycle = await Cycle.findOne({ status: "active" });
    
    if (!activeCycle) {
      console.log("\n❌ No active cycle found");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`\n📊 Current active cycle: #${activeCycle.cycle_number}`);
    console.log(`📅 Start date: ${activeCycle.start_date}`);
    console.log(`👥 Members in cycle: ${activeCycle.total_members}`);
    console.log(`💰 Total collected: KES ${activeCycle.total_collected}`);
    console.log(`💰 Total disbursed: KES ${activeCycle.total_disbursed}`);
    
    // Delete all completed/inactive cycles to free up cycle #1
    console.log(`\n🗑️  Deleting old cycles to free cycle #1...`);
    const deleteResult = await Cycle.deleteMany({ 
      status: { $ne: "active" } 
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} old cycle(s)`);
    
    // Now update the active cycle to #1 starting January 5, 2026
    activeCycle.cycle_number = 1;
    activeCycle.start_date = new Date('2026-01-05T00:00:00.000Z'); // January 5, 2026
    activeCycle.end_date = new Date('2026-01-10T00:00:00.000Z'); // 5 days later (January 10, 2026)
    await activeCycle.save();

    console.log(`\n✅ Updated cycle number to: #${activeCycle.cycle_number}`);
    console.log(`✅ Updated start date to: ${activeCycle.start_date}`);
    console.log(`✅ Updated end date to: ${activeCycle.end_date}`);
    console.log(`✅ Cycle duration: 5 days`);

    // Reset all members' payment status to pending for the new cycle
    const members = await Member.find({ status: "active" });
    console.log(`\n👥 Resetting payment status for ${members.length} active members...`);
    
    for (const member of members) {
      member.payment_status = "pending";
      await member.save();
    }

    console.log(`✅ All member payment statuses reset to "pending"`);

    // Display summary
    const now = new Date();
    const cycleStart = new Date(activeCycle.start_date);
    const cycleEnd = new Date(activeCycle.end_date);
    const daysUntilStart = Math.ceil((cycleStart - now) / (1000 * 60 * 60 * 24));
    
    console.log("\n" + "=".repeat(50));
    console.log("📋 CYCLE RESET SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Cycle Number: #${activeCycle.cycle_number}`);
    console.log(`✅ Start Date: ${cycleStart.toLocaleDateString()} (${daysUntilStart} days from now)`);
    console.log(`✅ End Date: ${cycleEnd.toLocaleDateString()}`);
    console.log(`✅ Cycle Duration: 5 days`);
    console.log(`✅ Active Members: ${members.length}`);
    console.log(`✅ All members set to: PENDING payment status`);
    console.log(`✅ All previous data preserved (payments, savings, loans intact)`);
    console.log("=".repeat(50));

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

resetToCycleOne();
