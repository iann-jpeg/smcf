# ✅ COMPLETE VPS DEPLOYMENT GUIDE

## **SUMMARY OF CHANGES**

### 1. ✅ Payment System Bug FIXED
- **Issue**: 502 errors from null reference in payment processing
- **Fix**: Added safe fallback for `paid_by` field
- **Commit**: `5b0e592` (already pushed to GitHub)

### 2. ✅ .env Files Created/Fixed
- **backend/.env** → Created with VPS MongoDB config
- **smcf-sacco-backend/.env** → Fixed and updated for VPS

### 3. ⏳ Ready for VPS Deployment

---

## **VPS DEPLOYMENT CHECKLIST**

### ✅ STEP 1: VERIFY VPS SETUP

**On your VPS server, run:**
```bash
# Check Node.js
node --version  # Must be v18+

# Check MongoDB is running
sudo systemctl status mongod

# Check MongoDB databases exist
mongosh localhost:27017
> show databases
# Should show: smcf, smcf-sacco
```

**If MongoDB not running:**
```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

---

### ✅ STEP 2: PULL LATEST CODE

**On your VPS:**
```bash
cd /path/to/smcf
git pull origin main
```

This pulls:
- ✅ Payment system bug fixes
- ✅ Corrected .env files

---

### ✅ STEP 3: INSTALL DEPENDENCIES

```bash
# Main backend
cd backend
npm install

# SACCO backend
cd ../smcf-sacco-backend
npm install

# Go back to root
cd ..
```

---

### ✅ STEP 4: START BACKENDS WITH PM2

**Option A: Using PM2 (Recommended)**
```bash
# Install PM2 if not already installed
npm install -g pm2

# Start backends
pm2 start backend/server.js --name "smcf-backend" --env production
pm2 start smcf-sacco-backend/server.js --name "sacco-backend" --env production

# Save and auto-start on reboot
pm2 save
pm2 startup
```

**Option B: Using npm start**
```bash
# Terminal 1 - Main backend
cd backend
npm start

# Terminal 2 - SACCO backend
cd smcf-sacco-backend
npm start
```

---

### ✅ STEP 5: VERIFY BACKENDS ARE RUNNING

```bash
# Check PM2 status
pm2 list

# View logs
pm2 logs smcf-backend
pm2 logs sacco-backend

# Test connectivity
curl http://localhost:4000/health
curl http://localhost:5000/health

# Expected response: { "status": "ok", ... }
```

---

### ✅ STEP 6: VERIFY FRONTEND SETUP

**Frontend is served from:**
- Main: `/dist` (built Vite app)
- SACCO: `/dist/sacco`

**Nginx/Caddy should proxy:**
```
/ → :3000 (Frontend Main)
/api/* → :4000 (Backend Main)
/sacco/* → :3001 (Frontend SACCO)
/sacco-api/* → :5000 (Backend SACCO)
```

---

## **ENVIRONMENT CONFIGURATION REFERENCE**

### Main Backend - `backend/.env`
```env
MONGODB_URI=mongodb://localhost:27017/smcf
PORT=4000
NODE_ENV=production
CLIENT_URL=http://localhost:3000
JWT_SECRET=your-secret-key
SACCO_BACKEND_URL=http://127.0.0.1:5000
LIPIA_API_KEY=your-lipia-key
ADMIN_EMAILS=ianabungana5@gmail.com
```

### SACCO Backend - `smcf-sacco-backend/.env`
```env
MONGODB_URI=mongodb://localhost:27017/smcf-sacco
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://localhost:3001
JWT_SECRET=your-secret-key
LIPIA_API_KEY=your-lipia-key
ADMIN_EMAILS=ianabungana5@gmail.com
```

---

## **TROUBLESHOOTING**

### ❌ Error: `connect ECONNREFUSED 127.0.0.1:27017`
**MongoDB not running**
```bash
sudo systemctl start mongod
```

### ❌ Error: `Port 4000 already in use`
**Kill existing process:**
```bash
lsof -i :4000  # Find process
kill -9 <PID>  # Kill it
```

### ❌ Error: Database doesn't exist
**Create databases:**
```bash
mongosh
> use smcf
> db.createCollection("members")
> use smcf-sacco
> db.createCollection("members")
```

### ❌ Error: 502 Bad Gateway still showing
**Check backend logs:**
```bash
pm2 logs smcf-backend --lines 100
```

---

## **VERIFICATION TESTS**

After deployment, test from browser:

✅ **Backend Health**
- `http://your-vps:4000/health` → Should return `{ status: "ok" }`
- `http://your-vps:5000/health` → Should return `{ status: "ok" }`

✅ **Login**
- Try to login with admin credentials
- Should NOT get 502 error

✅ **Payments**
- Try to initiate M-Pesa payment
- Should see STK Push popup

✅ **Real-time Updates**
- Socket.IO connection should work
- No 502 errors in console

---

## **NEXT STEPS**

1. [ ] Run above steps on VPS
2. [ ] Test all health endpoints
3. [ ] Monitor PM2 logs: `pm2 logs`
4. [ ] If 502 errors persist, share the error logs

**Questions? Check the logs first:**
```bash
pm2 logs smcf-backend --lines 50
pm2 logs sacco-backend --lines 50
```
