import cron from "node-cron";
import mongoose from "mongoose";
import Member from "../models/Member.js";
import Saving from "../models/Saving.js";
import SystemSettings from "../models/SystemSettings.js";

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

    const systemSettings = await SystemSettings.findOne().lean();
    const monthlyRate = Number.isFinite(systemSettings?.wallet_interest_rate)
      ? Number(systemSettings.wallet_interest_rate)
      : 3;

    const members = await Member.find({ wallet_balance: { $gt: 0 } });
    console.log(`📊 Found ${members.length} members with wallet balances`);

    let interestAppliedCount = 0;
    let totalInterestApplied = 0;

    for (const member of members) {
      try {
        const deposits = await Saving.find({
          member_id: member._id,
          transaction_type: "deposit",
          status: "completed",
          amount: { $gt: 0 },
        }).sort({ created_at: 1 });

        if (deposits.length === 0) continue;

        const firstDepositDate = new Date(deposits[0].created_at || deposits[0].createdAt);
        if (Number.isNaN(firstDepositDate.getTime())) continue;

        const daysSinceFirstDeposit = Math.floor((today - firstDepositDate) / (1000 * 60 * 60 * 24));
        const periodsDue = Math.max(0, Math.floor(daysSinceFirstDeposit / 30));
        if (periodsDue < 1) continue;

        const existingPeriods = new Set(
          (await Saving.find({
            member_id: member._id,
            transaction_type: "interest",
            status: "completed",
            interest_period: { $ne: "" },
          }).select("interest_period").lean()).map((item) => item.interest_period)
        );

        for (let periodIndex = 1; periodIndex <= periodsDue; periodIndex++) {
          const periodDate = new Date(firstDepositDate);
          periodDate.setDate(periodDate.getDate() + periodIndex * 30);
          const interestPeriod = `${periodDate.getUTCFullYear()}-${String(periodDate.getUTCMonth() + 1).padStart(2, "0")}`;

          if (existingPeriods.has(interestPeriod)) continue;

          const currentBalance = Number(member.wallet_balance || 0);
          const interestAmount = Math.round(currentBalance * (monthlyRate / 100));
          if (interestAmount <= 0) continue;

          try {
            await Saving.create({
              member_id: member._id,
              amount: interestAmount,
              transaction_type: "interest",
              balance_before: currentBalance,
              balance_after: currentBalance + interestAmount,
              interest_rate: monthlyRate,
              interest_amount: interestAmount,
              interest_period: interestPeriod,
              payment_method: "auto_interest",
              status: "completed",
              created_at: today,
              notes: `${monthlyRate}% monthly wallet interest for ${interestPeriod}`,
            });

            await Member.updateOne({ _id: member._id }, { $inc: { wallet_balance: interestAmount } });
            member.wallet_balance = Number(member.wallet_balance || 0) + interestAmount;
            existingPeriods.add(interestPeriod);
            interestAppliedCount++;
            totalInterestApplied += interestAmount;

            if (global.io) {
              global.io.emit("interestApplied", {
                member_id: member._id,
                memberName: member.name,
                amount: interestAmount,
                interestPeriod,
              });
            }
          } catch (error) {
            if (error?.code !== 11000) throw error;
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
      totalAmount: totalInterestApplied,
    };
  } catch (error) {
    console.error("❌ Error in interest calculation:", error);
    throw error;
  }
};
