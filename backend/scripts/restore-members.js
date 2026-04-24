import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const membersData = [
  { position: 1, name: "IANN_DIOR", phone: "0759097157", password: "smcf2024" },
  { position: 2, name: "Fidel", phone: "0703765387", password: "smcf2024" },
  { position: 3, name: "Abu", phone: "+254759097157", password: "smcf2024" },
  { position: 4, name: "Jodre", phone: "0113336777", password: "smcf2024" },
  { position: 5, name: "Steve", phone: "0724926558", password: "smcf2024" },
  { position: 6, name: "Val", phone: "0790716303", password: "smcf2024" },
  { position: 7, name: "Josh", phone: "+254113336777", password: "smcf2024" },
  { position: 8, name: "Max Prime", phone: "0705907913", password: "smcf2024" },
  { position: 9, name: "jared 1", phone: "0708885243", password: "smcf2024" },
  { position: 10, name: "Daniel", phone: "0745170339", password: "smcf2024" },
  { position: 11, name: "Harmony", phone: "0117487554", password: "smcf2024" },
  { position: 12, name: "CECILIA NJOROGE", phone: "0710201545", password: "smcf2024" },
  { position: 13, name: "Chebet", phone: "0116743060", password: "smcf2024" },
  { position: 14, name: "Sylvia", phone: "0717375697", password: "smcf2024" },
  { position: 15, name: "BIKO", phone: "+254724926558", password: "smcf2024" },
  { position: 16, name: "Winnie C", phone: "0769778315", password: "smcf2024" },
  { position: 17, name: "Ngomi", phone: "+254745170339", password: "smcf2024" },
  { position: 18, name: "Japheth", phone: "0740422442", password: "smcf2024" },
  { position: 19, name: "Tess", phone: "0769383304", password: "smcf2024" },
  { position: 20, name: "jared 2", phone: "+254708885243", password: "smcf2024" },
  { position: 21, name: "Awilly", phone: "0790521151", password: "smcf2024" },
  { position: 22, name: "Waswa", phone: "0759968814", password: "smcf2024" },
  { position: 23, name: "Joy Okello", phone: "0115225854", password: "smcf2024" },
  { position: 24, name: "Sandra Koech", phone: "0718294594", password: "smcf2024" },
  { position: 25, name: "Saline", phone: "0712901940", password: "smcf2024" },
  { position: 26, name: "Edwin Kimathiii", phone: "0745334389", password: "smcf2024" },
];

const restoreMembers = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    console.log("🔄 Restoring 26 members...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const memberData of membersData) {
      try {
        const member_id = `SMCF-${memberData.position.toString().padStart(4, "0")}`;
        
        const newMember = await Member.create({
          member_id,
          name: memberData.name,
          phone: memberData.phone,
          password: memberData.password,
          position: memberData.position,
          registered_by_admin: true,
          status: "active",
          monthly_contribution: 224,
          total_contributed: 0,
          total_received: 0,
        });

        console.log(`✅ ${member_id}: ${memberData.name} (${memberData.phone})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to restore ${memberData.name}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n✅ Restoration complete!`);
    console.log(`   Successfully restored: ${successCount} members`);
    console.log(`   Failed: ${errorCount} members`);
    console.log(`\n📝 All members have password: smcf2024`);
    console.log(`   Members can login with their phone number and this password`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

restoreMembers();
