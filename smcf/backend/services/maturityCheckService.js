import Saving from "../models/Saving.js";

/**
 * Check for matured deposits and update their status
 * Should be run daily via cron job or scheduler
 */
export async function checkMaturedDeposits() {
  try {
    const now = new Date();
    
    console.log("🔍 Running daily maturity check...");

    // Find all locked deposits that have reached their unlock date
    const maturedDeposits = await Saving.find({
      transaction_type: "deposit",
      status: "completed",
      maturity_status: "locked",
      unlock_date: { $lte: now }, // unlock_date has passed
    });

    if (maturedDeposits.length === 0) {
      console.log("✅ No deposits matured today");
      return { success: true, count: 0 };
    }

    console.log(`📅 Found ${maturedDeposits.length} matured deposits`);

    // Update each matured deposit
    const updatePromises = maturedDeposits.map(async (deposit) => {
      deposit.maturity_status = "matured";
      deposit.maturity_reached_date = now;
      await deposit.save();
      
      console.log(`✅ Matured: ${deposit._id} - Member: ${deposit.member_id} - Amount: KES ${deposit.amount}`);
      
      return deposit;
    });

    const updatedDeposits = await Promise.all(updatePromises);

    console.log(`🎉 Successfully matured ${updatedDeposits.length} deposits`);

    return {
      success: true,
      count: updatedDeposits.length,
      deposits: updatedDeposits,
    };
  } catch (error) {
    console.error("❌ Error checking matured deposits:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get maturity statistics
 */
export async function getMaturityStats() {
  try {
    const [locked, matured, withdrawn] = await Promise.all([
      Saving.countDocuments({
        transaction_type: "deposit",
        status: "completed",
        maturity_status: "locked",
      }),
      Saving.countDocuments({
        transaction_type: "deposit",
        status: "completed",
        maturity_status: "matured",
      }),
      Saving.countDocuments({
        transaction_type: "deposit",
        maturity_status: "withdrawn",
      }),
    ]);

    // Get upcoming maturities (next 7 days)
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingMaturities = await Saving.find({
      transaction_type: "deposit",
      status: "completed",
      maturity_status: "locked",
      unlock_date: { $gte: now, $lte: nextWeek },
    }).populate("member_id", "name member_id");

    return {
      success: true,
      stats: {
        locked,
        matured,
        withdrawn,
        upcomingMaturities: upcomingMaturities.length,
      },
      upcomingDeposits: upcomingMaturities,
    };
  } catch (error) {
    console.error("Error getting maturity stats:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Mark a deposit as withdrawn when withdrawal is approved
 */
export async function markDepositAsWithdrawn(depositIds) {
  try {
    if (!Array.isArray(depositIds)) {
      depositIds = [depositIds];
    }

    const result = await Saving.updateMany(
      {
        _id: { $in: depositIds },
        transaction_type: "deposit",
      },
      {
        $set: {
          maturity_status: "withdrawn",
        },
      }
    );

    console.log(`✅ Marked ${result.modifiedCount} deposits as withdrawn`);

    return {
      success: true,
      count: result.modifiedCount,
    };
  } catch (error) {
    console.error("Error marking deposits as withdrawn:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  checkMaturedDeposits,
  getMaturityStats,
  markDepositAsWithdrawn,
};
