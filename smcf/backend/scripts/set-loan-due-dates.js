import mongoose from "mongoose";
import Loan from "../models/Loan.js";
import Member from "../models/Member.js";

// MongoDB connection
const MONGODB_URI = "mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf";

export default async function setLoanDueDates() {
  let shouldDisconnect = false;
  
  try {
    // Only connect if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
      console.log("✅ Connected to MongoDB");
      shouldDisconnect = true;
    }

    // Find all disbursed loans without due_date
    const loans = await Loan.find({
      status: "disbursed",
    }).populate("member_id", "name phone");

    console.log(`📋 Found ${loans.length} active loans to check`);

    let updated = 0;

    for (const loan of loans) {
      if (loan.disbursement_date && !loan.due_date) {
        // Set due date to 30 days after disbursement
        const dueDate = new Date(loan.disbursement_date);
        dueDate.setDate(dueDate.getDate() + 30);

        loan.due_date = dueDate;
        await loan.save();

        console.log(`✅ Set due date for ${loan.member_id?.name || "Unknown"}: ${dueDate.toLocaleDateString()}`);
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} loans with due dates`);

    // Only disconnect if we connected in this function
    if (shouldDisconnect) {
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  } catch (error) {
    console.error("❌ Error setting loan due dates:", error.message);
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
    // Don't exit in production when called from server.js
    if (process.argv[1] === new URL(import.meta.url).pathname) {
      process.exit(1);
    }
  }
}


// Only run if called directly from CLI
if (process.argv[1] === new URL(import.meta.url).pathname) {
  setLoanDueDates();
}
