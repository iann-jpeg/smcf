# 🚀 CONTABO VPS DEPLOYMENT CHECKLIST

## ✅ **CRITICAL: What Has Been Fixed**

### 1. **Backend Payment Bug (FIXED ✓)**
- **File**: `backend/routes/lipia.js`
- **Issue**: Null reference when `payment.paid_by` field undefined
- **Fix Applied**: Safe fallback pattern at 3 locations (lines ~538, 1378, 1388)
- **Commit**: 5b0e592 (already pushed to GitHub)
- **Code Pattern**:
  ```javascript
  payerId: payment.paid_by ? payment.paid_by.toString() : payment.member_id.toString()
  ```

### 2. **Main Backend .env (READY ✓)**
- **File**: `backend/.env`
- **Port**: 4000
- **Database**: `mongodb://localhost:27017/smcf`
- **Status**: Correct for Contabo VPS

### 3. **SACCO Backend .env (READY ✓)**
- **File**: `smcf-sacco-backend/.env`
- **Port**: 5001
- **Database**: `mongodb://localhost:27017/smcf-sacco`
- **Frontend URL**: `https://smcfsacco.vercel.app`
- **Status**: Corrected and ready for deployment

---

## 🔧 **DEPLOYMENT STEPS (Contabo VPS)**

### **Step 1: Copy Updated .env Files**
```bash
# From your local machine, copy corrected .env files to VPS
scp backend/.env root@[VPS_IP]:/path/to/smcf/backend/.env
scp smcf-sacco-backend/.env root@[VPS_IP]:/path/to/smcf/smcf-sacco-backend/.env
```

### **Step 2: Pull Latest Code (Includes Bug Fix)**
```bash
cd /path/to/smcf
git pull origin main
```

### **Step 3: Install/Update Dependencies**

**Main Backend:**
```bash
cd backend
npm ci  # Use ci for production (not install)
```

**SACCO Backend:**
```bash
cd smcf-sacco-backend
npm ci
```

### **Step 4: Restart Both Backends**

If using PM2:
```bash
# Verify PM2 apps are configured
pm2 list

# If not already set up, create ecosystem config
pm2 start ecosystem.config.cjs

# Or restart existing apps
pm2 restart smcf-backend sacco-backend
pm2 save
```

If using systemd (alternative):
```bash
systemctl restart smcf-backend
systemctl restart sacco-backend
```

### **Step 5: Verify Health Endpoints**

```bash
# Main backend (should return 200 with health data)
curl http://localhost:4000/health

# SACCO backend (should return 200 with health data)
curl http://localhost:5001/health

# Check for errors in logs
pm2 logs smcf-backend --lines 20
pm2 logs sacco-backend --lines 20
```

---

## 🔍 **VERIFICATION CHECKLIST**

- [ ] Both .env files copied to VPS
- [ ] Latest code pulled (`git pull origin main`)
- [ ] Dependencies installed (`npm ci`)
- [ ] Backends restarted with PM2
- [ ] Health endpoints respond with 200
- [ ] No error logs in PM2
- [ ] MongoDB is running (`ps aux | grep mongod`)
- [ ] Port 4000 is listening (`netstat -an | grep 4000`)
- [ ] Port 5001 is listening (`netstat -an | grep 5001`)

---

## 🧪 **MANUAL TEST**

### **Test 1: Login (Verify No 502)**
1. Go to https://smcf.app
2. Login with: **254759097157** / **password**
3. Should NOT get 502 error

### **Test 2: M-Pesa Payment (Verify Payment Processing)**
1. Go to https://smcf.app → SACCO Portal
2. Initiate payment
3. Check PM2 logs for payment processing
4. Should complete without 502 errors

### **Test 3: Socket.IO Connection**
1. Open browser DevTools (F12)
2. Check WebSocket tab
3. Socket.IO should connect successfully
4. No "502" or "socket hang up" errors

---

## 📊 **EXPECTED RESULT**

✅ **System State After Deployment:**
- Main backend running on port 4000
- SACCO backend running on port 5001
- Both connected to local MongoDB
- Payment processing working (no null reference errors)
- Frontend frontends connecting successfully
- Login/authentication working
- No 502 errors

---

## 🆘 **TROUBLESHOOTING**

### **502 Errors Persist**
```bash
# Check if backends are running
pm2 status

# View detailed error logs
pm2 logs smcf-backend --err
pm2 logs sacco-backend --err

# Check MongoDB is running
ps aux | grep mongod
```

### **MongoDB Connection Refused**
```bash
# Verify MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# If not running, start it
sudo systemctl start mongod
# or for Contabo: mongod --dbpath /data/db &
```

### **Port Already in Use**
```bash
# Find what's using ports
lsof -i :4000
lsof -i :5001

# Kill if needed
kill -9 [PID]
```

---

## 📝 **ENVIRONMENT CONFIGURATION SUMMARY**

### **Main Backend (`backend/.env`)**
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/smcf
SACCO_BACKEND_URL=http://127.0.0.1:5001
```

### **SACCO Backend (`smcf-sacco-backend/.env`)**
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/smcf-sacco
FRONTEND_URL=https://smcfsacco.vercel.app
MPESA_CALLBACK_URL=https://smcf.app/sacco/api/mpesa/callback
```

---

**🎯 Goal**: Deploy fixed code to Contabo VPS and verify all 502 errors are resolved.
