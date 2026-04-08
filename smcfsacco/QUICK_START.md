# 🚀 SMCF SACCO Quick Start Guide

Get your SMCF SACCO Management System up and running in minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed ([Download](https://nodejs.org/))
- [ ] MongoDB Atlas account ([Sign up free](https://www.mongodb.com/cloud/atlas/register))
- [ ] Code editor (VS Code recommended)
- [ ] Git installed

## Step 1: MongoDB Atlas Setup (5 minutes)

1. **Create a free cluster** at https://cloud.mongodb.com
2. **Create database user**:
   - Username: `smcf_admin` (or your choice)
   - Password: Generate a secure password
   - Built-in Role: Atlas admin
3. **Get connection string**:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `smcf_sacco`
4. **Whitelist IP addresses**:
   - Network Access → Add IP Address
   - For development: Add your current IP
   - For Render: Add `0.0.0.0/0` (all IPs)

## Step 2: Backend Setup (3 minutes)

```powershell
# Navigate to backend
cd "d:\SMCF SACCO\smcf-sacco-backend"

# Install dependencies
npm install

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output, you'll need it in the next step

# Create .env file
Copy-Item .env.example .env

# Edit .env file with your favorite editor
notepad .env
```

**Update .env file**:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://smcf_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/smcf_sacco?retryWrites=true&w=majority
JWT_SECRET=paste_the_generated_secret_here
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

**Start backend**:
```powershell
npm run dev
```

✅ Backend should now be running on http://localhost:5000

## Step 3: Seed Initial Data (1 minute)

Open a **new terminal** window:

```powershell
cd "d:\SMCF SACCO\smcf-sacco-backend"
npm run seed
```

This creates:
- **Admin**: admin@smcfsacco.com / admin123
- **Credit Officer**: officer@smcfsacco.com / officer123
- **Treasurer**: treasurer@smcfsacco.com / treasurer123
- **3 Sample Members** with savings and shares

## Step 4: Frontend Setup (2 minutes)

Open **another new terminal** window:

```powershell
cd "d:\SMCF SACCO\smcf-sacco"

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:5000/api" > .env

# Start frontend
npm run dev
```

✅ Frontend should now be running on http://localhost:5173

## Step 5: Test the Application

1. **Open browser** → http://localhost:5173
2. **Login** with admin credentials:
   - Email: `admin@smcfsacco.com`
   - Password: `admin123`
3. **Explore**:
   - Dashboard → View statistics
   - Members → See 3 sample members
   - Loans → Apply for a loan
   - Transactions → Record deposits/withdrawals

## Verify Everything Works

### Test Backend Health
Open: http://localhost:5000/health

Should return: `{"status":"ok","timestamp":"..."}`

### Test API Endpoints
```powershell
# Login test
curl -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@smcfsacco.com","password":"admin123"}'
```

Should return a JWT token.

### Test Frontend Connection
- Login to the app
- Navigate to dashboard
- Check if statistics load
- Try creating a new member

## Common Issues & Solutions

### ❌ "Cannot connect to MongoDB"
**Solution**: 
- Check MongoDB Atlas connection string in backend/.env
- Verify database password is correct
- Ensure IP address is whitelisted

### ❌ "Port 5000 already in use"
**Solution**:
```powershell
# Find and kill process
netstat -ano | findstr :5000
taskkill /PID <process_id> /F
```

### ❌ "Network Error" in frontend
**Solution**:
- Ensure backend is running on http://localhost:5000
- Check VITE_API_URL in frontend/.env
- Clear browser cache

### ❌ CORS errors
**Solution**:
- Verify FRONTEND_URL in backend/.env matches your frontend URL
- Make sure both servers are running

## Next Steps

### Customize the Application
1. Change default passwords in MongoDB
2. Update branding/colors in frontend
3. Configure additional user roles
4. Add custom fields to member profiles

### Deploy to Production
See detailed guides:
- **Backend**: `smcf-sacco-backend/DEPLOYMENT.md`
- **Deployment Checklist**: `smcf-sacco-backend/DEPLOYMENT_CHECKLIST.md`

### Explore API
- Import Postman collection: `smcf-sacco-backend/postman_collection.json`
- Read API docs: `smcf-sacco-backend/API_DOCUMENTATION.md`

## Terminal Windows Summary

You should have **3 terminal windows** open:

1. **Backend Server** → `smcf-sacco-backend` → Running `npm run dev`
2. **Frontend Server** → `smcf-sacco` → Running `npm run dev`
3. **Free terminal** → For running commands, testing, etc.

## Stopping the Application

Press `Ctrl + C` in each terminal window to stop the servers.

## Development Workflow

```powershell
# Start both servers (do this in 2 terminals)
cd "d:\SMCF SACCO\smcf-sacco-backend"
npm run dev

cd "d:\SMCF SACCO\smcf-sacco"
npm run dev
```

Now you can:
- Edit backend code → Auto-reloads
- Edit frontend code → Auto-reloads
- Make API changes → Test immediately
- Create new features → See results instantly

## Testing Different User Roles

### Admin User
- Email: admin@smcfsacco.com
- Password: admin123
- Access: Everything

### Credit Officer
- Email: officer@smcfsacco.com
- Password: officer123
- Access: Members, Loans, Transactions

### Treasurer
- Email: treasurer@smcfsacco.com
- Password: treasurer123
- Access: Financial operations

## Project Structure Reference

```
SMCF SACCO/
├── smcf-sacco/              # Frontend (React)
│   ├── src/
│   ├── .env                 # Frontend config
│   └── package.json
│
└── smcf-sacco-backend/      # Backend (Node.js)
    ├── src/
    │   ├── models/          # Database schemas
    │   ├── routes/          # API endpoints
    │   └── middleware/      # Auth, logging
    ├── .env                 # Backend config
    └── package.json
```

## Useful Commands

```powershell
# Backend
cd "d:\SMCF SACCO\smcf-sacco-backend"
npm run dev         # Start development server
npm run build       # Build for production
npm start          # Start production server
npm run seed       # Seed database with initial data

# Frontend
cd "d:\SMCF SACCO\smcf-sacco"
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Check code quality
```

## Getting Help

- **Backend API Docs**: `smcf-sacco-backend/API_DOCUMENTATION.md`
- **Frontend Integration**: `smcf-sacco-backend/FRONTEND_INTEGRATION.md`
- **Deployment Guide**: `smcf-sacco-backend/DEPLOYMENT.md`
- **Main README**: `README.md`

## Security Reminders

🔒 **Before going to production**:
- [ ] Change all default passwords
- [ ] Generate new JWT_SECRET
- [ ] Use environment-specific database credentials
- [ ] Enable MongoDB Atlas IP whitelist (remove 0.0.0.0/0)
- [ ] Set NODE_ENV=production
- [ ] Use HTTPS for all connections
- [ ] Review and test all security features

---

**🎉 Congratulations!** You now have a fully functional SACCO management system running locally!

**Estimated total setup time**: 10-15 minutes

For production deployment, follow the detailed guides in the `smcf-sacco-backend` folder.
