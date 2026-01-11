# Render Deployment Guide for SMCF Backend

## Quick Setup

### 1. Prerequisites
- GitHub repository with the SMCF code
- Render account (free tier works)
- MongoDB Atlas account with connection string

### 2. Deploy to Render

#### Option A: Using render.yaml (Recommended)
1. Push your code to GitHub (the `render.yaml` is already configured)
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" → "Blueprint"
4. Connect your GitHub repository
5. Render will auto-detect `render.yaml` and create the service
6. Set the required environment variables (see below)

#### Option B: Manual Setup
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `smcf-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### 3. Environment Variables

Set these in Render Dashboard → Environment:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smcf?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
CLIENT_URL=https://smcf.app
ADMIN_PHONE=254759097157
LIPIA_API_KEY=your-lipia-api-key
LIPIA_APP_ID=your-lipia-app-id
LIPIA_APP_NAME=smcf
LIPIA_APP_TYPE=TILL
LIPIA_API_URL=https://lipia-api.kreativelabske.com/api/v2
```

### 4. Important Notes

- ✅ Health check endpoint: `/health`
- ✅ Render automatically assigns the PORT (don't hardcode it)
- ✅ Free tier services sleep after 15 minutes of inactivity (first request may be slow)
- ✅ Build takes ~2-3 minutes on first deployment

## Common Deployment Issues & Fixes

### Issue 1: Build Fails with "Cannot find module"
**Solution**: 
- Ensure `package-lock.json` is committed to Git
- Use `npm ci` instead of `npm install` in build command
- Check that all dependencies are in `dependencies` (not `devDependencies`)

### Issue 2: Service Crashes on Startup
**Solution**:
- Check Render logs for errors
- Verify all environment variables are set correctly
- Ensure MONGODB_URI is accessible from Render's IP
- MongoDB Atlas: Add `0.0.0.0/0` to Network Access whitelist

### Issue 3: Health Check Failing
**Solution**:
- Health check path is `/health` (not `/api/health`)
- Server must bind to `0.0.0.0`, not `localhost`
- Check that PORT environment variable is being used correctly

### Issue 4: CORS Errors
**Solution**:
- Add your frontend domain to `CLIENT_URL` environment variable
- Frontend must be deployed to a domain (not localhost in production)
- Check `allowedOrigins` in `server.js`

### Issue 5: Socket.IO Not Connecting
**Solution**:
- Ensure WebSocket connections are enabled (they are by default on Render)
- Add frontend domain to CORS allowed origins
- Check that Socket.IO client URL matches backend URL

### Issue 6: Database Connection Timeout
**Solution**:
- MongoDB Atlas: Whitelist `0.0.0.0/0` in Network Access
- Check MONGODB_URI is correct and includes proper authentication
- Verify MongoDB cluster is not paused

## Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] `render.yaml` present in repository root
- [ ] All environment variables configured in Render dashboard
- [ ] MongoDB Atlas network access allows Render connections
- [ ] Health check endpoint `/health` responding
- [ ] Service logs show "MongoDB Connected"
- [ ] Frontend VITE_API_URL points to Render backend URL
- [ ] Test login and API endpoints

## Monitoring

### View Logs
```bash
# In Render Dashboard:
Services → smcf-backend → Logs
```

### Test Health Check
```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T...",
  "environment": "production"
}
```

### Test API
```bash
curl https://your-service.onrender.com/
```

## Production URL
After deployment, your backend will be available at:
```
https://smcf-c99o.onrender.com
```

Update your frontend `VITE_API_URL` to this URL.

## Support

If deployment still fails:
1. Check Render logs for specific error messages
2. Verify all environment variables are set
3. Ensure MongoDB Atlas allows connections from anywhere
4. Test health endpoint manually
5. Check that package.json has correct Node version

## Automatic Deployments

Render automatically deploys when you push to the `main` branch. To disable:
- Go to Settings → Build & Deploy → Auto-Deploy: Off

## Free Tier Limitations

- Services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds
- 750 hours/month free (plenty for one service)
- Consider upgrading to Starter ($7/month) for always-on service
