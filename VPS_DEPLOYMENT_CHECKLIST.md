# ðŸš€ CONTABO VPS DEPLOYMENT CHECKLIST

## âœ… **CRITICAL: What Has Been Fixed**

### 1. **Backend Payment Bug (FIXED âœ“)**
- **File**: `backend/routes/lipia.js`
- **Issue**: Null reference when `payment.paid_by` field undefined
- **Fix Applied**: Safe fallback pattern at 3 locations (lines ~538, 1378, 1388)
- **Commit**: 5b0e592 (already pushed to GitHub)
- **Code Pattern**:
  ```javascript
  payerId: payment.paid_by ? payment.paid_by.toString() : payment.member_id.toString()
  ```

### 2. **Main Backend .env (READY âœ“)**
- **File**: `backend/.env`
- **Port**: 4000
- **Database**: `mongodb://localhost:27017/smcf`
- **Status**: Correct for Contabo VPS

### 3. **SACCO Backend .env (READY âœ“)**
- **File**: `smcf-sacco-backend/.env`
- **Port**: 5001
- **Database**: `mongodb://localhost:27017/smcf-sacco`
- **Frontend URL**: `https://smart-moves.tech`
- **Status**: Corrected and ready for deployment

---

## ðŸ”§ **DEPLOYMENT STEPS (Contabo VPS)**

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

## ðŸ” **VERIFICATION CHECKLIST**

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

## ðŸ§ª **MANUAL TEST**

### **Test 1: Login (Verify No 502)**
1. Go to https://smart-moves.tech
2. Login with: **254759097157** / **password**
3. Should NOT get 502 error

### **Test 2: M-Pesa Payment (Verify Payment Processing)**
1. Go to https://smart-moves.tech â†’ SACCO Portal
2. Initiate payment
3. Check PM2 logs for payment processing
4. Should complete without 502 errors

### **Test 3: Socket.IO Connection**
1. Open browser DevTools (F12)
2. Check WebSocket tab
3. Socket.IO should connect successfully
4. No "502" or "socket hang up" errors

---

## ðŸ“Š **EXPECTED RESULT**

âœ… **System State After Deployment:**
- Main backend running on port 4000
- SACCO backend running on port 5001
- Both connected to local MongoDB
- Payment processing working (no null reference errors)
- Frontend frontends connecting successfully
- Login/authentication working
- No 502 errors

---

## ðŸ†˜ **TROUBLESHOOTING**

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

## ðŸ“ **ENVIRONMENT CONFIGURATION SUMMARY**

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
FRONTEND_URL=https://smart-moves.tech
DARAJA_API_URL=https://api.safaricom.co.ke
DARAJA_SHORTCODE=8315413
DARAJA_TILL_NUMBER=6938069
DARAJA_TRANSACTION_TYPE=CustomerBuyGoodsOnline
DARAJA_CALLBACK_URL=https://smart-moves.tech/sacco-api/api/mpesa/daraja/callback
# Optional M-Pesa Dynamic QR backup. Keep disabled until the QR callback is
# registered with Safaricom for the production shortcode.
DARAJA_QR_ENABLED=false
DARAJA_QR_CALLBACK_URL=https://smart-moves.tech/sacco-api/api/mpesa/qr/callback
DARAJA_QR_TRANSACTION_CODE=BG
PESAPAL_BASE_URL=https://pay.pesapal.com/v3
PESAPAL_CALLBACK_URL=https://smart-moves.tech/sacco-api/api/pesapal/callback
```

The member account now has an additive **Backup payment options** control.
It exposes the existing Pesapal order flow and the optional Daraja Dynamic QR
flow without changing the existing M-Pesa STK dialogs.

For Pesapal, confirm that `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`,
and `PESAPAL_IPN_ID` are present in the backend `.env`. Register the callback
URL above with Pesapal.

For M-Pesa QR, first register
`https://smart-moves.tech/sacco-api/api/mpesa/qr/callback` as the C2B/QR
notification URL for the production shortcode/till with Safaricom. Only then
set `DARAJA_QR_ENABLED=true` and restart the backend. QR payments remain
pending until Safaricom delivers the callback, after which the normal
transaction/balance settlement helpers are used.

### **Combined public landing page and SACCO deployment**

The public landing page must remain at the domain root. The SACCO application
is served under `/sacco/`, and the SACCO backend remains behind `/sacco-api/`
on port 5001. Build the combined application from the repository root so
`dist/index.html` contains the landing page and `dist/sacco/index.html`
contains the SACCO application.

```bash
cd /var/www/smcf
git pull origin main
export VITE_SACCO_BASE_PATH=/sacco/
export VITE_SACCO_API_URL=/sacco-api
npm install --no-audit --no-fund
npm run build:all
```

Use this Nginx layout for the SACCO-only site:

```nginx
root /var/www/smcf/dist;
index index.html;

location /sacco-api/ {
    proxy_pass http://127.0.0.1:5001/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

The `/sacco/` location is served from the combined `dist/sacco` output:

```nginx
location /sacco/ {
    try_files $uri $uri/ /sacco/index.html;
}
```

---

**ðŸŽ¯ Goal**: Deploy fixed code to Contabo VPS and verify all 502 errors are resolved.
