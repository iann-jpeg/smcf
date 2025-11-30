# SMCF Platform - Complete Setup Guide

## Overview

This guide will help you set up the SMCF (Smart Moves Cash Flow) platform with a custom backend, replacing Supabase with a self-hosted Node.js/Express/MongoDB solution.

## Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Node.js + Express + MongoDB + Socket.IO
- **Authentication**: Custom OTP-based system with JWT
- **Real-time**: Socket.IO for live updates

## Key Features

### Authentication Flow

1. **Admin must register members first** - Members cannot self-register
2. Admin creates member account with phone number
3. Member receives OTP to login
4. System verifies member was registered by admin before allowing login
5. JWT tokens for session management

### Role-Based Access

- **Admin**: Can add/edit/delete members, process payments, approve loans
- **Member**: Can view dashboard, request loans, see announcements

---

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- MongoDB installed locally OR MongoDB Atlas account
- Git (for version control)
- A code editor (VS Code recommended)

---

## Part 1: Backend Setup

### Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Required Configuration:**

```env
# MongoDB - Choose one:
# Option A: Local MongoDB
MONGODB_URI=mongodb://localhost:27017/smcf

# Option B: MongoDB Atlas (Cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smcf

# Server
PORT=4000
NODE_ENV=development

# JWT Security
JWT_SECRET=your-super-secret-random-string-change-this

# Admin Phone (format: 254XXXXXXXXX)
ADMIN_PHONE=254759097157
```

### Step 3: Install MongoDB

**Option A: Local MongoDB**

Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

macOS:

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Option B: MongoDB Atlas (Cloud - Recommended)**

1. Go to https://www.mongodb.com/atlas
2. Create free account
3. Create a new cluster (free tier available)
4. Click "Connect" → "Connect your application"
5. Copy connection string
6. Replace `<password>` with your database user password
7. Add to `.env` as `MONGODB_URI`

### Step 4: Create Initial Admin Account

Start the backend server:

```bash
npm run dev
```

In another terminal, create your first admin:

```bash
curl -X POST http://localhost:4000/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "phone": "254759097157",
    "password": "SecurePassword123"
  }'
```

Save the returned token - you'll need it for admin operations.

### Step 5: Test Backend

```bash
# Health check
curl http://localhost:4000/health

# Should return: {"status":"ok","timestamp":"...","environment":"development"}
```

---

## Part 2: Frontend Setup

### Step 1: Install Frontend Dependencies

```bash
cd ..  # Back to root directory
npm install
```

### Step 2: Configure Frontend Environment

```bash
cp .env.example .env

# Edit .env
nano .env
```

Set:

```env
VITE_API_URL=http://localhost:4000
```

### Step 3: Start Frontend

```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

---

## Part 3: First Time Usage

### Admin Workflow

1. **Login as Admin**

   - Go to http://localhost:5173
   - Click "Login / Register"
   - Select "Admin" tab
   - Enter your admin phone number
   - Click "Send OTP"
   - Check backend terminal for OTP (in development mode)
   - Enter OTP and click "Login as Admin"

2. **Add Your First Member**

   - Click "Add Member" button
   - Fill in member details:
     - Name
     - Phone number (format: 254XXXXXXXXX)
     - ID Number
   - Click "Add Member"

3. **Member Can Now Login**
   - Member goes to http://localhost:5173
   - Clicks "Login / Register"
   - Selects "Member" tab
   - Enters their phone number
   - Receives OTP
   - Logs in successfully

---

## Part 4: Testing the System

### Test Admin Functions

1. **View Members**: Check members list in admin dashboard
2. **Add Announcement**: Click "Send Announcement" button
3. **Mark Payment**: Toggle payment status for a member
4. **Reorder Members**: Use up/down arrows to change member position

### Test Member Functions

1. **View Dashboard**: See payment status and announcements
2. **Request Loan**: (If implemented) Submit loan request
3. **View History**: Check payment history

---

## Part 5: Production Deployment

### Backend Deployment (Example: Ubuntu Server)

1. **Install Node.js and MongoDB**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs mongodb
```

2. **Clone and Setup**

```bash
git clone <your-repo-url>
cd smcf/backend
npm install --production
```

3. **Configure Environment**

```bash
cp .env.example .env
nano .env
```

Set production values:

```env
NODE_ENV=production
MONGODB_URI=<your-production-mongodb-uri>
JWT_SECRET=<very-secure-random-string>
PORT=4000
```

4. **Use PM2 for Process Management**

```bash
sudo npm install -g pm2
pm2 start server.js --name smcf-backend
pm2 save
pm2 startup
```

5. **Setup Nginx Reverse Proxy**

```bash
sudo apt-get install nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/smcf-api
```

Add:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/smcf-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

6. **Setup SSL with Let's Encrypt**

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Frontend Deployment

1. **Build for Production**

```bash
cd smcf
npm run build
```

2. **Deploy to Netlify/Vercel**

**Netlify:**

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

**Vercel:**

```bash
npm install -g vercel
vercel login
vercel --prod
```

3. **Set Environment Variables**
   - Go to your hosting dashboard
   - Add: `VITE_API_URL=https://api.yourdomain.com`

---

## Part 6: SMS Integration (Production)

For production, integrate an SMS gateway to send real OTPs:

### Africa's Talking (Recommended for Kenya)

```bash
npm install africastalking
```

Update `backend/routes/auth.js`:

```javascript
import AfricasTalking from "africastalking";

const africastalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = africastalking.SMS;

// In send-otp route:
await sms.send({
  to: [phone],
  message: `Your SMCF verification code is: ${otp}`,
  from: "SMCF",
});
```

---

## Troubleshooting

### Backend won't start

- Check MongoDB is running: `sudo systemctl status mongodb`
- Check port 4000 is available: `lsof -i :4000`
- Check `.env` file exists and is configured

### Frontend can't connect to backend

- Check CORS settings in `backend/server.js`
- Verify `VITE_API_URL` in frontend `.env`
- Check backend is running: `curl http://localhost:4000/health`

### Member can't login

- Verify member was added by admin first
- Check member status is "active"
- Check phone number format (254XXXXXXXXX)

### MongoDB connection failed

- Local: Check MongoDB is running
- Atlas: Check IP whitelist and credentials

---

## Security Checklist for Production

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Use HTTPS/SSL certificates
- [ ] Set `NODE_ENV=production`
- [ ] Use MongoDB authentication
- [ ] Implement rate limiting for OTP requests
- [ ] Set up proper CORS origins
- [ ] Use environment variables, never hardcode secrets
- [ ] Implement request logging
- [ ] Set up monitoring (PM2, New Relic, etc.)
- [ ] Regular database backups
- [ ] Implement SMS gateway for OTP delivery

---

## Support

For issues or questions:

- Check logs: `pm2 logs smcf-backend`
- Backend health: `curl http://localhost:4000/health`
- Database status: `mongosh` or MongoDB Compass

---

## License

Proprietary - SMCF Platform
