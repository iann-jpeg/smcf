import mongoose from "mongoose";
import Loan from "../models/Loan.js";
import Member from "../models/Member.js";

// MongoDB connection
const MONGODB_URI = "mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf";

async function setLoanDueDates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all disbursed loans without due_date
    const loans = await Loan.find({
      status: "disbursed",
    }).populate("member_id", "name phone");

    console.log(`\n📋 Found ${loans.length} active loans to check:\n`);

    let updated = 0;

    for (const loan of loans) {
      console.log(`\n--- Loan for ${loan.member_id?.name || "Unknown"} ---`);
      console.log(`   Amount: KES ${loan.amount}`);
      console.log(`   Disbursement Date: ${loan.disbursement_date ? new Date(loan.disbursement_date).toLocaleDateString() : "Not set"}`);
      console.log(`   Current Due Date: ${loan.due_date ? new Date(loan.due_date).toLocaleDateString() : "Not set"}`);

      if (loan.disbursement_date && !loan.due_date) {
        // Set due date to 30 days after disbursement
        const dueDate = new Date(loan.disbursement_date);
        dueDate.setDate(dueDate.getDate() + 30);

        loan.due_date = dueDate;
        await loan.save();

        console.log(`   ✅ Set Due Date to: ${dueDate.toLocaleDateString()}`);
        updated++;
      } else if (!loan.disbursement_date) {
        console.log(`   ⚠️ No disbursement date found - cannot set due date`);
      } else {
        console.log(`   ℹ️ Due date already set`);
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ Updated ${updated} loans with due dates`);
    console.log(`========================================\n`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

setLoanDueDates();
