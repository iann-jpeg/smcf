import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const fixCycleRecipient = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not set in .env file!");
      process.exit(1);
    }
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all active members sorted by position
    const members = await Member.find({ status: "active" }).sort({ position: 1 });
    console.log(`📊 Total Active Members: ${members.length}\n`);
    
    if (members.length === 0) {
      console.error("❌ No active members found!");
      await mongoose.connection.close();
      process.exit(1);
    }

    // Find Cycle #16
    const cycle16 = await Cycle.findOne({ cycle_number: 16 });
    if (!cycle16) {
      console.error("❌ Cycle #16 not found!");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log("Cycle #16 Current State:");
    console.log(`  Next Recipient ID: ${cycle16.next_recipient}`);
    console.log(`  Next Recipient Position: ${cycle16.next_recipient_position}\n`);

    // Calculate correct recipient for Cycle #16
    // Cycle number determines position: ((cycle_number - 1) % total_members) + 1
    const correctPosition = ((cycle16.cycle_number - 1) % members.length) + 1;
    const correctRecipient = members.find(m => m.position === correctPosition);

    console.log(`🔍 Calculated Correct Recipient for Cycle #${cycle16.cycle_number}:`);
    console.log(`  Position: ${correctPosition}`);
    console.log(`  Member: ${correctRecipient.name} (${correctRecipient.member_id})`);
    console.log(`  Phone: ${correctRecipient.phone}\n`);

    // Update Cycle #16 with correct recipient
    await Cycle.findByIdAndUpdate(cycle16._id, {
      next_recipient: correctRecipient._id,
      next_recipient_position: correctRecipient.position,
    });

    console.log("✅ Cycle #16 updated with correct recipient\n");

    // Verify
    const updated = await Cycle.findOne({ cycle_number: 16 }).populate(
      "next_recipient",
      "name member_id phone position"
    );
    console.log("📋 Verified Cycle #16:");
    console.log(`  Next Recipient: ${updated.next_recipient.name}`);
    console.log(`  Member ID: ${updated.next_recipient.member_id}`);
    console.log(`  Phone: ${updated.next_recipient.phone}`);

    await mongoose.connection.close();
    console.log("\n✅ Done");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

fixCycleRecipient();
