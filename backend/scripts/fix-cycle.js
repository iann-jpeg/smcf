import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const fixCycle = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get active cycle
    const cycle = await Cycle.findOne({ status: "active" });
    
    if (!cycle) {
      console.log("❌ No active cycle found");
      await mongoose.connection.close();
      process.exit(1);
    }

    // Get all active members sorted by position
    const members = await Member.find({ status: "active" }).sort({ position: 1 });
    
    if (members.length === 0) {
      console.error("❌ No active members found!");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📊 Found ${members.length} active members`);

    // Get the first member as next recipient (position 1)
    const firstRecipient = members[0];

    // Update the cycle
    cycle.total_members = members.length;
    cycle.monthly_contribution = 224;
    cycle.total_amount_expected = members.length * 224;
    cycle.total_amount_collected = 0;
    cycle.members_paid = 0;
    cycle.next_recipient = firstRecipient._id;
    cycle.next_recipient_position = firstRecipient.position;

    await cycle.save();

    console.log("\n✅ Cycle updated successfully!");
    console.log(`   Cycle Number: #${cycle.cycle_number}`);
    console.log(`   Total Members: ${cycle.total_members}`);
    console.log(`   Expected Amount: KES ${cycle.total_amount_expected.toLocaleString()}`);
    console.log(`   Next Recipient: ${firstRecipient.name} (${firstRecipient.member_id})`);
    console.log(`   Position: #${firstRecipient.position}`);
    console.log(`   Phone: ${firstRecipient.phone}`);

    console.log("\n🎯 The 'Mark as Disbursed' button should now appear in the admin dashboard!");

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixCycle();
