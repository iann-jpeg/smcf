# 🔥 VPS Emergency Recovery Plan

## Current Crisis
- **Main Backend**: Crashing with `SyntaxError: Unexpected token ')'`
- **SACCO Backend**: Port conflict (process 11 competing with cluster)
- **Impact**: Complete system outage, 502 errors

---

## 🚀 IMMEDIATE ACTION STEPS (Execute in Order)

### **STEP 1: Clean PM2 State**
```bash
# Kill all Node processes
pm2 kill

# Remove corrupted dump
rm -f ~/.pm2/dump.pm2

# Clear logs
pm2 flush
```

### **STEP 2: Clean and Redeploy Code**
```bash
# Navigate to main application
cd /var/www/smcf

# Remove node_modules and reinstall (fresh install)
rm -rf backend/node_modules backend/package-lock.json
rm -rf smcf-sacco-backend/node_modules smcf-sacco-backend/package-lock.json

# Pull latest code
git pull origin main
git status  # Verify working tree is clean

# Install dependencies fresh
cd backend && npm ci && cd ..
cd smcf-sacco-backend && npm ci && cd ..
```

### **STEP 3: Verify File Integrity**
```bash
# Check main backend syntax
cd /var/www/smcf/backend
node -c server.js 2>&1
# ✅ Expected: No output (silent = valid syntax)

# If that fails, check the exact error
node server.js 2>&1 | head -20
```

### **STEP 4: Fresh PM2 Start**
```bash
cd /var/www/smcf

# Start main backend
pm2 start ecosystem.config.cjs --only smcf-backend
sleep 2

# Start SACCO backend
pm2 start ecosystem.config.cjs --only sacco-backend
sleep 2

# Save new configuration
pm2 save

# Verify
pm2 status
```

### **STEP 5: Validate Both Backends**
```bash
# Test main backend
curl http://localhost:4000/health 2>&1

# Test SACCO backend
curl http://localhost:5001/health 2>&1

# Expected: Both return JSON with status
# {
#   "status": "ok",
#   "db": "connected",
#   ...
# }
```

### **STEP 6: Check Logs for Errors**
```bash
# Show recent logs
pm2 logs --lines 30

# Filter for errors
pm2 logs | grep -i error

# Show only smcf-backend logs
pm2 logs smcf-backend --lines 50
```

---

## 🔍 If Step 3 or 5 Fails: Detailed Debugging

### If `node -c server.js` Still Fails:
```bash
# Get the exact syntax error with line numbers
node server.js 2>&1 | grep -A 5 "SyntaxError"

# Example output will show:
# SyntaxError: Unexpected token ')' at line XX
```

### If Port Conflict Persists:
```bash
# Check what's using ports 4000 and 5001
lsof -i :4000
lsof -i :5001

# Kill any rogue processes
pkill -f "node server.js"
pkill -f "node quickstart.js"

# Restart PM2
pm2 kill
sleep 2
pm2 start ecosystem.config.cjs
```

### If MongoDB Connection Fails:
```bash
# Check MongoDB is running
systemctl status mongodb
# or
systemctl status mongod

# Check connection string in .env files
cat backend/.env | grep MONGODB_URI
cat smcf-sacco-backend/.env | grep MONGODB_URI

# Test MongoDB directly
mongo mongodb://localhost:27017/smcf
# Should show: >
```

---

## ✅ Success Checklist

After all steps, verify:

- [ ] `pm2 status` shows:
  - `smcf-backend`: online (fork, port 4000)
  - `sacco-backend`: cluster (4 instances, port 5001)
  - NO process 11 or duplicates

- [ ] `curl http://localhost:4000/health` returns:
  - HTTP 200
  - JSON with `"status": "ok"`
  - `"db": "connected"`

- [ ] `curl http://localhost:5001/health` returns:
  - HTTP 200
  - JSON with `"status": "success"`

- [ ] `pm2 logs --lines 20` shows:
  - No SyntaxError
  - No EADDRINUSE errors
  - Normal operation logs

- [ ] Frontend loads at https://smcf.app without 502 errors

---

## 📋 Common Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Syntax Error** | `SyntaxError: Unexpected token ')'` | `git clean -fd`, `git reset --hard origin/main`, reinstall node_modules |
| **Port Conflict** | `EADDRINUSE: address already in use :::5001` | Kill all node processes: `pkill -9 node`, then restart |
| **DB Connection** | `"db": "connecting"` after 30s | Check `MONGODB_URI` in `.env`, verify MongoDB is running |
| **Module Not Found** | `Cannot find module 'xyz'` | Run `npm ci` again, check package.json |
| **Permission Denied** | Can't write to `/root/.pm2/` | Check directory permissions: `ls -la ~/.pm2/` |

---

## 🆘 If Still Failing After All Steps

### Provide These Diagnostics:
```bash
# 1. Full error output
pm2 logs smcf-backend --lines 100

# 2. Backend status
cd /var/www/smcf/backend
node -c server.js 2>&1

# 3. Port status
netstat -an | grep -E ':(4000|5001|27017)'

# 4. Environment check
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 version: $(pm2 --version)"
cat backend/.env | grep -E 'PORT|MONGODB|NODE_ENV'
```

Then share outputs starting with **STEP 1** diagnostic.

---

## 🎯 Expected Timeline
- **Step 1-2**: 2-3 minutes
- **Step 3**: < 30 seconds
- **Step 4-5**: 1-2 minutes
- **Total**: ~5-7 minutes to full recovery

**Do these steps right now and report back when complete!**
