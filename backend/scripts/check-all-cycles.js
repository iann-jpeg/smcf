import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const checkAllCycles = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    const cycles = await Cycle.find({}).sort({ cycle_number: 1 });
    
    console.log(`📊 Total cycles found: ${cycles.length}\n`);
    
    cycles.forEach(cycle => {
      console.log(`Cycle #${cycle.cycle_number}:`);
      console.log(`   Status: ${cycle.status}`);
      console.log(`   Start: ${new Date(cycle.start_date).toLocaleString()}`);
      console.log(`   End: ${new Date(cycle.end_date).toLocaleString()}`);
      console.log(`   Members: ${cycle.member_ids?.length || 0}`);
      console.log(`   Collected: KES ${cycle.amount_collected || 0}`);
      console.log();
    });

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkAllCycles();
