import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

async function getRecipientPosition() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI not configured");
      return;
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    
    const totalMembers = await Member.countDocuments({ status: "active" });
    console.log(`Total active members: ${totalMembers}`);
    
    // For Cycle #16, calculate position
    const cycleNumber = 16;
    const recipientPosition = ((cycleNumber - 1) % totalMembers) + 1;
    console.log(`Cycle #${cycleNumber} → Member position: ${recipientPosition}`);
    
    const member = await Member.findOne({ position: recipientPosition, status: "active" });
    console.log(`\nMember: ${member.name}`);
    console.log(`ID: ${member.member_id}`);
    console.log(`Phone: ${member.phone}`);
    console.log(`Member ID (DB): ${member._id}`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

getRecipientPosition();
