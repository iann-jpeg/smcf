import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from './auth';

export const auditLog = (tableName: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AuditLog.create({
          userId: req.userId || null,
          tableName,
          recordId: data?.data?.id || data?.data?._id || null,
          action,
          changes: req.body,
          ipAddress: req.ip || req.connection.remoteAddress
        }).catch(err => console.error('Audit log error:', err));
      }

      return originalJson(data);
    };

    next();
  };
};
