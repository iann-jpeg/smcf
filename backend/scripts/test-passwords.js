import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const testPasswords = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all members with passwords
    const members = await Member.find().select("+password");
    
    console.log(`Found ${members.length} members:\n`);
    
    for (const member of members) {
      console.log(`Member: ${member.name} (${member.phone})`);
      console.log(`  Member ID: ${member.member_id}`);
      console.log(`  Has password: ${!!member.password}`);
      console.log(`  Password length: ${member.password ? member.password.length : 0}`);
      console.log(`  Looks hashed: ${member.password && member.password.startsWith('$2') ? 'Yes' : 'No'}`);
      console.log(`  Status: ${member.status}`);
      console.log(`  Registered by admin: ${member.registered_by_admin}`);
      console.log("");
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

testPasswords();
