# Vercel Deployment Guide

## Overview

This document outlines the Vercel deployment configuration for the SMCF (Savings and Micro Credit Foundation) application.

## Configuration Files

### vercel.json

Created to ensure Vercel properly detects and builds the Vite + React project:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Key Points:**

- Framework explicitly set to `vite` for proper detection
- Build output directory is `dist` (standard Vite output)
- Rewrites configured for SPA routing (all routes serve index.html)

## Environment Variables

### Required on Vercel:

Set the following environment variable in Vercel dashboard:

- **VITE_API_URL**: `https://smcf-c99o.onrender.com`
  - This connects the frontend to the production backend on Render

### Setting Environment Variables:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `VITE_API_URL` with value `https://smcf-c99o.onrender.com`
3. Select all environments (Production, Preview, Development)
4. Save and redeploy

## Mobile Responsiveness

All components have been updated with mobile-first responsive design:

### Component Updates:

✅ **Dashboard.tsx** - Responsive header, grid layouts  
✅ **AdminDashboard.tsx** - Scrollable tabs, responsive text sizes  
✅ **MemberDashboard.tsx** - 4-tab layout with horizontal scroll on mobile  
✅ **PaymentDialog.tsx** - Responsive padding, max-height with scroll  
✅ **LoanRequestDialog.tsx** - Mobile-optimized form layout  
✅ **AnnouncementDialog.tsx** - Responsive dialog sizing  
✅ **MpesaDisbursementDialog.tsx** - Mobile-friendly payment flow  
✅ **Index.tsx** (Landing) - Responsive hero, features, stats  
✅ **Admin Components** (LoansTab, ProfileSettings, etc.) - Mobile grids and text

### Responsive Patterns Used:

- **Text**: `text-xs sm:text-sm md:text-base lg:text-lg`
- **Layout**: `flex-col sm:flex-row`
- **Grids**: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- **Spacing**: `gap-2 sm:gap-3 md:gap-4`, `space-y-4 md:space-y-6`
- **Padding**: `p-2 sm:p-4 md:p-6`, `px-3 sm:px-4`
- **Width**: `w-full sm:w-auto`
- **Tabs**: `overflow-x-auto` for horizontal scrolling on mobile

## Deployment Checklist

### Pre-Deployment:

- [x] Create vercel.json configuration
- [x] Ensure all components are mobile responsive
- [x] Test backend connectivity (CORS configured for smcf.app)
- [x] Verify environment variables set

### Post-Deployment Verification:

1. **Check Build Logs**:

   - Verify Vite framework detected
   - Confirm `npm run build` executes successfully
   - Check dist directory created

2. **Test Functionality**:

   - [ ] Login as admin (phone + password)
   - [ ] Login as member (phone only)
   - [ ] Test payment via M-Pesa STK Push
   - [ ] Submit loan request from member dashboard
   - [ ] Approve/reject loan from admin dashboard
   - [ ] Verify real-time updates via Socket.IO
   - [ ] Test admin disbursement with STK authorization

3. **Mobile Testing**:

   - [ ] Test on iOS Safari
   - [ ] Test on Android Chrome
   - [ ] Verify all tabs scroll horizontally on mobile
   - [ ] Check dialogs don't overflow screen
   - [ ] Test payment flow on mobile device
   - [ ] Verify loan status display on mobile

4. **Performance Check**:
   - [ ] Page load speed
   - [ ] Socket.IO connection stability
   - [ ] API response times

## Architecture

### Frontend (Vercel):

- **URL**: smcf.app
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **UI Library**: shadcn/ui + Tailwind CSS
- **Real-time**: Socket.IO Client
- **State Management**: React Hooks

### Backend (Render):

- **URL**: https://smcf-c99o.onrender.com
- **Runtime**: Node.js + Express
- **Database**: MongoDB Atlas
- **Real-time**: Socket.IO Server
- **Payment Gateway**: Lipia Online

### CORS Configuration:

Backend is configured to accept requests from:

- https://smcf.app
- https://www.smcf.app
- http://localhost:5173 (development)
- http://localhost:8080 (development)
- http://localhost:3000 (development)

## Features Deployed

### ✅ Payment Integration:

- M-Pesa STK Push for member contributions
- Real-time payment status updates
- Payment history tracking

### ✅ Loan Management:

- Loan request submission (with purpose field)
- Admin approval/rejection workflow
- Rejection reasons shown to members
- Loan status display in member dashboard
- Color-coded loan cards by status
- Real-time loan status notifications

### ✅ Admin Features:

- Member management
- Disbursement via STK Push
- Loan approvals with rejection reasons
- Profile settings with password change
- Announcements to all members
- Reports and analytics

### ✅ Member Features:

- Dashboard with 4 tabs (Overview, Loans, History, Payouts)
- Payment via M-Pesa
- Loan request submission
- Loan status tracking with rejection reasons
- Real-time notifications

### ✅ Real-time Updates (Socket.IO):

- Payment completed notifications
- Loan status changes (approved/rejected/disbursed)
- Member data updates
- Cycle status updates
- Next recipient updates

## Troubleshooting

### Issue: Vercel not detecting changes

**Solution**: Ensure vercel.json is in the root directory and pushed to GitHub

### Issue: Build fails

**Solution**:

- Check build logs in Vercel dashboard
- Verify package.json scripts
- Ensure all dependencies are in package.json

### Issue: API calls failing

**Solution**:

- Verify VITE_API_URL environment variable is set
- Check backend CORS configuration includes smcf.app
- Test backend health: https://smcf-c99o.onrender.com/api/health

### Issue: Socket.IO not connecting

**Solution**:

- Check backend is running and Socket.IO server is active
- Verify CORS allows Socket.IO handshake
- Check browser console for connection errors

### Issue: Mobile layout issues

**Solution**:

- Test on actual devices (not just browser resize)
- Check responsive classes are applied
- Use browser DevTools mobile emulation

## Support

For issues or questions:

1. Check Vercel build logs
2. Review backend logs on Render
3. Test API endpoints directly
4. Check browser console for errors

## Recent Updates

### Latest Changes (Current Deployment):

- ✅ Added vercel.json for proper framework detection
- ✅ Made AnnouncementDialog mobile responsive
- ✅ Made MpesaDisbursementDialog mobile responsive
- ✅ Added loan status display with rejection reasons in member dashboard
- ✅ Enhanced Socket.IO to send rejection reasons
- ✅ Comprehensive mobile responsive design across all components

### Commit: `9a0ef6d`

- Vercel configuration
- Final mobile responsive fixes

### Previous Commit: `833a332`

- Loan status display feature
- Rejection reason notifications
