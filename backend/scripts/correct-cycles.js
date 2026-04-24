import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const correctCycles = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Today is January 20, 2026
    // Cycle #1: Jan 5-10
    // Cycle #2: Jan 10-15
    // Cycle #3: Jan 15-20 (TODAY is the last day)
    // Cycle #4: Jan 20-25 (should be active starting today)

    console.log("📅 Today is January 20, 2026");
    console.log("🔄 Correcting cycle data...\n");

    // Delete cycles #4, #5, #6 (they were created with wrong dates)
    const deleteResult = await Cycle.deleteMany({ 
      cycle_number: { $gte: 4 } 
    });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} incorrect future cycles\n`);

    // Update cycle #3 to be completed
    await Cycle.updateOne(
      { cycle_number: 3 },
      { status: 'completed' }
    );
    console.log("✅ Marked Cycle #3 as completed\n");

    // Create the correct Cycle #4
    const firstCycleStart = new Date('2026-01-05T00:00:00.000Z');
    const cycleNumber = 4;
    
    // Calculate start date for cycle #4
    const cycleStartDate = new Date(firstCycleStart.getTime() + ((cycleNumber - 1) * 5 * 24 * 60 * 60 * 1000));
    const cycleEndDate = new Date(cycleStartDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    
    const newCycle = await Cycle.create({
      cycle_number: 4,
      start_date: cycleStartDate,  // January 20, 2026
      end_date: cycleEndDate,      // January 25, 2026
      status: "active",
      total_members: 28,
      next_recipient: '69359516a6dec1cf10f9378e'  // Jodre (position 4)
    });

    console.log(`✅ Created Cycle #${newCycle.cycle_number}`);
    console.log(`   Start: ${newCycle.start_date}`);
    console.log(`   End: ${newCycle.end_date}`);
    
    // Calculate days remaining
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((cycleEndDate - now) / (1000 * 60 * 60 * 24)));
    console.log(`\n📅 Today: ${now.toISOString()}`);
    console.log(`⏰ Days Left: ${daysLeft} days (should be 5 if Jan 20)\n`);

    console.log("✅ All cycles corrected!");

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

correctCycles();
