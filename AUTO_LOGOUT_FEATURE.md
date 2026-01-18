# Auto-Logout Feature Documentation

## Overview
The SMCF platform now includes an automatic logout feature that enhances security by logging out inactive users after a specified period of inactivity.

## Features

### ✨ **Key Capabilities**
1. **Automatic Session Timeout** - Users are logged out after 15 minutes of inactivity (configurable)
2. **Warning Notification** - Users receive a warning 1 minute before logout
3. **Activity Tracking** - Monitors mouse movements, keyboard input, scrolling, and touch events
4. **User Interaction** - Warning notification includes "Stay Logged In" button
5. **Role-Based Timeouts** - Different timeouts can be configured for admins vs members
6. **Easy Configuration** - Centralized configuration file for all settings

## How It Works

### Activity Detection
The system monitors the following user activities:
- Mouse clicks and movements
- Keyboard input
- Scrolling
- Touch events (for mobile devices)

Any of these activities will reset the inactivity timer.

### Warning System
- **14 minutes**: User continues normal activity
- **14 minutes elapsed**: Warning notification appears
- **User options**:
  - Click "Stay Logged In" button → Timer resets, user stays logged in
  - Interact with the page (click, type, scroll) → Timer resets automatically
  - Do nothing → Logged out after 1 more minute

### Logout Process
When the timeout expires:
1. User session is cleared from localStorage
2. User is redirected to the login screen
3. A notification appears: "Session Expired - You have been logged out due to inactivity"

## Configuration

All settings are in [`src/config/session.ts`](d:/smart%20money%20cash%20flow/smcf/src/config/session.ts):

```typescript
export const sessionConfig = {
  // Main timeout (15 minutes default)
  inactivityTimeout: 15 * 60 * 1000,
  
  // Warning time (1 minute default)
  warningBeforeLogout: 60 * 1000,
  
  // Events to track
  activityEvents: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'],
  
  // Enable/disable feature
  enabled: true,
  
  // Role-based timeouts
  differentTimeoutForRoles: false,
  adminInactivityTimeout: 30 * 60 * 1000,  // 30 min for admins
  memberInactivityTimeout: 15 * 60 * 1000, // 15 min for members
};
```

### Customization Examples

**Change timeout to 10 minutes:**
```typescript
inactivityTimeout: 10 * 60 * 1000,
```

**Different timeouts for admins and members:**
```typescript
differentTimeoutForRoles: true,
adminInactivityTimeout: 30 * 60 * 1000,  // 30 minutes
memberInactivityTimeout: 10 * 60 * 1000, // 10 minutes
```

**Change warning time to 2 minutes:**
```typescript
warningBeforeLogout: 2 * 60 * 1000,
```

**Disable auto-logout:**
```typescript
enabled: false,
```

## Implementation Details

### Files Created

1. **[`src/hooks/useInactivityLogout.ts`](d:/smart%20money%20cash%20flow/smcf/src/hooks/useInactivityLogout.ts)**
   - Basic inactivity logout hook without warnings

2. **[`src/hooks/useInactivityLogoutWithWarning.ts`](d:/smart%20money%20cash%20flow/smcf/src/hooks/useInactivityLogoutWithWarning.ts)**
   - Enhanced version with visual warning notifications
   - Uses Sonner toast library for notifications

3. **[`src/config/session.ts`](d:/smart%20money%20cash%20flow/smcf/src/config/session.ts)**
   - Centralized configuration for all session settings
   - Helper functions for role-based timeouts

### Integration Points

The feature is integrated in:
- **[`src/pages/Index.tsx`](d:/smart%20money%20cash%20flow/smcf/src/pages/Index.tsx)** - Main landing/login page
- **[`src/pages/Admin.tsx`](d:/smart%20money%20cash%20flow/smcf/src/pages/Admin.tsx)** - Admin dashboard page

## Security Benefits

1. **Prevents Unauthorized Access** - Automatically logs out users who leave their devices unattended
2. **Compliance** - Meets security requirements for financial applications
3. **Session Management** - Reduces server load from stale sessions
4. **User Awareness** - Warning system keeps users informed
5. **Flexible Configuration** - Adjustable to match security policies

## User Experience

### Desktop Users
- Subtle monitoring of mouse and keyboard activity
- Clear warning notification before logout
- Easy to extend session with any interaction

### Mobile Users
- Touch events are tracked
- Scrolling resets the timer
- Warning appears as mobile-friendly toast notification

### Admin Users
- Can configure longer timeout periods if needed
- Same security benefits as regular users
- Activity logs still maintained

## Testing the Feature

To test the auto-logout functionality:

1. **Quick Test** (temporary change):
   ```typescript
   // In src/config/session.ts
   inactivityTimeout: 2 * 60 * 1000,     // 2 minutes
   warningBeforeLogout: 30 * 1000,       // 30 seconds warning
   ```

2. **Test Steps**:
   - Login to the system
   - Don't interact for 1.5 minutes
   - Warning should appear at 1 minute 30 seconds
   - If no action taken, logout occurs at 2 minutes

3. **Verify**:
   - Check browser console for logout messages
   - Verify session cleared from localStorage
   - Confirm redirect to login screen

## Browser Compatibility

Works on all modern browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- **Minimal overhead**: Event listeners are passive
- **Efficient timers**: Only two timers running (warning + logout)
- **Smart cleanup**: Timers cleared when component unmounts
- **No polling**: Event-driven architecture

## Future Enhancements

Potential additions:
- [ ] Admin dashboard to view user session activity
- [ ] Customizable timeout per user
- [ ] Session activity analytics
- [ ] Multi-tab session sync
- [ ] Countdown timer in warning notification
- [ ] Remember device option (extend timeout)

## Troubleshooting

**Issue**: Auto-logout not working
- Check if `sessionConfig.enabled` is `true`
- Verify user is logged in (`userRole !== null`)
- Check browser console for errors

**Issue**: Users getting logged out too quickly
- Increase `inactivityTimeout` in config
- Check that activity events are being tracked

**Issue**: Warning not appearing
- Verify Sonner toast is installed: `npm list sonner`
- Check that `warningBeforeLogout` < `inactivityTimeout`
- Ensure Toaster component is rendered in App.tsx

## Support

For issues or questions:
- Email: administrator@smcf.app
- Check configuration in `src/config/session.ts`
- Review browser console logs
