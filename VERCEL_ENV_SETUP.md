# Vercel Environment Setup Guide

## Step-by-Step Instructions

### 1. Go to Vercel Dashboard
Visit: https://vercel.com/dashboard

### 2. Select Your Project
Click on your project: **smcfcoke**

### 3. Add Environment Variables
1. Click on **Settings** tab
2. Click on **Environment Variables** in the left sidebar
3. Add the following variable:

#### VITE_API_URL
- **Name**: `VITE_API_URL`
- **Value**: `https://smcf-c99o.onrender.com`
- **Environment**: Select all (Production, Preview, Development)

### 4. Redeploy
After adding the environment variable:
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click the **⋯** (three dots) menu
4. Select **Redeploy**

This will rebuild your app with the correct backend URL.

### 5. Verify Deployment
Once redeployed, visit: https://smcfcoke.vercel.app

The app should now connect to your production backend at `https://smcf-c99o.onrender.com`

---

## Important Notes

✅ Your GitHub repository is already up to date
✅ The `.env` file is safely ignored (not committed)
✅ Frontend is configured to use `VITE_API_URL` environment variable
✅ Backend is deployed at: https://smcf-c99o.onrender.com

## Need to Update Backend URL Later?

Just update the `VITE_API_URL` environment variable in Vercel and redeploy. No code changes needed!
