/**
 * Notification helpers — fire-and-forget; never throw so they never break the main request.
 */
import Notification from '../models/Notification';
import User from '../models/User';
import Member from '../models/Member';
import mongoose from 'mongoose';

const DUPLICATE_LOOKBACK_HOURS = 24;

async function hasRecentDuplicate(
  userId: string | mongoose.Types.ObjectId,
  title: string,
  message: string,
  type: 'info' | 'approval' | 'rejection',
  link: string | null
) {
  const since = new Date(Date.now() - DUPLICATE_LOOKBACK_HOURS * 60 * 60 * 1000);
  const existing = await Notification.findOne({
    userId,
    title,
    message,
    type,
    link,
    createdAt: { $gte: since },
  }).select('_id');
  return !!existing;
}

/** Notify a specific user by their userId */
export async function notifyUser(
  userId: string | mongoose.Types.ObjectId,
  title: string,
  message: string,
  type: 'info' | 'approval' | 'rejection' = 'info',
  link: string | null = null
) {
  try {
    if (await hasRecentDuplicate(userId, title, message, type, link)) {
      return;
    }
    await Notification.create({ userId, title, message, type, link });
  } catch (err) {
    console.error('[notify] notifyUser error:', err);
  }
}

/** Notify the member who owns the given memberId (MongoDB ObjectId) via their linked userId */
export async function notifyMember(
  memberId: string | mongoose.Types.ObjectId,
  title: string,
  message: string,
  type: 'info' | 'approval' | 'rejection' = 'info',
  link: string | null = null
) {
  try {
    const member = await Member.findById(memberId).select('userId');
    if (member?.userId) {
      if (await hasRecentDuplicate(member.userId as any, title, message, type, link)) {
        return;
      }
      await Notification.create({ userId: member.userId, title, message, type, link });
    }
  } catch (err) {
    console.error('[notify] notifyMember error:', err);
  }
}

/** Notify all staff users (admin, credit_officer, credit_committee, treasurer) */
export async function notifyStaff(
  title: string,
  message: string,
  type: 'info' | 'approval' | 'rejection' = 'info',
  link: string | null = null
) {
  try {
    const staffUsers = await User.find({
      roles: { $in: ['admin', 'credit_officer', 'credit_committee', 'treasurer'] },
    }).select('_id');

    if (staffUsers.length === 0) return;

    const since = new Date(Date.now() - DUPLICATE_LOOKBACK_HOURS * 60 * 60 * 1000);
    const existing = await Notification.find({
      userId: { $in: staffUsers.map((u) => u._id) },
      title,
      message,
      type,
      link,
      createdAt: { $gte: since },
    }).select('userId');

    const existingUserIds = new Set(existing.map((n: any) => String(n.userId)));
    const toInsert = staffUsers
      .filter((u) => !existingUserIds.has(String(u._id)))
      .map((u) => ({ userId: u._id, title, message, type, link }));

    if (toInsert.length > 0) {
      await Notification.insertMany(toInsert);
    }
  } catch (err) {
    console.error('[notify] notifyStaff error:', err);
  }
}
