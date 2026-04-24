import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const resetToFirstCycle = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Delete cycle #2
    const deleteResult = await Cycle.deleteOne({ cycle_number: 2 });
    console.log(`🗑️  Deleted cycle #2: ${deleteResult.deletedCount} cycle(s) removed\n`);

    // Update cycle #1 to active
    const cycle1 = await Cycle.findOne({ cycle_number: 1 });
    if (cycle1) {
      cycle1.status = "active";
      // Update the dates to current time
      cycle1.start_date = new Date();
      cycle1.end_date = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      await cycle1.save();
      
      console.log(`✅ Cycle #1 activated:`);
      console.log(`   Status: ${cycle1.status}`);
      console.log(`   Start: ${cycle1.start_date.toLocaleString()}`);
      console.log(`   End: ${cycle1.end_date.toLocaleString()}`);
    } else {
      console.log("❌ Cycle #1 not found");
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

resetToFirstCycle();
