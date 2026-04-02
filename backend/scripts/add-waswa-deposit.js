import mongoose from "mongoose";
import Member from "../models/Member.js";
import dotenv from "dotenv";

dotenv.config();

const addWaswaDeposit = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://smartmovescashflow:12345@smcf.mongodb.net/smcf?retryWrites=true&w=majority";
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Find Waswa's member record
    const member = await Member.findOne({ phone: "0759968814" });
    
    if (!member) {
      console.error("❌ Member Waswa not found!");
      process.exit(1);
    }

    console.log(`📝 Found member: ${member.name} (${member.member_id})`);
    console.log(`   Current wallet balance: KES ${member.wallet_balance || 0}`);
    console.log(`   Current total savings: KES ${member.total_savings || 0}\n`);

    // Create the Saving model if it doesn't exist (we'll need to import it)
    const SavingSchema = new mongoose.Schema({
      member_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      transaction_type: {
        type: String,
        enum: ["deposit", "withdrawal", "interest"],
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "completed",
      },
      transaction_date: {
        type: Date,
        default: Date.now,
      },
      notes: String,
      created_at: {
        type: Date,
        default: Date.now,
      },
    });

    const Saving = mongoose.models.Saving || mongoose.model("Saving", SavingSchema);

    // Create deposit transaction dated December 3, 2025
    const depositDate = new Date("2025-12-03T10:00:00.000Z");
    
    const savingTransaction = await Saving.create({
      member_id: member._id,
      amount: 10000,
      transaction_type: "deposit",
      status: "completed",
      transaction_date: depositDate,
      notes: "Wallet deposit - KES 10,000",
      created_at: depositDate,
    });

    console.log(`✅ Created saving transaction:`);
    console.log(`   Amount: KES 10,000`);
    console.log(`   Date: December 3, 2025`);
    console.log(`   Type: Deposit`);
    console.log(`   Status: Completed\n`);

    // Update member's wallet balance and total savings
    await Member.updateOne(
      { _id: member._id },
      {
        $inc: {
          wallet_balance: 10000,
          total_savings: 10000,
        },
      }
    );

    console.log(`✅ Updated member wallet:`);
    console.log(`   New wallet balance: KES 10,000`);
    console.log(`   New total savings: KES 10,000`);

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

addWaswaDeposit();
