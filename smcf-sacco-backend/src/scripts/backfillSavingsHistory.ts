import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import SavingsHistory from '../models/SavingsHistory';

dotenv.config();

function getSavingsHistoryMonthKey(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

async function run(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('Missing required env var: MONGODB_URI');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const completedDeposits = await Transaction.find({ type: 'deposit', status: 'completed' })
    .select('memberId amount processedAt createdAt transactionRef mpesaRef')
    .sort({ processedAt: 1, createdAt: 1 })
    .lean();

  const monthlyTotals = new Map<string, number>();

  for (const deposit of completedDeposits) {
    const memberId = String(deposit.memberId);
    const processedAt = new Date((deposit.processedAt ?? deposit.createdAt ?? new Date()) as string | number | Date);

    if (Number.isNaN(processedAt.getTime())) {
      continue;
    }

    const month = getSavingsHistoryMonthKey(processedAt);
    const key = `${memberId}::${month}`;
    const amount = Math.round(Number(deposit.amount) || 0);

    if (amount <= 0) {
      continue;
    }

    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + amount);
  }

  const operations: any[] = Array.from(monthlyTotals.entries()).map(([key, amount]) => {
    const separatorIndex = key.indexOf('::');
    const memberId = key.slice(0, separatorIndex);
    const month = key.slice(separatorIndex + 2);

    return {
      updateOne: {
        filter: { memberId, month },
        update: {
          $set: { amount },
          $setOnInsert: { memberId, month, createdAt: new Date() },
        },
        upsert: true,
      },
    };
  });

  if (operations.length === 0) {
    console.log('No completed deposit transactions found. Nothing to backfill.');
  } else {
    const result = await SavingsHistory.bulkWrite(operations as any, { ordered: false });
    console.log(`Backfilled ${monthlyTotals.size} savings-history rows from ${completedDeposits.length} completed deposits.`);
    console.log(`Matched: ${result.matchedCount ?? 0}, modified: ${result.modifiedCount ?? 0}, upserted: ${result.upsertedCount ?? 0}`);
  }

  await mongoose.disconnect();
  console.log('Backfill complete.');
}

run().catch(async (error) => {
  console.error('Backfill failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors during failure cleanup
  }
  process.exit(1);
});