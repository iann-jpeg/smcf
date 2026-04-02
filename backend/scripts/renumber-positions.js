import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const renumberPositions = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all members sorted by current position
    const members = await Member.find().sort({ position: 1, created_at: 1 });
    
    console.log(`Found ${members.length} members\n`);
    console.log("Current positions:");
    members.forEach(m => {
      console.log(`  ${m.member_id}: ${m.name} - Position ${m.position}`);
    });

    console.log("\n🔄 Renumbering positions sequentially...\n");

    // Renumber all members sequentially starting from 1
    for (let i = 0; i < members.length; i++) {
      const newPosition = i + 1;
      const member = members[i];
      
      if (member.position !== newPosition) {
        await Member.updateOne(
          { _id: member._id },
          { $set: { position: newPosition } }
        );
        console.log(`  ✅ ${member.member_id}: ${member.name} - Position ${member.position} → ${newPosition}`);
      } else {
        console.log(`  ⏭️  ${member.member_id}: ${member.name} - Position ${newPosition} (no change)`);
      }
    }

    console.log("\n✅ Renumbering complete!");
    console.log(`   All ${members.length} members now have sequential positions from 1 to ${members.length}`);

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

renumberPositions();
