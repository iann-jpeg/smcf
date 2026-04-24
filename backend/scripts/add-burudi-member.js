import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function addBurudiMember() {
  try {
    console.log("👤 Adding Burudi to the system...\n");

    const mongoUri = "mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(mongoUri);
    console.log("✅ Database connected\n");

    const Member = (await import("../models/Member.js")).default;
    
    // Check if member already exists
    const existingMember = await Member.findOne({ phone: "0700813253" });
    if (existingMember) {
      console.log("⚠️  Member already exists:");
      console.log(`   Name: ${existingMember.name}`);
      console.log(`   Member ID: ${existingMember.member_id}`);
      console.log(`   Phone: ${existingMember.phone}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Get the highest member number to generate next member_id
    const lastMember = await Member.findOne().sort({ member_id: -1 });
    let nextMemberNumber = 1;
    
    if (lastMember && lastMember.member_id) {
      const lastNumber = parseInt(lastMember.member_id.replace("SMCF-", ""));
      nextMemberNumber = lastNumber + 1;
    }

    const newMemberId = `SMCF-${String(nextMemberNumber).padStart(4, "0")}`;

    // Get total member count for position
    const memberCount = await Member.countDocuments();
    const position = memberCount + 1;

    // Create new member
    const newMember = await Member.create({
      name: "Burudi",
      phone: "0700813253",
      member_id: newMemberId,
      position: position,
      status: "active",
      is_admin: false,
      registered_by_admin: true,
      password: "burudi123", // Will be hashed by the model
      monthly_contribution: 224,
      wallet_balance: 0,
      total_savings: 0,
      total_contributed: 0,
      total_received: 0,
      payment_status: "pending",
      join_date: new Date(),
    });

    console.log("✅ Member added successfully!\n");
    console.log("📋 Member Details:");
    console.log(`   Name: ${newMember.name}`);
    console.log(`   Member ID: ${newMember.member_id}`);
    console.log(`   Phone: ${newMember.phone}`);
    console.log(`   Position: ${newMember.position}`);
    console.log(`   Status: ${newMember.status}`);
    console.log(`   Default Password: burudi123`);
    console.log(`   Monthly Contribution: KES ${newMember.monthly_contribution}`);
    console.log(`   Join Date: ${newMember.join_date.toLocaleDateString()}\n`);

    console.log("ℹ️  Login credentials:");
    console.log(`   Phone: ${newMember.phone}`);
    console.log(`   Password: burudi123`);
    console.log(`   (User should change password after first login)\n`);

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

addBurudiMember();
