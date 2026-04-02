import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

const cleanup = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    await mongoose.connect(mongoUri);
    console.log("🔌 Connected to MongoDB\n");

    // Mark Cycle #15 as completed
    await Cycle.updateOne({ cycle_number: 15 }, { status: "completed" });
    console.log("✅ Cycle #15 marked as completed");

    // Verify final state
    const all = await Cycle.find().sort({ cycle_number: -1 }).limit(5);
    console.log("\n📊 Final Cycle Status:\n");
    all.forEach(c => console.log(`  Cycle #${c.cycle_number}: ${c.status}`));

    await mongoose.connection.close();
    console.log("\n✅ Done");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

cleanup();
