# ✅ Render Deployment Readiness Checklist

## Pre-Deployment Checklist

### Local Files ✅
- [x] `render.yaml` created
- [x] `.node-version` created (20.11.0)
- [x] `.nvmrc` created (20.11.0)
- [x] `Procfile` created
- [x] Health check endpoint added to backend
- [x] MongoDB connection improved
- [x] Graceful shutdown handling added
- [x] Startup logging enhanced
- [x] Node engine specified in package.json

### Git Repository 
- [ ] All changes committed
- [ ] Changes pushed to GitHub main branch
- [ ] Repository connected to Render

### Render Dashboard Configuration
- [ ] Render account created
- [ ] New Web Service created (or using Blueprint)
- [ ] GitHub repository connected
- [ ] Following environment variables set:

#### Required Environment Variables
- [ ] `MONGODB_URI` - Your MongoDB Atlas connection string
- [ ] `JWT_SECRET` - A secure random string (min 32 characters)
- [ ] `CLIENT_URL` - Your frontend URL (e.g., https://smcf.app)
- [ ] `ADMIN_PHONE` - Admin phone number
- [ ] `LIPIA_API_KEY` - Lipia payment API key
- [ ] `LIPIA_APP_ID` - Lipia application ID

#### Auto-Set Variables (verify they're correct)
- [ ] `NODE_ENV` = production
- [ ] `PORT` = 4000 (or let Render set it automatically)
- [ ] `JWT_EXPIRES_IN` = 7d
- [ ] `LIPIA_APP_NAME` = smcf
- [ ] `LIPIA_APP_TYPE` = TILL
- [ ] `LIPIA_API_URL` = https://lipia-api.kreativelabske.com/api/v2

### MongoDB Atlas Configuration
- [ ] MongoDB cluster is running (not paused)
- [ ] Database user created with correct permissions
- [ ] Network Access allows connections from anywhere (0.0.0.0/0)
- [ ] Connection string is correct and tested

### Service Configuration (Render Dashboard)
- [ ] Root Directory: `backend`
- [ ] Build Command: `npm ci`
- [ ] Start Command: `npm start`
- [ ] Health Check Path: `/health`
- [ ] Environment: Node
- [ ] Region: Oregon (or your preferred region)

## Deployment Steps

1. **Commit Changes**
   ```bash
   # Using PowerShell
   .\deploy-to-render.ps1
   
   # Or manually
   git add .
   git commit -m "Fix Render deployment configuration"
   git push origin main
   ```

2. **Configure Render**
   - Go to https://dashboard.render.com/
   - Create new Web Service or use Blueprint
   - Connect your GitHub repository
   - Set all environment variables

3. **Monitor Deployment**
   - Watch build logs in Render dashboard
   - Wait for "Your service is live" message
   - Check for any error messages

4. **Verify Deployment**
   ```bash
   # Test health endpoint
   curl https://your-service.onrender.com/health
   
   # Expected response:
   # {"status":"ok","timestamp":"2026-01-11T...","environment":"production"}
   ```

5. **Test API Endpoints**
   ```bash
   # Test root endpoint
   curl https://your-service.onrender.com/
   
   # Test auth endpoint
   curl https://your-service.onrender.com/api/auth/health
   ```

## Post-Deployment

### Update Frontend
- [ ] Update `VITE_API_URL` to point to your Render backend URL
- [ ] Redeploy frontend with new API URL
- [ ] Test frontend-backend connection

### Monitor
- [ ] Check Render dashboard logs regularly
- [ ] Monitor for errors or crashes
- [ ] Verify auto-deploy works when pushing to main

### Performance
- [ ] Test API response times
- [ ] Verify Socket.IO connections work
- [ ] Check database query performance
- [ ] Monitor free tier limitations (750 hours/month)

## Troubleshooting

If deployment fails, check:

1. **Build Errors**
   - Check Render build logs
   - Verify package-lock.json is committed
   - Ensure all dependencies are in package.json

2. **Runtime Errors**
   - Check Render runtime logs
   - Verify all environment variables are set
   - Check MongoDB connection

3. **Health Check Fails**
   - Verify `/health` endpoint exists
   - Check server is binding to all interfaces
   - Ensure PORT environment variable is used

4. **Database Connection**
   - Verify MONGODB_URI is correct
   - Check MongoDB Atlas network access
   - Ensure database user has correct permissions

## Common Issues Fixed

✅ Missing render.yaml configuration
✅ Incorrect build commands
✅ No health check endpoint
✅ Missing Node version specification
✅ Poor error handling for MongoDB connection
✅ No graceful shutdown handling
✅ Insufficient logging for debugging

## Resources

- [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) - Detailed deployment guide
- [RENDER_FIX_SUMMARY.md](./RENDER_FIX_SUMMARY.md) - Summary of changes made
- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Network Access](https://www.mongodb.com/docs/atlas/security/ip-access-list/)

## Support

If you still have issues after following this checklist:
1. Check Render logs for specific error messages
2. Review RENDER_DEPLOYMENT.md troubleshooting section
3. Verify all environment variables are set correctly
4. Test MongoDB connection separately
5. Check Render status page for service disruptions

---

**Ready to deploy?** Run `.\deploy-to-render.ps1` to commit and push your changes!
