import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const updatePasswords = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all members sorted by position
    const members = await Member.find().sort({ position: 1 });
    
    console.log(`🔄 Updating passwords for ${members.length} members...\n`);

    for (const member of members) {
      // Password format: smcf-0001, smcf-0002, etc (lowercase)
      const password = member.member_id.toLowerCase();
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Update in database
      await Member.updateOne(
        { _id: member._id },
        { $set: { password: hashedPassword } }
      );
      
      console.log(`✅ ${member.member_id}: ${member.name} - Password set to: ${password}`);
    }

    console.log(`\n✅ All passwords updated!`);
    console.log(`\n📝 Member Login Format:`);
    console.log(`   Phone: Their phone number`);
    console.log(`   Password: smcf-0001 (lowercase, matching their member ID)`);
    console.log(`\n   Examples:`);
    console.log(`   - IANN_DIOR logs in with: 0759097157 / smcf-0001`);
    console.log(`   - Fidel logs in with: 0703765387 / smcf-0002`);
    console.log(`   - Edwin Kimathiii logs in with: 0745334389 / smcf-0026`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

updatePasswords();
