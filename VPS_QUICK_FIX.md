# 🔧 VPS QUICK FIX: Get sacco-backend Running

## ⚠️ **Problem Found**
- ✅ `smcf-backend` restarted successfully
- ❌ `sacco-backend` not found in PM2

## 🚀 **Quick Fix (Run These Commands on VPS)**

### **Step 1: Check PM2 Status**
```bash
pm2 status
```

**Expected Output:**
- Should show `smcf-backend` running on port 4000
- Should NOT show `sacco-backend` (this is the problem)

### **Step 2: Check ecosystem.config.cjs**
```bash
cat ecosystem.config.cjs
```

**Look for:** Lines that define `sacco-backend` app configuration

### **Step 3: Start sacco-backend**

**Option A: If ecosystem.config exists (recommended)**
```bash
# Start just the sacco-backend from ecosystem config
pm2 start ecosystem.config.cjs --only sacco-backend
pm2 save
```

**Option B: Manual start**
```bash
# Navigate to SACCO backend
cd /var/www/smcf/smcf-sacco-backend

# Start with PM2
pm2 start --name sacco-backend npm -- start

# Save
pm2 save
```

### **Step 4: Verify Both Are Running**
```bash
pm2 status
```

**Expected Output:**
```
│ Name          │ id │ mode │ status  │
├───────────────┼────┼──────┼─────────┤
│ smcf-backend  │ 0  │ fork │ online  │
│ sacco-backend │ 1  │ fork │ online  │
```

### **Step 5: Test Health Endpoints**
```bash
# Main backend (should return JSON)
curl http://localhost:4000/health

# SACCO backend (should return JSON)
curl http://localhost:5001/health
```

**Expected: Both return 200 + JSON response**

---

## 🔍 **If Still Not Working**

### Check Error Logs
```bash
# See sacco-backend startup errors
pm2 logs sacco-backend --lines 50

# See if port 5001 is already in use
lsof -i :5001

# Check if sacco-backend process is running at all
ps aux | grep "sacco\|node"
```

### Check Config Files
```bash
# Look for ecosystem.config or PM2 config
ls -la | grep ecosystem
ls -la | grep config
ls -la ~/.pm2/

# Check saved PM2 config
cat ~/.pm2/dump.pm2
```

### Manual Start with Output
```bash
cd /var/www/smcf/smcf-sacco-backend
node -c quickstart.js  # Verify syntax
npm start              # See actual error messages
```

---

## ✅ **Success Criteria**

After completing these steps, you should have:
- [ ] Both backends showing `online` in `pm2 status`
- [ ] `curl http://localhost:4000/health` returns JSON (HTTP 200)
- [ ] `curl http://localhost:5001/health` returns JSON (HTTP 200)
- [ ] `pm2 logs` show no Error messages
- [ ] Both ports listening: `netstat -an | grep -E ':(4000|5001)'`

---

## 📞 **Next: Test the System**

Once both are running:
1. Try logging in: https://smcf.app
2. Try payment: https://smcf.app → SACCO Portal
3. Monitor logs: `pm2 logs`

**You should NOT get 502 errors anymore!**
