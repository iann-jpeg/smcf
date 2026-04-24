import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkTopSaver() {
  try {
    console.log("🏆 Checking who is the top saver...\n");

    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/smcf";
    await mongoose.connect(mongoUri);
    console.log("✅ Database connected\n");

    const Member = (await import("../models/Member.js")).default;
    
    // Get all members sorted by total_savings
    const members = await Member.find({})
      .select("name member_id total_savings wallet_balance")
      .sort({ total_savings: -1 })
      .limit(10);

    console.log("📊 Top 10 Savers (by total_savings):\n");
    console.log(`Found ${members.length} members\n`);
    
    if (members.length === 0) {
      console.log("⚠️  No members found");
      await mongoose.connection.close();
      process.exit(0);
    }

    members.forEach((member, idx) => {
      const badge = idx === 0 ? "🏆" : "  ";
      console.log(`${badge} ${idx + 1}. ${member.name} (${member.member_id})`);
      console.log(`      Total Savings: KES ${member.total_savings}`);
      console.log(`      Wallet Balance: KES ${member.wallet_balance}\n`);
    });

    const topSaver = members[0];
    console.log(`\n🏆 TOP SAVER: ${topSaver.name} with KES ${topSaver.total_savings}`);
    console.log(`   Member ID: ${topSaver.member_id}`);
    console.log(`   Database _id: ${topSaver._id}\n`);

    await mongoose.connection.close();
    console.log("✅ Database connection closed");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkTopSaver();
