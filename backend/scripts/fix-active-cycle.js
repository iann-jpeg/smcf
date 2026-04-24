import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const fixActiveCycle = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all cycles sorted by number descending
    const allCycles = await Cycle.find().sort({ cycle_number: -1 }).limit(5);
    
    console.log("📊 Latest Cycles:\n");
    allCycles.forEach(cycle => {
      console.log(`  Cycle #${cycle.cycle_number}: status = "${cycle.status}"`);
    });

    console.log("\n🔄 Fixing cycle status...\n");

    // Mark Cycle #17 as completed (if it exists)
    const cycle17 = await Cycle.findOne({ cycle_number: 17 });
    if (cycle17) {
      await Cycle.findByIdAndUpdate(cycle17._id, { status: "completed" });
      console.log("✅ Cycle #17 marked as completed");
    }

    // Mark Cycle #16 as active
    const cycle16 = await Cycle.findOne({ cycle_number: 16 });
    if (cycle16) {
      await Cycle.findByIdAndUpdate(cycle16._id, { status: "active" });
      console.log("✅ Cycle #16 marked as active");
    } else {
      console.log("⚠️  Cycle #16 not found!");
    }

    // Verify changes
    console.log("\n📊 Updated Status:\n");
    const updated = await Cycle.find().sort({ cycle_number: -1 }).limit(5);
    updated.forEach(cycle => {
      console.log(`  Cycle #${cycle.cycle_number}: status = "${cycle.status}"`);
    });

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

fixActiveCycle();
