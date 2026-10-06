import { Request } from 'express';
import mongoose from 'mongoose';
import UserActivity, { UserActivityEvent } from '../models/UserActivity';

export function recordUserActivity(
  req: Request,
  input: {
    userId?: string | mongoose.Types.ObjectId | null;
    sessionId?: string | null;
    event: UserActivityEvent;
    action: string;
    path?: string | null;
    searchCategories?: string[];
    resultCount?: number | null;
    metadata?: Record<string, unknown> | null;
  },
): void {
  UserActivity.create({
    ...input,
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
  }).catch((error) => console.error('User activity record error:', error));
}
