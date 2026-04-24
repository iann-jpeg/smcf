import SearchLog from '../models/SearchLog.js';
import { getClientIP, getDeviceInfo } from './activityTracker.js';

/**
 * Middleware to track search activity
 */
const searchTracker = (category = 'general') => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to capture response
    res.json = function(data) {
      // Only log if request was successful and has search data
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?._id || req.user?.id;
        const userModel = req.user?.role === 'admin' || req.user?.role === 'super_admin' ? 'Admin' : 'Member';
        const userRole = req.user?.role || 'member';
        
        // Extract search term from query or body
        const searchTerm = req.query.search || req.query.q || req.query.term || 
                          req.body.search || req.body.searchTerm || '';
        
        if (userId && searchTerm) {
          const { deviceType } = getDeviceInfo(req.headers['user-agent']);
          const ipAddress = getClientIP(req);
          const resultsCount = Array.isArray(data) ? data.length : 
                              (data?.results?.length || data?.data?.length || 0);
          
          // Detect suspicious patterns (e.g., too many searches in short time)
          const suspicious = detectSuspiciousSearch(userId, searchTerm);
          
          SearchLog.create({
            searchTerm,
            searchCategory: category,
            userId,
            userModel,
            userRole,
            resultsCount,
            ipAddress,
            deviceType,
            sessionId: req.sessionId || null,
            suspicious
          }).catch(err => console.error('Search logging error:', err));
        }
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

// Track recent searches to detect suspicious patterns
const recentSearches = new Map();

const detectSuspiciousSearch = (userId, searchTerm) => {
  const now = Date.now();
  const userKey = userId.toString();
  
  if (!recentSearches.has(userKey)) {
    recentSearches.set(userKey, []);
  }
  
  const userSearches = recentSearches.get(userKey);
  
  // Remove searches older than 1 minute
  const oneMinuteAgo = now - 60000;
  const recentUserSearches = userSearches.filter(s => s.time > oneMinuteAgo);
  
  // Add current search
  recentUserSearches.push({ term: searchTerm, time: now });
  recentSearches.set(userKey, recentUserSearches);
  
  // Flag as suspicious if more than 20 searches in 1 minute
  return recentUserSearches.length > 20;
};

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 300000;
  for (const [userId, searches] of recentSearches.entries()) {
    const recent = searches.filter(s => s.time > fiveMinutesAgo);
    if (recent.length === 0) {
      recentSearches.delete(userId);
    } else {
      recentSearches.set(userId, recent);
    }
  }
}, 300000);

export { searchTracker };
