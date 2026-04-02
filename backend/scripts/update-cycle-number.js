import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const updateCycleNumber = async () => {
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

    console.log(`📊 Current cycle number: #${cycle.cycle_number}`);
    
    cycle.cycle_number = 1;
    await cycle.save();

    console.log(`✅ Updated cycle number to: #${cycle.cycle_number}`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

updateCycleNumber();
