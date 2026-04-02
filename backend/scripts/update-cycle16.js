import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import dotenv from "dotenv";

dotenv.config();

async function updateCycle() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    const winnieId = "6935951da6dec1cf10f937a6";
    
    await Cycle.updateOne(
      { cycle_number: 16 },
      { 
        next_recipient: winnieId,
        next_recipient_position: 16
      }
    );
    
    const updated = await Cycle.findOne({ cycle_number: 16 }).populate(
      "next_recipient",
      "name member_id phone"
    );
    
    console.log("✅ Cycle #16 updated!");
    console.log(`   Member: ${updated.next_recipient.name}`);
    console.log(`   ID: ${updated.next_recipient.member_id}`);
    console.log(`   Phone: ${updated.next_recipient.phone}`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

updateCycle();
