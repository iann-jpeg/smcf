import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Member from '../models/Member';

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
export function jwtSecret(): string {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

export const isStaff = (req: AuthRequest): boolean =>
  Boolean(req.user?.roles?.some((role) => ['admin', 'credit_officer', 'credit_committee', 'treasurer', 'auditor'].includes(role)));

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, jwtSecret(), { algorithms: [JWT_ALGORITHM] }) as { id: string };
      
      // Get user from token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      req.user = user;
      req.userId = user._id.toString();
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if user has any of the required roles
    const hasRole = req.user.roles.some(role => roles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `User role is not authorized to access this route. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/** Reject member requests for another member while allowing staff to act on behalf of members. */
export const requireMemberOwnership = (param = 'memberId') =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (isStaff(req)) return next();
    const requested = String(req.params[param] || req.body?.[param] || req.query?.[param] || '').trim();
    if (!requested) return res.status(400).json({ success: false, message: `${param} is required` });
    const member = await Member.findOne({ userId: req.userId }).select('_id');
    if (!member || String(member._id) !== requested) {
      return res.status(403).json({ success: false, message: 'You may only access your own member account' });
    }
    next();
  };
