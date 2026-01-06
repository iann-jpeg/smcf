import cron from "node-cron";
import mongoose from "mongoose";
import Member from "../models/Member.js";
import Saving from "../models/Saving.js";

// Run every day at midnight to check and apply interest
export const startInterestCronJob = () => {
  console.log("📅 Starting monthly interest cron job...");
  
  // Run every day at 00:00 (midnight)
  cron.schedule("0 0 * * *", async () => {
    await applyMonthlyInterest();
  });

  console.log("✅ Interest cron job scheduled (runs daily at midnight)");
};

// Main interest calculation function - can be called manually or by cron
export const applyMonthlyInterest = async () => {
  try {
    console.log("\n💰 Running monthly interest calculation...");
    const today = new Date();
    
    // Get all members with savings (check both wallet_balance and total_savings)
    const members = await Member.find({ 
      $or: [
        { wallet_balance: { $gt: 0 } },
        { total_savings: { $gt: 0 } }
      ]
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
          amount: { $gt: 0 }
        }).sort({ created_at: 1 });

        for (const deposit of deposits) {
          // Use created_at as the deposit date (transaction_date is often undefined)
          const depositDate = new Date(deposit.transaction_date || deposit.created_at || deposit.createdAt);
          
          // Skip if we can't determine the deposit date
          if (isNaN(depositDate.getTime())) {
            console.log(`⚠️ Skipping deposit ${deposit._id} - invalid date`);
            continue;
          }

          const daysSinceDeposit = Math.floor(
            (today - depositDate) / (1000 * 60 * 60 * 24)
          );

          // Check if 30+ days have passed
          if (daysSinceDeposit >= 30) {
            const expectedPeriods = Math.floor(daysSinceDeposit / 30);
            const depositDateStr = depositDate.toDateString();
            
            // Check how many interest payments have been made for this specific deposit
            const existingInterests = await Saving.find({
              member_id: member._id,
              transaction_type: "interest",
              status: "completed",
              notes: { $regex: depositDateStr, $options: "i" }
            });

            const appliedPeriods = existingInterests.length;

            // Apply interest for any missing periods
            if (appliedPeriods < expectedPeriods) {
              const periodsToApply = expectedPeriods - appliedPeriods;
              
              for (let i = 0; i < periodsToApply; i++) {
                // Calculate 3% interest
                const interestAmount = Math.round(deposit.amount * 0.03);
                
                if (interestAmount <= 0) continue;

                // Get current balance
                const lastTransaction = await Saving.findOne({
                  member_id: member._id,
                  status: "completed"
                }).sort({ created_at: -1 });
                
                const currentBalance = lastTransaction?.balance_after || 
                                       member.wallet_balance || 
                                       member.total_savings || 0;

                // Create interest transaction
                await Saving.create({
                  member_id: member._id,
                  amount: interestAmount,
                  transaction_type: "interest",
                  balance_before: currentBalance,
                  balance_after: currentBalance + interestAmount,
                  interest_rate: 3,
                  interest_amount: interestAmount,
                  payment_method: "auto_interest",
                  status: "completed",
                  created_at: today,
                  notes: `3% monthly interest on deposit from ${depositDateStr}`,
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
                  `✅ Applied KES ${interestAmount} interest to ${member.name} (${member.member_id}) for deposit from ${depositDateStr}`
                );
                interestAppliedCount++;
                totalInterestApplied += interestAmount;

                // Emit socket event for real-time update
                if (global.io) {
                  global.io.emit("interestApplied", {
                    member_id: member._id,
                    memberName: member.name,
                    amount: interestAmount,
                  });
                }
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
    
    return {
      appliedCount: interestAppliedCount,
      totalAmount: totalInterestApplied
    };
  } catch (error) {
    console.error("❌ Error in interest calculation:", error);
    throw error;
  }
};
