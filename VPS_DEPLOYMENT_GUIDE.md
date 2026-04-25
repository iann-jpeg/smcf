# VPS DEPLOYMENT CHECKLIST

## **1. VPS REQUIREMENTS** ✅

Your VPS must have:
- [ ] Node.js v18+ installed
- [ ] MongoDB running on port 27017
- [ ] Two databases: `smcf` and `smcf-sacco`
- [ ] PM2 for process management
- [ ] Nginx/Caddy for reverse proxy

## **2. VERIFY ON VPS**

### Check Node.js
```bash
node --version  # Should be v18+
npm --version   # Should be v9+
```

### Check MongoDB
```bash
# Connect to MongoDB
mongosh localhost:27017

# In mongosh shell:
show databases  # Should list: smcf, smcf-sacco
```

### Check PM2
```bash
pm2 list  # Should show running processes
```

## **3. BACKEND PORTS ON VPS**

```
Main Backend    → Port 4000 → http://localhost:4000
SACCO Backend   → Port 5000 → http://localhost:5000
Frontend Main   → Port 3000 → http://localhost:3000
Frontend SACCO  → Port 3001 → http://localhost:3001
```

## **4. ENV FILES ARE NOW CONFIGURED FOR VPS**

### ✅ Main Backend - `backend/.env`
- MongoDB: `mongodb://localhost:27017/smcf`
- Port: 4000
- SACCO Backend URL: `http://127.0.0.1:5000`

### ✅ SACCO Backend - `smcf-sacco-backend/.env`
- MongoDB: `mongodb://localhost:27017/smcf-sacco`
- Port: 5000
- Frontend URL: `http://localhost:3001`

## **5. DEPLOYMENT STEPS ON VPS**

### Step 1: Pull Latest Code
```bash
cd /path/to/smcf
git pull origin main
```

### Step 2: Install Dependencies
```bash
# Main backend
cd backend
npm install

# SACCO backend
cd ../smcf-sacco-backend
npm install

# Go back
cd ..
```

### Step 3: Start with PM2
```bash
# Start Main Backend
pm2 start backend/server.js --name "smcf-backend" --port 4000

# Start SACCO Backend
pm2 start smcf-sacco-backend/server.js --name "sacco-backend" --port 5000

# Save PM2 config
pm2 save
pm2 startup
```

### Step 4: Verify Services
```bash
# Check backend logs
pm2 logs smcf-backend
pm2 logs sacco-backend

# Test connectivity
curl http://localhost:4000/health
curl http://localhost:5000/health
```

## **6. COMMON VPS MONGODB ISSUES**

### Issue: `connect ECONNREFUSED 127.0.0.1:27017`
**Solution**: MongoDB not running
```bash
# Check MongoDB status
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Enable auto-start
sudo systemctl enable mongod
```

### Issue: Database doesn't exist
**Solution**: Create databases manually
```bash
mongosh
> use smcf
> db.createCollection("members")
> use smcf-sacco
> db.createCollection("members")
```

### Issue: Connection string fails with auth error
**Solution**: Check MongoDB credentials in .env match your setup

## **7. CURRENT ISSUES TO FIX**

### ✅ Payment System 502 Errors
- **Fixed**: Null reference in `paid_by` field
- **Status**: Committed and pushed to GitHub (commit 5b0e592)
- **Action**: Need to rebuild and redeploy both backends

### ✅ Login Failures
- **Root Cause**: Backend 502 errors cascading to auth
- **Status**: Will be fixed once backends are redeployed

## **8. NEXT STEPS**

1. [ ] Verify MongoDB is running on VPS: `systemctl status mongod`
2. [ ] Pull latest code: `git pull origin main`
3. [ ] Install dependencies: `npm install` in both backend dirs
4. [ ] Restart backends with PM2
5. [ ] Test: `curl http://localhost:4000/health`
6. [ ] Verify via browser: Check if 502 errors are gone
