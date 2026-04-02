import mongoose from "mongoose";
import Loan from "../models/Loan.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/smcf");

  // Find loans marked as repaid but with unpaid late fees
  const loans = await Loan.find({
    status: "repaid",
    late_fees_accrued: { $gt: 0 },
    $expr: { $gt: ["$late_fees_accrued", { $ifNull: ["$late_fees_paid", 0] }] }
  });

  for (const loan of loans) {
    // Set status back to disbursed so member can continue paying
    loan.status = "disbursed";
    await loan.save();
    console.log(`Updated loan ${loan._id} for member ${loan.member_id} to status 'disbursed' (unpaid late fees)`);
  }

  console.log(`Processed ${loans.length} loans.`);
  mongoose.disconnect();
}

main().catch(err => {
  console.error("Error updating loans:", err);
  process.exit(1);
});
