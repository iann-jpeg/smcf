import UserSession from '../models/UserSession.js';
import ActivityLog from '../models/ActivityLog.js';
import LoginAttempt from '../models/LoginAttempt.js';

/**
 * Middleware to track user activity automatically
 */

// Extract device info from user agent
const getDeviceInfo = (userAgent) => {
  if (!userAgent) return { deviceType: 'unknown', browser: 'unknown' };
  
  let deviceType = 'desktop';
  let browser = 'unknown';
  
  // Detect device type
  if (/mobile/i.test(userAgent)) deviceType = 'mobile';
  else if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';
  
  // Detect browser
  if (/chrome/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent)) browser = 'Safari';
  else if (/edge/i.test(userAgent)) browser = 'Edge';
  else if (/opera/i.test(userAgent)) browser = 'Opera';
  
  return { deviceType, browser };
};

// Get client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * Track login attempt
 */
const trackLoginAttempt = async (identifier, success, userId = null, userModel = null, req, failureReason = null) => {
  try {
    const { deviceType, browser } = getDeviceInfo(req.headers['user-agent']);
    const ipAddress = getClientIP(req);
    
    await LoginAttempt.create({
      identifier,
      success,
      userId,
      userModel,
      ipAddress,
      deviceType,
      browser,
      userAgent: req.headers['user-agent'],
      failureReason
    });
  } catch (error) {
    console.error('Error tracking login attempt:', error);
  }
};

/**
 * Create user session on login
 */
const createUserSession = async (userId, userModel, role, req) => {
  try {
    const { deviceType, browser } = getDeviceInfo(req.headers['user-agent']);
    const ipAddress = getClientIP(req);
    
    const session = await UserSession.create({
      userId,
      userModel,
      role,
      loginTime: new Date(),
      ipAddress,
      deviceType,
      browser,
      userAgent: req.headers['user-agent'],
      sessionToken: req.sessionID || null,
      isActive: true
    });
    
    // Also log the login activity
    await logActivity({
      userId,
      userModel,
      activityType: 'login',
      description: `User logged in from ${deviceType}`,
      sessionId: session._id,
      ipAddress
    });
    
    return session;
  } catch (error) {
    console.error('Error creating user session:', error);
    return null;
  }
};

/**
 * End user session on logout
 */
const endUserSession = async (userId, sessionId = null) => {
  try {
    let session;
    
    if (sessionId) {
      session = await UserSession.findById(sessionId);
    } else {
      // Find the most recent active session for this user
      session = await UserSession.findOne({ userId, isActive: true }).sort({ loginTime: -1 });
    }
    
    if (session) {
      await session.endSession();
      
      // Log the logout activity
      await logActivity({
        userId: session.userId,
        userModel: session.userModel,
        activityType: 'logout',
        description: `User logged out (session duration: ${Math.floor(session.sessionDuration / 60)} minutes)`,
        sessionId: session._id
      });
    }
  } catch (error) {
    console.error('Error ending user session:', error);
  }
};

/**
 * Log user activity
 */
const logActivity = async ({
  userId,
  userModel,
  actorId = null,
  actorModel = null,
  activityType,
  description,
  metadata = {},
  amount = null,
  status = 'success',
  ipAddress = null,
  sessionId = null
}) => {
  try {
    await ActivityLog.create({
      userId,
      userModel,
      actorId,
      actorModel,
      activityType,
      description,
      metadata,
      amount,
      status,
      ipAddress,
      sessionId
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Middleware to automatically log activities based on route
 */
const activityLogger = (activityType, getDescription) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to capture response
    res.json = function(data) {
      // Only log if request was successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?._id || req.user?.id;
        const userModel = req.user?.role === 'admin' || req.user?.role === 'super_admin' ? 'Admin' : 'Member';
        
        if (userId) {
          const description = typeof getDescription === 'function' 
            ? getDescription(req, data) 
            : getDescription;
          
          const ipAddress = getClientIP(req);
          
          logActivity({
            userId,
            userModel,
            activityType,
            description,
            metadata: {
              method: req.method,
              path: req.path,
              params: req.params,
              query: req.query
            },
            ipAddress,
            sessionId: req.sessionId || null
          }).catch(err => console.error('Activity logging error:', err));
        }
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

export {
  trackLoginAttempt,
  createUserSession,
  endUserSession,
  logActivity,
  activityLogger,
  getClientIP,
  getDeviceInfo
};
