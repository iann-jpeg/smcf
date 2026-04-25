# 📋 VPS DEPLOYMENT SCRIPT & COMMANDS

## **QUICK START: Run These Commands on Contabo VPS**

### **Phase 1: Update Configuration (5 min)**

```bash
# 1. Navigate to project root
cd /path/to/smcf

# 2. Verify you're in the right directory
ls -la | grep backend  # Should show: backend, smcf-sacco-backend, sacco

# 3. Check current git status
git status

# 4. Pull latest code (includes payment bug fix)
git pull origin main
```

**Expected Output:**
```
Updating 5b0e592...[new commit]
Fast-forward (or merge)
 backend/routes/lipia.js | X insertions(+), Y deletions(-)
```

---

### **Phase 2: Update Main Backend (5 min)**

```bash
# 1. Navigate to backend
cd backend

# 2. Reinstall dependencies
npm ci

# 3. Verify syntax is valid
node -c server.js

# 4. Return to root
cd ..
```

**Expected Output for `node -c server.js`:**
```
[No output = Success!]
```

---

### **Phase 3: Update SACCO Backend (5 min)**

```bash
# 1. Navigate to SACCO backend
cd smcf-sacco-backend

# 2. Reinstall dependencies
npm ci

# 3. Verify syntax is valid
node -c quickstart.js

# 4. Return to root
cd ..
```

**Expected Output for `node -c quickstart.js`:**
```
[No output = Success!]
```

---

### **Phase 4: Restart Services (3 min)**

```bash
# 1. Check PM2 status
pm2 status

# Expected: Should show smcf-backend (port 4000) and sacco-backend (port 5001)

# 2. Restart both backends
pm2 restart smcf-backend
pm2 restart sacco-backend
pm2 save

# 3. Verify they restarted
pm2 status
```

**Expected Output for `pm2 status`:**
```
│ Name          │ id │ mode │ status  │ ↺   │ cpu │ memory      │
├───────────────┼────┼──────┼─────────┼─────┼─────┼─────────────┤
│ smcf-backend  │ 0  │ fork │ online  │ 0   │ X%  │ XXX.X MB    │
│ sacco-backend │ 1  │ fork │ online  │ 0   │ X%  │ XXX.X MB    │
```

---

### **Phase 5: Verify Deployment (2 min)**

```bash
# 1. Check main backend health
curl http://localhost:4000/health

# 2. Check SACCO backend health
curl http://localhost:5001/health

# 3. Check MongoDB connection
curl http://localhost:4000/admin/health/db

# 4. View error logs (last 30 lines)
pm2 logs smcf-backend --lines 30
pm2 logs sacco-backend --lines 30

# 5. Check if ports are listening
netstat -an | grep -E ':(4000|5001)'
```

**Expected Outputs:**

✅ **Backend Health (4000):**
```json
{
  "status": "OK",
  "uptime": 123.45,
  "mongodb": "connected",
  "timestamp": "2026-01-XX..."
}
```

✅ **SACCO Health (5001):**
```json
{
  "status": "OK",
  "uptime": 45.67,
  "mongodb": "connected"
}
```

✅ **Ports Listening:**
```
tcp  0  0  127.0.0.1:4000  0.0.0.0:*  LISTEN
tcp  0  0  127.0.0.1:5001  0.0.0.0:*  LISTEN
```

---

## **TROUBLESHOOTING COMMANDS**

### **If Backends Don't Start**

```bash
# 1. Check PM2 error logs
pm2 logs smcf-backend --err

# 2. Try starting manually to see errors
cd backend
npm start  # This will show actual error messages

# 3. Ctrl+C to stop, then
cd ..

# 4. If database error, verify MongoDB
mongosh --eval "db.adminCommand('ping')"

# 5. If .env not loaded, check file exists
cat backend/.env | grep MONGODB_URI
cat smcf-sacco-backend/.env | grep PORT
```

### **If Database Connection Fails**

```bash
# 1. Verify MongoDB is running
ps aux | grep mongod

# 2. Try connecting directly
mongosh

# 3. List databases (inside mongosh)
show dbs

# 4. Check if smcf and smcf-sacco databases exist
db.getMongo().getDBNames()
```

### **If Payment Processing Still Errors**

```bash
# 1. Check backend logs for 500 errors
pm2 logs smcf-backend --lines 50 | grep -i "error\|500\|payment"

# 2. Verify Socket.IO is working
curl http://localhost:4000/socket.io/

# 3. Check if Lipia API credentials are loaded
grep LIPIA_API_KEY backend/.env

# 4. Restart just the main backend
pm2 restart smcf-backend
```

---

## **ROLLBACK COMMANDS (If Something Breaks)**

```bash
# 1. Stop all services
pm2 stop smcf-backend sacco-backend

# 2. Revert to previous commit
git reset --hard HEAD~1

# 3. Reinstall dependencies
cd backend && npm ci && cd ..
cd smcf-sacco-backend && npm ci && cd ..

# 4. Restart
pm2 start ecosystem.config.cjs

# 5. Verify
curl http://localhost:4000/health
```

---

## **COMPLETE DEPLOYMENT (All in One)**

Save this as `deploy.sh` and run with `bash deploy.sh`:

```bash
#!/bin/bash

set -e  # Exit on first error

echo "🚀 Starting VPS Deployment..."

# Phase 1
echo "📥 Pulling latest code..."
git pull origin main

# Phase 2
echo "🔧 Updating main backend..."
cd backend
npm ci
node -c server.js
cd ..

# Phase 3
echo "🔧 Updating SACCO backend..."
cd smcf-sacco-backend
npm ci
node -c quickstart.js
cd ..

# Phase 4
echo "♻️ Restarting services..."
pm2 restart smcf-backend sacco-backend
pm2 save

# Phase 5
echo "✅ Verifying deployment..."
sleep 2

echo "Checking main backend (port 4000)..."
curl -s http://localhost:4000/health || echo "⚠️ Main backend not responding"

echo "Checking SACCO backend (port 5001)..."
curl -s http://localhost:5001/health || echo "⚠️ SACCO backend not responding"

echo "📊 PM2 Status:"
pm2 status

echo "✅ Deployment complete!"
```

---

## **MONITORING AFTER DEPLOYMENT**

```bash
# Watch real-time logs (all backends)
pm2 logs

# Watch only errors
pm2 logs | grep -i error

# See last 100 lines of smcf backend
pm2 logs smcf-backend --lines 100

# See only the last 5 minutes of logs
pm2 logs smcf-backend --since "5m"

# Get detailed stats
pm2 monit
```

---

## **KEY METRICS TO CHECK**

✅ **After Deployment:**
1. Both backends show `online` status in `pm2 status`
2. `curl` commands return JSON responses (no timeouts)
3. PM2 logs show no `Error`, `500`, or `502` messages
4. Memory usage is stable (not growing continuously)
5. MongoDB connection shows "connected"

❌ **Warning Signs:**
- `pm2 status` shows `stopped` or `errored`
- `curl` returns "connection refused"
- PM2 logs constantly show errors
- Memory usage growing to 100%+
- "Address already in use" errors

---

## **ESTIMATED TIME**

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Pull code | 2-5 min |
| 2 | Update backend | 3-5 min |
| 3 | Update SACCO | 3-5 min |
| 4 | Restart services | 1-2 min |
| 5 | Verify | 1-2 min |
| **TOTAL** | **Complete deployment** | **~15-20 min** |

---

**🎯 Goal:** Deploy fixed payment system to Contabo VPS and resolve all 502 errors.

**📞 Support:** If deployment fails, check PM2 logs first: `pm2 logs smcf-backend --err`
