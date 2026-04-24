import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const hashUnhashedPasswords = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all members with passwords
    const members = await Member.find().select("+password");
    
    let hashedCount = 0;
    
    for (const member of members) {
      // Check if password is not hashed (doesn't start with $2 from bcrypt)
      if (member.password && !member.password.startsWith('$2')) {
        console.log(`🔐 Hashing password for: ${member.name} (${member.phone})`);
        console.log(`   Old password length: ${member.password.length}`);
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(member.password, 12);
        
        // Update directly in database to bypass validation
        await Member.updateOne(
          { _id: member._id },
          { $set: { password: hashedPassword } }
        );
        
        console.log(`   ✅ Password hashed (new length: ${hashedPassword.length})\n`);
        hashedCount++;
      }
    }

    console.log(`\n✅ Hashed ${hashedCount} passwords`);
    console.log(`   ${members.length - hashedCount} passwords were already hashed`);

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

hashUnhashedPasswords();
