import RepaymentRecord from '../models/RepaymentRecord';

export async function markOverdueRepayments(now = new Date()): Promise<{ matched: number; modified: number }> {
  const result = await RepaymentRecord.updateMany(
    {
      dueDate: { $lt: now },
      status: { $in: ['pending', 'partial'] },
    },
    { $set: { status: 'overdue' } }
  );

  const matched = (result as any).matchedCount ?? (result as any).n ?? 0;
  const modified = (result as any).modifiedCount ?? (result as any).nModified ?? 0;
  return { matched, modified };
}

export function startOverdueRepaymentJob(intervalMinutes = 60) {
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  const run = async () => {
    try {
      const { matched, modified } = await markOverdueRepayments();
      if (modified > 0) {
        console.log(`[overdue-job] Marked ${modified}/${matched} repayments overdue.`);
      }
    } catch (error) {
      console.error('[overdue-job] Failed to update overdue repayments:', error);
    }
  };

  run();
  return setInterval(run, intervalMs);
}
