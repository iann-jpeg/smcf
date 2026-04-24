import mongoose from "mongoose";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const checkCycleDetails = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get active cycle with recipient details
    const cycle = await Cycle.findOne({ status: "active" }).populate("next_recipient");
    
    if (!cycle) {
      console.log("❌ No active cycle found");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log("📊 Active Cycle Details:");
    console.log(`   Cycle Number: #${cycle.cycle_number}`);
    console.log(`   Status: ${cycle.status}`);
    console.log(`   Start: ${cycle.start_date}`);
    console.log(`   End: ${cycle.end_date}`);
    console.log(`   Total Members: ${cycle.total_members}`);
    console.log(`   Members Paid: ${cycle.members_paid}`);
    console.log(`   Amount Collected: KES ${cycle.total_amount_collected}`);
    console.log(`   Expected Amount: KES ${cycle.total_amount_expected}`);
    console.log(`   Next Recipient ID: ${cycle.next_recipient}`);
    
    if (cycle.next_recipient) {
      const recipient = await Member.findById(cycle.next_recipient);
      if (recipient) {
        console.log(`\n✅ Next Recipient Details:`);
        console.log(`   Name: ${recipient.name}`);
        console.log(`   Member ID: ${recipient.member_id}`);
        console.log(`   Phone: ${recipient.phone}`);
        console.log(`   Position: ${recipient.position}`);
      } else {
        console.log(`\n⚠️  Next recipient ID exists but member not found in database`);
      }
    } else {
      console.log(`\n⚠️  Next recipient not set on cycle`);
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkCycleDetails();
