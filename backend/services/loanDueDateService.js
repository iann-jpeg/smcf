import setLoanDueDates from "../scripts/set-loan-due-dates.js";
import cron from "node-cron";

export function startLoanDueDateCronJob() {
  console.log("📅 Starting daily loan due date fix cron job...");
  // Run every day at 00:10 AM
  cron.schedule("10 0 * * *", async () => {
    try {
      await setLoanDueDates();
      console.log("✅ Loan due date fix job completed");
    } catch (err) {
      console.error("❌ Loan due date fix job failed:", err);
    }
  });
  console.log("✅ Loan due date fix cron job scheduled (runs daily at 00:10)");
}
