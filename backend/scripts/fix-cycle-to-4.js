import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const fixCycleTo4 = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    const cycle = await Cycle.findOne({ status: "active" });
    
    if (!cycle) {
      console.log("❌ No active cycle found");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📊 Current cycle: #${cycle.cycle_number}`);
    console.log(`   Old Start Date: ${cycle.start_date}`);
    console.log(`   Old End Date: ${cycle.end_date}\n`);
    
    // Cycle #4 calculation:
    // Cycle #1: Jan 5-10 (2026-01-05 to 2026-01-10)
    // Cycle #2: Jan 10-15 (2026-01-10 to 2026-01-15)
    // Cycle #3: Jan 15-20 (2026-01-15 to 2026-01-20)
    // Cycle #4: Jan 15-20 (2026-01-15 to 2026-01-20) <- CORRECT
    
    const firstCycleStart = new Date('2026-01-05T00:00:00.000Z');
    const cycleNumber = 4;
    
    // Calculate start date for cycle #4
    const cycleStartDate = new Date(firstCycleStart.getTime() + ((cycleNumber - 1) * 5 * 24 * 60 * 60 * 1000));
    const cycleEndDate = new Date(cycleStartDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    
    cycle.cycle_number = cycleNumber;
    cycle.start_date = cycleStartDate;
    cycle.end_date = cycleEndDate;
    await cycle.save();

    console.log(`✅ Updated cycle number to: #${cycle.cycle_number}`);
    console.log(`✅ Updated start date to: ${cycle.start_date}`);
    console.log(`✅ Updated end date to: ${cycle.end_date}`);
    
    // Calculate days remaining
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((cycleEndDate - now) / (1000 * 60 * 60 * 24)));
    console.log(`\n📅 Today: ${now.toISOString()}`);
    console.log(`⏰ Days Left: ${daysLeft} days\n`);

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixCycleTo4();
