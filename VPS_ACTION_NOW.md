# ⚡ RIGHT NOW: VPS Action Plan

## 🎯 Current Situation
✅ Main backend (`smcf-backend`) restarted successfully  
❌ SACCO backend (`sacco-backend`) NOT FOUND in PM2  
⚠️ Need to start `sacco-backend` manually

---

## 🔥 **RUN THESE 4 COMMANDS RIGHT NOW** (on VPS)

### **Command 1: Check Current PM2 Apps**
```bash
pm2 status
```

### **Command 2: Check if ecosystem config exists**
```bash
ls -la | grep ecosystem
```

**If found**, look at it:
```bash
cat ecosystem.config.cjs
```

### **Command 3: Start sacco-backend**

**If ecosystem.config.cjs exists:**
```bash
pm2 start ecosystem.config.cjs --only sacco-backend
pm2 save
```

**If it doesn't exist, start manually:**
```bash
cd /var/www/smcf/smcf-sacco-backend
pm2 start --name sacco-backend npm -- start
pm2 save
```

### **Command 4: Verify Both Running**
```bash
pm2 status
```

**You should see:**
- `smcf-backend` → `online` (port 4000)
- `sacco-backend` → `online` (port 5001)

---

## ✅ **Quick Verification**

```bash
# Test both backends respond
curl http://localhost:4000/health
curl http://localhost:5001/health

# Check ports are listening
netstat -an | grep -E ':(4000|5001)'

# Check logs for errors
pm2 logs --lines 20
```

---

## 📊 **Expected Results**

### ✅ If Working
```
HTTP/1.1 200 OK
{
  "status": "OK",
  "mongodb": "connected"
}
```

### ❌ If Failing
```
ECONNREFUSED (backend not running)
or
"mongodb": "disconnected" (MongoDB issue)
```

---

## 🚨 **If sacco-backend Won't Start**

Check error logs:
```bash
pm2 logs sacco-backend --lines 50
```

**Common Issues:**
1. **Port 5001 already in use:** `lsof -i :5001`
2. **Bad .env file:** `cat smcf-sacco-backend/.env`
3. **Missing dependencies:** `cd smcf-sacco-backend && npm ci`
4. **Syntax error:** `node -c quickstart.js`

---

## 🎯 **SUCCESS = All 4 Green Checkmarks**

- [ ] `pm2 status` shows both backends `online`
- [ ] `curl http://localhost:4000/health` returns 200
- [ ] `curl http://localhost:5001/health` returns 200  
- [ ] `pm2 logs` shows no errors

**Then**: Test login at https://smcf.app (should work without 502!)

---

## 📝 **After You Complete These Steps**

Reply with the output of:
```bash
pm2 status
pm2 logs --lines 20
```

So I can verify both backends are running and see if there are any issues.
