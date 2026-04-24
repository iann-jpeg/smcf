import cron from "node-cron";
import Loan from "../models/Loan.js";

/**
 * Calculate and apply daily late fees to overdue loans
 * Late fee is applied as 3% of the remaining balance per day
 * Partial payments reduce the remaining balance, so late fees apply only to what's left
 */
export const applyLateFees = async () => {
  try {
    console.log("\n📋 Running late fee calculation (3% daily rate)...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all disbursed loans that are past due date and have remaining balance
    const overdueLoans = await Loan.find({
      status: "disbursed",
      due_date: { $lt: today },
      amount_remaining: { $gt: 0 }
    }).populate("member_id", "name phone member_id");

    console.log(`📊 Found ${overdueLoans.length} overdue loans with remaining balance`);

    let feesAppliedCount = 0;
    let totalFeesApplied = 0;

    for (const loan of overdueLoans) {
      try {
        const lastFeeDate = loan.last_late_fee_date 
          ? new Date(loan.last_late_fee_date) 
          : new Date(loan.due_date);
        lastFeeDate.setHours(0, 0, 0, 0);
        
        // Calculate days since last fee application
        const daysSinceLastFee = Math.floor((today - lastFeeDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastFee > 0) {
          // Calculate base amount for late fee - uses current remaining balance
          // This naturally accounts for partial payments since amount_remaining is updated when payments are made
          const baseAmount = loan.amount_remaining || 0;
          const dailyRate = (loan.late_fee_rate || 3) / 100; // Default 3% per day
          
          // Calculate late fee for the days that have passed
          // Using simple interest: fee = remaining * rate * days
          // Partial payments reduce amount_remaining, so fees are only on unpaid portion
          const lateFee = Math.round(baseAmount * dailyRate * daysSinceLastFee);
          
          if (lateFee > 0) {
            // Update loan with new late fees
            loan.late_fees_accrued = (loan.late_fees_accrued || 0) + lateFee;
            loan.last_late_fee_date = today;
            
            await loan.save();

            console.log(
              `⚠️ Applied KES ${lateFee} late fee to ${loan.member_id?.name || 'Unknown'} ` +
              `(${daysSinceLastFee} days overdue, ${loan.late_fee_rate || 1}% daily rate)`
            );
            
            feesAppliedCount++;
            totalFeesApplied += lateFee;

            // Emit socket event for real-time update
            if (global.io) {
              global.io.emit("loanLateFeeApplied", {
                loanId: loan._id,
                memberId: loan.member_id?._id,
                memberName: loan.member_id?.name,
                lateFee: lateFee,
                totalLateFees: loan.late_fees_accrued,
                daysOverdue: daysSinceLastFee,
                newTotalRepayable: loan.total_repayable,
                newAmountRemaining: loan.amount_remaining,
              });
            }
          }
        }
      } catch (error) {
        console.error(
          `❌ Error processing late fee for loan ${loan._id}:`,
          error.message
        );
      }
    }

    if (feesAppliedCount > 0) {
      console.log(
        `\n💰 Late fee calculation complete: Applied KES ${totalFeesApplied} to ${feesAppliedCount} loans`
      );
    } else {
      console.log("\n✓ No late fees to apply today");
    }

    return {
      processedCount: feesAppliedCount,
      totalFees: totalFeesApplied
    };
  } catch (error) {
    console.error("❌ Error in late fee calculation:", error);
    throw error;
  }
};

/**
 * Calculate late fees for a specific loan without saving
 * Used for real-time display
 */
export const calculateLateFeeForLoan = (loan) => {
  if (!loan || loan.status !== "disbursed") {
    return { lateFee: 0, daysOverdue: 0, isOverdue: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = loan.due_date ? new Date(loan.due_date) : null;
  if (!dueDate) {
    return { lateFee: 0, daysOverdue: 0, isOverdue: false };
  }
  dueDate.setHours(0, 0, 0, 0);

  if (today <= dueDate) {
    return { lateFee: 0, daysOverdue: 0, isOverdue: false };
  }

  const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  
  // Calculate pending late fees not yet applied
  const lastFeeDate = loan.last_late_fee_date 
    ? new Date(loan.last_late_fee_date) 
    : dueDate;
  lastFeeDate.setHours(0, 0, 0, 0);
  
  const daysSinceLastFee = Math.floor((today - lastFeeDate) / (1000 * 60 * 60 * 24));
  // Base amount is the current remaining balance (reduced by any partial payments)
  const baseAmount = loan.amount_remaining || 0;
  const dailyRate = (loan.late_fee_rate || 3) / 100; // 3% per day default
  const pendingLateFee = Math.round(baseAmount * dailyRate * daysSinceLastFee);

  return {
    lateFee: pendingLateFee,
    totalLateFees: (loan.late_fees_accrued || 0) + pendingLateFee,
    daysOverdue,
    isOverdue: true,
    dailyRate: loan.late_fee_rate || 1
  };
};

/**
 * Start the late fee cron job - runs daily at midnight
 */
export const startLateFeesCronJob = () => {
  console.log("📅 Starting daily late fees cron job...");
  
  // Run every day at 00:05 (5 minutes after midnight, after interest job)
  cron.schedule("5 0 * * *", async () => {
    await applyLateFees();
  });

  console.log("✅ Late fees cron job scheduled (runs daily at 00:05)");
};
