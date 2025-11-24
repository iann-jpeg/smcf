# SMCF System - Quick Start Guide

## 🚀 Starting the System

### Prerequisites

- Node.js installed
- MongoDB installed and running

### Step 1: Start MongoDB

```bash
# Option 1: Using systemd
sudo systemctl start mongodb

# Option 2: Direct command
mongod --dbpath /var/lib/mongodb

# Verify MongoDB is running
mongosh
# Should connect without errors
```

### Step 2: Start Backend Server

```bash
cd /home/crash/Desktop/smcf/smcf/backend
node server.js
```

**Expected Output:**

```
🚀 SMCF Backend Server running on port 4000
📡 Environment: development
🔌 Socket.IO enabled for real-time updates
MongoDB Connected: localhost
```

### Step 3: Start Frontend (New Terminal)

```bash
cd /home/crash/Desktop/smcf/smcf
npm run dev
```

**Expected Output:**

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## 🧪 Testing Guide

### 1. Create First Admin Account

**Via MongoDB Shell:**

```bash
mongosh smcf
```

```javascript
// Create admin with hashed password
const bcrypt = require("bcryptjs");
db.admins.insertOne({
  name: "Admin User",
  phone: "254700000000",
  password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIrS.yPm8m", // password: admin123
  role: "admin",
  permissions: {
    manage_members: true,
    manage_payments: true,
    manage_loans: true,
    send_announcements: true,
    process_disbursements: true,
  },
  created_at: new Date(),
});
```

### 2. Login to System

1. Go to http://localhost:5173
2. Click "Login / Register"
3. Select "Admin" tab
4. Enter:
   - Phone: `254700000000`
   - Password: `admin123`
5. Click "Login as Admin"

### 3. Add First Member

1. In Admin Dashboard, click "Add Member" (Quick Actions)
2. Fill in:
   - Name: `John Kamau`
   - Phone: `254711111111`
   - ID Number: `12345678`
   - Password: `member123`
   - Initial Contribution: `204`
3. Click "Add Member"
4. Member should appear in member list

### 4. Create Cycle

**Via API or MongoDB:**

```bash
curl -X POST http://localhost:4000/api/cycles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_number": 1,
    "target_amount": 2040,
    "status": "active"
  }'
```

**Or via MongoDB:**

```javascript
db.cycles.insertOne({
  cycle_number: 1,
  start_date: new Date(),
  status: "active",
  paid_members_count: 0,
  total_amount_collected: 0,
  target_amount: 2040,
  created_at: new Date(),
});
```

### 5. Test Payment Recording

**Login as Member:**

1. Logout from admin
2. Login with member credentials:
   - Phone: `254711111111`
   - Password: `member123`
3. View member dashboard
4. Click "Pay via M-Pesa"
5. Complete mock payment

**Or Record Payment as Admin:**

```bash
curl -X POST http://localhost:4000/api/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "MEMBER_OBJECT_ID",
    "amount": 204,
    "phone": "254711111111",
    "mpesa_transaction_id": "TEST123456",
    "payment_method": "mpesa",
    "cycle_number": 1
  }'
```

### 6. Test Disbursement

1. Login as admin
2. Add more members and mark all as paid
3. Go to "Disbursements" tab
4. Click "Send Payment"
5. Select recipient
6. Confirm disbursement
7. Check "Disbursement History"

### 7. Test Real-Time Updates

1. Open two browser windows
2. Login as admin in both
3. In window 1: Toggle payment status
4. Window 2 should update within 15 seconds

---

## 🔍 Troubleshooting

### Backend Won't Start

**MongoDB Connection Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**

```bash
# Check if MongoDB is running
sudo systemctl status mongodb

# Start MongoDB
sudo systemctl start mongodb

# Or start manually
mongod --dbpath /var/lib/mongodb
```

### Port Already in Use

**Error:**

```
Error: listen EADDRINUSE: address already in use :::4000
```

**Solution:**

```bash
# Find process using port 4000
lsof -i :4000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=4001 node server.js
```

### Frontend Can't Connect to Backend

**Error in browser console:**

```
Failed to fetch
```

**Solution:**

1. Check backend is running on port 4000
2. Verify CORS is enabled
3. Check API_BASE in frontend: `src/lib/api.ts`

### JWT Token Issues

**Error:**

```
401 Unauthorized
```

**Solution:**

1. Login again to get new token
2. Check JWT_SECRET in backend .env
3. Token might be expired

---

## 📊 Database Quick Checks

### View All Members

```javascript
mongosh smcf
db.members.find().pretty()
```

### View Current Cycle

```javascript
db.cycles.findOne({ status: "active" });
```

### View Recent Payments

```javascript
db.payments.find().sort({ date: -1 }).limit(5).pretty();
```

### View Disbursements

```javascript
db.disbursements.find().pretty();
```

### Reset System (Development Only)

```javascript
// ⚠️ WARNING: Deletes all data!
db.members.deleteMany({});
db.payments.deleteMany({});
db.cycles.deleteMany({});
db.disbursements.deleteMany({});
db.loans.deleteMany({});
db.announcements.deleteMany({});
```

---

## 🎯 Testing Checklist

### Admin Panel

- [ ] Login as admin
- [ ] Add new member
- [ ] Edit member details
- [ ] Delete member
- [ ] Toggle payment status
- [ ] Send reminders
- [ ] Process payout (with validation)
- [ ] Export CSV
- [ ] Send announcement
- [ ] View payment tracking
- [ ] View disbursement history
- [ ] Approve loan request
- [ ] View reports

### Member Dashboard

- [ ] Login as member
- [ ] View payment status
- [ ] Make payment (mock)
- [ ] Request loan
- [ ] View announcements
- [ ] View payment history
- [ ] View next payout info

### Real-Time Features

- [ ] Payment updates reflect immediately
- [ ] Cycle stats update automatically
- [ ] Disbursements show in history
- [ ] Member list updates
- [ ] Announcements broadcast

---

## 📱 API Testing with cURL

### Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254700000000",
    "password": "admin123"
  }'
```

### Get Members (with token)

```bash
curl http://localhost:4000/api/members \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Current Cycle

```bash
curl http://localhost:4000/api/cycles/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Payments

```bash
curl http://localhost:4000/api/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🔧 Development Tips

### Watch Logs

```bash
# Backend logs
cd backend && node server.js

# Frontend logs
cd smcf && npm run dev

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

### Hot Reload

- Frontend: Vite hot-reloads automatically
- Backend: Use `nodemon` for auto-restart:
  ```bash
  npm install -g nodemon
  nodemon server.js
  ```

### Debug Mode

```bash
# Backend with debug
DEBUG=* node server.js

# Frontend with source maps
npm run dev -- --debug
```

---

## 📞 Support

### Check Server Health

```bash
curl http://localhost:4000/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-11-22T...",
  "environment": "development"
}
```

### View All Available Endpoints

```bash
curl http://localhost:4000/
```

---

**System Ready! 🎉**

Everything is configured and ready to test. Start MongoDB, then the backend, then the frontend, and follow the testing guide above.
