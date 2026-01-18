/**
 * SMCF Security & Session Configuration
 * Configure auto-logout and session management settings
 */

export const sessionConfig = {
  /**
   * Auto-logout timeout in milliseconds
   * Default: 15 minutes (900000 ms)
   * 
   * Common values:
   * - 5 minutes: 5 * 60 * 1000
   * - 10 minutes: 10 * 60 * 1000
   * - 15 minutes: 15 * 60 * 1000 (recommended)
   * - 30 minutes: 30 * 60 * 1000
   * - 1 hour: 60 * 60 * 1000
   */
  inactivityTimeout: 15 * 60 * 1000,

  /**
   * Warning time before logout in milliseconds
   * Default: 1 minute (60000 ms)
   * 
   * This notification will appear before the user is logged out
   */
  warningBeforeLogout: 60 * 1000,

  /**
   * Events to track for user activity
   * These events will reset the inactivity timer
   */
  activityEvents: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'],

  /**
   * Enable auto-logout feature
   * Set to false to disable auto-logout entirely
   */
  enabled: true,

  /**
   * Different timeout for admins vs members
   * If true, uses the values below; if false, uses same timeout for all
   */
  differentTimeoutForRoles: false,

  /**
   * Admin-specific timeout (only used if differentTimeoutForRoles is true)
   */
  adminInactivityTimeout: 30 * 60 * 1000, // 30 minutes for admins

  /**
   * Member-specific timeout (only used if differentTimeoutForRoles is true)
   */
  memberInactivityTimeout: 15 * 60 * 1000, // 15 minutes for members
};

/**
 * Get timeout for specific user role
 */
export const getTimeoutForRole = (role: 'admin' | 'member' | null): number => {
  if (!role || !sessionConfig.differentTimeoutForRoles) {
    return sessionConfig.inactivityTimeout;
  }
  
  return role === 'admin' 
    ? sessionConfig.adminInactivityTimeout 
    : sessionConfig.memberInactivityTimeout;
};
