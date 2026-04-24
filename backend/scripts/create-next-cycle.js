import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const createNextCycle = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get the last cycle
    const lastCycle = await Cycle.findOne().sort({ cycle_number: -1 });
    
    if (!lastCycle) {
      console.error("❌ No cycles found in database!");
      await mongoose.connection.close();
      process.exit(1);
    }

    const nextCycleNumber = lastCycle.cycle_number + 1;
    console.log(`📊 Last cycle: #${lastCycle.cycle_number}`);
    console.log(`   End date: ${lastCycle.end_date.toDateString()}`);

    // Get all active members
    const members = await Member.find({ status: "active" });
    
    if (members.length === 0) {
      console.error("❌ No active members found!");
      await mongoose.connection.close();
      process.exit(1);
    }

    // Determine next recipient (round-robin after last recipient)
    const lastRecipientPosition = lastCycle.next_recipient_position || members.length;
    const nextPosition = (lastRecipientPosition % members.length) + 1;
    const nextRecipient = members.find(m => m.position === nextPosition);

    if (!nextRecipient) {
      console.error("❌ Could not determine next recipient!");
      await mongoose.connection.close();
      process.exit(1);
    }

    // Create cycle dates starting from last cycle's end date
    const startDate = new Date(lastCycle.end_date);
    const endDate = new Date(lastCycle.end_date);
    endDate.setDate(endDate.getDate() + 5);

    // Create the next cycle
    const newCycle = await Cycle.create({
      cycle_number: nextCycleNumber,
      start_date: startDate,
      end_date: endDate,
      total_members: members.length,
      monthly_contribution: 224,
      total_amount_expected: members.length * 224,
      total_amount_collected: 0,
      members_paid: 0,
      status: "active",
      next_recipient: nextRecipient._id,
      next_recipient_position: nextRecipient.position,
    });

    console.log("\n✅ Cycle created successfully!");
    console.log(`   Cycle Number: #${newCycle.cycle_number}`);
    console.log(`   Start Date: ${newCycle.start_date.toDateString()}`);
    console.log(`   End Date: ${newCycle.end_date.toDateString()}`);
    console.log(`   Total Members: ${newCycle.total_members}`);
    if (newCycle.total_amount_expected) {
      console.log(`   Expected Amount: KES ${newCycle.total_amount_expected.toLocaleString()}`);
    }
    console.log(`   Next Recipient: ${nextRecipient.name} (${nextRecipient.member_id})`);
    console.log(`   Position: #${nextRecipient.position}`);

    // Mark previous cycle as completed (optional)
    await Cycle.findByIdAndUpdate(lastCycle._id, { status: "completed" });
    console.log(`\n   Previous cycle #${lastCycle.cycle_number} marked as completed`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

createNextCycle();
