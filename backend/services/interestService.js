import cron from "node-cron";
import mongoose from "mongoose";
import Member from "../models/Member.js";
import Saving from "../models/Saving.js";

// Run every day at midnight to check and apply interest
export const startInterestCronJob = () => {
  console.log("📅 Starting monthly interest cron job...");
  
  // Run every day at 00:00 (midnight)
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("\n💰 Running monthly interest calculation...");
      const today = new Date();
      
      // Get all members with savings
      const members = await Member.find({ 
        wallet_balance: { $gt: 0 } 
      });

      console.log(`📊 Found ${members.length} members with savings`);

      let interestAppliedCount = 0;
      let totalInterestApplied = 0;

      for (const member of members) {
        try {
          // Get all deposits for this member
          const deposits = await Saving.find({
            member_id: member._id,
            transaction_type: "deposit",
            status: "completed",
          }).sort({ transaction_date: 1 });

          for (const deposit of deposits) {
            const depositDate = new Date(deposit.transaction_date);
            const daysSinceDeposit = Math.floor(
              (today - depositDate) / (1000 * 60 * 60 * 24)
            );

            // Check if exactly 30 days have passed (or multiples of 30)
            if (daysSinceDeposit > 0 && daysSinceDeposit % 30 === 0) {
              // Check if interest was already applied for this period
              const lastInterestDate = new Date(depositDate);
              lastInterestDate.setDate(
                lastInterestDate.getDate() + Math.floor(daysSinceDeposit / 30) * 30
              );

              const existingInterest = await Saving.findOne({
                member_id: member._id,
                transaction_type: "interest",
                transaction_date: {
                  $gte: lastInterestDate,
                  $lt: new Date(lastInterestDate.getTime() + 24 * 60 * 60 * 1000),
                },
                notes: { $regex: `Interest on deposit from ${depositDate.toDateString()}` },
              });

              if (!existingInterest) {
                // Calculate 3% interest
                const interestAmount = Math.round(deposit.amount * 0.03);

                // Create interest transaction
                await Saving.create({
                  member_id: member._id,
                  amount: interestAmount,
                  transaction_type: "interest",
                  status: "completed",
                  transaction_date: today,
                  notes: `3% monthly interest on deposit from ${depositDate.toDateString()}`,
                });

                // Update member's wallet balance
                await Member.updateOne(
                  { _id: member._id },
                  {
                    $inc: {
                      wallet_balance: interestAmount,
                      total_savings: interestAmount,
                    },
                  }
                );

                console.log(
                  `✅ Applied KES ${interestAmount} interest to ${member.name} (${member.member_id})`
                );
                interestAppliedCount++;
                totalInterestApplied += interestAmount;

                // Emit socket event for real-time update
                if (global.io) {
                  global.io.emit("interestApplied", {
                    member_id: member._id,
                    amount: interestAmount,
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(
            `❌ Error processing interest for ${member.name}:`,
            error.message
          );
        }
      }

      if (interestAppliedCount > 0) {
        console.log(
          `\n🎉 Interest calculation complete: Applied KES ${totalInterestApplied} to ${interestAppliedCount} transactions`
        );
      } else {
        console.log("\n✓ No interest due today");
      }
    } catch (error) {
      console.error("❌ Error in interest cron job:", error);
    }
  });

  console.log("✅ Interest cron job scheduled (runs daily at midnight)");
};
