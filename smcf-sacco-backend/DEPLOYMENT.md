# Deployment Guide for Render

This guide will help you deploy the SMCF SACCO backend to Render.

## Prerequisites

1. A GitHub account with your code pushed to a repository
2. A MongoDB Atlas account with a cluster created
3. A Render account (free tier available)

## Step 1: Prepare MongoDB Atlas

1. **Create a Cluster**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com/)
   - Create a new cluster (free M0 tier is fine for testing)
   - Choose a region close to your users

2. **Create Database User**
   - Go to Database Access
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and strong password
   - Grant "Read and write to any database" privilege
   - Save the credentials securely

3. **Configure Network Access**
   - Go to Network Access
   - Click "Add IP Address"
   - Choose "Allow Access from Anywhere" (0.0.0.0/0)
   - Or add specific Render IP addresses
   - Click "Confirm"

4. **Get Connection String**
   - Go to Database -> Connect
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<username>` and `<password>` with your credentials
   - Replace `<cluster>` with your cluster name
   - Change database name to `smcf-sacco`

Example:
```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/smcf-sacco?retryWrites=true&w=majority
```

## Step 2: Deploy to Render

### Option A: Using Render Dashboard (Recommended)

1. **Sign up / Log in to Render**
   - Go to [Render](https://render.com/)
   - Sign up or log in with GitHub

2. **Create New Web Service**
   - Click "New +" button
   - Select "Web Service"
   - Connect your GitHub repository
   - Grant Render access to the repository

3. **Configure Service**
   - **Name**: `smcf-sacco-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `smcf-sacco/backend` (if backend is in a subdirectory)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or choose a paid plan)

4. **Add Environment Variables**
   Click "Advanced" and add these environment variables:
   
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=<your-mongodb-connection-string>
   JWT_SECRET=<generate-a-strong-random-secret>
   JWT_EXPIRE=7d
   FRONTEND_URL=<your-frontend-url>
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

   **Important:**
   - Generate JWT_SECRET using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Use your actual MongoDB connection string for MONGODB_URI
   - Set FRONTEND_URL to your frontend domain (or leave as localhost for testing)

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your app
   - Wait for deployment to complete (5-10 minutes first time)

### Option B: Using render.yaml (Automated)

If you have `render.yaml` in your repository:

1. Go to Render Dashboard
2. Click "New +" → "Blueprint"
3. Connect your repository
4. Render will detect `render.yaml` and auto-configure
5. Add environment variables manually (they can't be auto-configured for security)

## Step 3: Verify Deployment

1. **Check Deployment Logs**
   - Go to your service in Render dashboard
   - Click "Logs" tab
   - Look for "MongoDB Connected" and "Server running" messages

2. **Test Health Endpoint**
   - Get your Render URL (e.g., `https://smcf-sacco-backend.onrender.com`)
   - Visit: `https://your-url.onrender.com/health`
   - Should return: `{"status": "success", "message": "Server is running", ...}`

3. **Test API Endpoint**
   ```bash
   curl https://your-url.onrender.com/health
   ```

## Step 4: Seed Initial Data (Optional)

If you want to add initial admin users and test data:

1. **Connect to your MongoDB**
   - Use MongoDB Compass or shell
   - Connect with your MongoDB URI

2. **Run Seed Script Locally**
   ```bash
   # In backend directory
   npm run seed
   ```

   This creates:
   - Admin user: `admin@smcfsacco.com` / `admin123`
   - Credit Officer: `officer@smcfsacco.com` / `officer123`
   - Treasurer: `treasurer@smcfsacco.com` / `treasurer123`
   - Sample members

## Step 5: Update Frontend

Update your frontend to use the new backend URL:

1. Create `.env` file in frontend:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```

2. Update API calls to use `import.meta.env.VITE_API_URL`

## Troubleshooting

### Issue: "Cannot connect to MongoDB"
- **Solution**: Check MongoDB Atlas Network Access settings
- Ensure 0.0.0.0/0 is whitelisted or add Render's IP ranges

### Issue: "Build failed"
- **Solution**: Check Render logs for specific error
- Verify all dependencies in package.json
- Ensure TypeScript compiles locally

### Issue: "502 Bad Gateway"
- **Solution**: Check if app is listening on correct PORT
- Render sets PORT env variable automatically
- Ensure `process.env.PORT` is used in server.ts

### Issue: "CORS errors from frontend"
- **Solution**: Verify FRONTEND_URL environment variable
- Should match your frontend domain exactly
- Check CORS configuration in server.ts

## Free Tier Limitations

Render free tier includes:
- 750 hours/month
- App spins down after 15 minutes of inactivity
- Cold starts take 30-60 seconds
- 512 MB RAM

For production, consider upgrading to a paid plan.

## Monitoring

1. **Render Dashboard**
   - Monitor CPU, Memory usage
   - View logs in real-time
   - Check deployment history

2. **MongoDB Atlas**
   - Monitor database performance
   - Check query performance
   - View connection statistics

## Security Best Practices

1. ✅ Use strong JWT secrets (32+ characters)
2. ✅ Enable MongoDB Atlas encryption
3. ✅ Whitelist only necessary IP addresses
4. ✅ Use HTTPS (Render provides this automatically)
5. ✅ Regularly update dependencies
6. ✅ Monitor audit logs
7. ✅ Set appropriate rate limits

## Support

For issues:
- Check Render Status: https://status.render.com/
- Render Docs: https://render.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/

---

**Your backend is now deployed! 🎉**

Backend URL: `https://your-service-name.onrender.com`
