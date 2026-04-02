import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const createInitialCycle = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Check if cycle already exists
    const existingCycle = await Cycle.findOne({ status: "active" });
    if (existingCycle) {
      console.log("⚠️  Active cycle already exists:");
      console.log(`   Cycle #${existingCycle.cycle_number}`);
      console.log(`   Start: ${existingCycle.start_date}`);
      console.log(`   End: ${existingCycle.end_date}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Get all active members sorted by position
    const members = await Member.find({ status: "active" }).sort({ position: 1 });
    
    if (members.length === 0) {
      console.error("❌ No active members found! Please add members first.");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📊 Found ${members.length} active members`);

    // Get the first member as next recipient
    const firstRecipient = members[0];

    // Create cycle dates (5-day cycle)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 5);

    // Create the first cycle
    const cycle = await Cycle.create({
      cycle_number: 1,
      start_date: startDate,
      end_date: endDate,
      total_members: members.length,
      monthly_contribution: 224,
      total_amount_expected: members.length * 224,
      total_amount_collected: 0,
      members_paid: 0,
      status: "active",
      next_recipient: firstRecipient._id,
      next_recipient_position: firstRecipient.position,
    });

    console.log("\n✅ Cycle created successfully!");
    console.log(`   Cycle Number: #${cycle.cycle_number}`);
    console.log(`   Start Date: ${cycle.start_date.toDateString()}`);
    console.log(`   End Date: ${cycle.end_date.toDateString()}`);
    console.log(`   Total Members: ${cycle.total_members}`);
    console.log(`   Expected Amount: KES ${cycle.total_amount_expected.toLocaleString()}`);
    console.log(`   Next Recipient: ${firstRecipient.name} (${firstRecipient.member_id})`);
    console.log(`   Position: #${firstRecipient.position}`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

createInitialCycle();
