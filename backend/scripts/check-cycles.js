import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const checkCycles = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all cycles
    const allCycles = await Cycle.find().sort({ cycle_number: 1 });
    
    console.log("📊 All Cycles in Database:\n");
    allCycles.forEach(cycle => {
      console.log(`  Cycle #${cycle.cycle_number}:`);
      console.log(`    Status: ${cycle.status}`);
      console.log(`    Start: ${cycle.start_date.toDateString()}`);
      console.log(`    End: ${cycle.end_date.toDateString()}`);
      console.log(`    Total Members: ${cycle.total_members}`);
      console.log();
    });

    // Get current active cycle
    const activeCycle = await Cycle.findOne({ status: "active" });
    console.log("🟢 Currently Active Cycle:");
    if (activeCycle) {
      console.log(`  Cycle #${activeCycle.cycle_number}`);
    } else {
      console.log("  None");
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkCycles();
