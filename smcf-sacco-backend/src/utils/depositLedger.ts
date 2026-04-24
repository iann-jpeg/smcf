import Member from '../models/Member';
import SavingsHistory from '../models/SavingsHistory';
import { notifyStaff } from './notify';

export interface RecordSavingsDepositParams {
  memberId: string;
  amount: number;
  reference: string;
  sourceLabel: string;
  processedAt?: Date;
  note?: string;
  notificationTitle?: string;
  notificationPath?: string;
}

function getSavingsHistoryMonthKey(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

async function upsertSavingsHistory(memberId: string, month: string, amount: number) {
  try {
    return await SavingsHistory.findOneAndUpdate(
      { memberId, month },
      { $inc: { amount } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error: any) {
    if (error?.code !== 11000) {
      throw error;
    }

    await SavingsHistory.updateOne(
      { memberId, month },
      { $inc: { amount } }
    );

    return SavingsHistory.findOne({ memberId, month });
  }
}

export async function recordSavingsDeposit(params: RecordSavingsDepositParams) {
  const amount = Math.round(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Deposit amount must be a positive number');
  }

  const processedAt = params.processedAt ?? new Date();
  const member = await Member.findByIdAndUpdate(
    params.memberId,
    { $inc: { savings: amount } },
    { new: true }
  ).select('name memberId savings');

  if (!member) {
    throw new Error('Member not found');
  }

  const month = getSavingsHistoryMonthKey(processedAt);
  const savingsHistory = await upsertSavingsHistory(params.memberId, month, amount);

  const memberLabel = (member as any)?.name || (member as any)?.memberId || 'Member';
  const noteSuffix = params.note ? ` ${params.note}` : '';

  void notifyStaff(
    params.notificationTitle ?? 'Incoming Deposit Received',
    `${memberLabel} deposited KES ${amount.toLocaleString()} via ${params.sourceLabel}. Ref: ${params.reference}.${noteSuffix}`,
    'info',
    params.notificationPath ?? '/accounts'
  );

  return { member, savingsHistory };
}