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

    const cycles = await Cycle.find().sort({ cycle_number: 1 });
    
    console.log(`📊 Total cycles in database: ${cycles.length}\n`);
    
    for (const cycle of cycles) {
      const status = cycle.status === 'active' ? '🟢 ACTIVE' : '⚪ ' + cycle.status.toUpperCase();
      console.log(`${status} - Cycle #${cycle.cycle_number}`);
      console.log(`   Start: ${cycle.start_date}`);
      console.log(`   End: ${cycle.end_date}`);
      console.log(`   Status: ${cycle.status}`);
      console.log(`   ID: ${cycle._id}`);
      console.log('');
    }

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkAllCycles();
