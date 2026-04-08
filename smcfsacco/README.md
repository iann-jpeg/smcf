# SMCF SACCO Management System

A complete SACCO (Savings and Credit Cooperative) management system with separate frontend and backend.

## Project Structure

```
SMCF SACCO/
├── smcf-sacco/              # React Frontend Application
│   ├── src/                 # React components, hooks, pages
│   ├── public/              # Static assets
│   ├── package.json         # Frontend dependencies
│   └── README.md            # Frontend documentation
│
└── smcf-sacco-backend/      # Node.js/Express Backend API
    ├── src/                 # TypeScript source code
    │   ├── models/          # MongoDB schemas (12 models)
    │   ├── routes/          # API endpoints
    │   ├── middleware/      # Auth, logging, error handling
    │   └── config/          # Database configuration
    ├── package.json         # Backend dependencies
    ├── .env.example         # Environment variables template
    ├── README.md            # Backend documentation
    ├── API_DOCUMENTATION.md # Complete API reference
    └── DEPLOYMENT.md        # Deployment guide
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Build Tool**: Vite
- **UI Components**: Shadcn/ui

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB Atlas
- **Authentication**: JWT
- **Security**: Helmet, CORS, Rate Limiting

## Quick Start

### Prerequisites
- Node.js 18 or higher
- MongoDB Atlas account (free tier available)
- npm or yarn package manager

### 1. Backend Setup

```bash
# Navigate to backend
cd smcf-sacco-backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your MongoDB Atlas URI and JWT secret
# Generate JWT secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Build TypeScript
npm run build

# Start development server
npm run dev
```

Backend will be available at `http://localhost:5000`

**Optional**: Seed initial data (admin users and sample members)
```bash
npm run seed
```

Default credentials after seeding:
- Admin: admin@smcfsacco.com / admin123
- Credit Officer: officer@smcfsacco.com / officer123
- Treasurer: treasurer@smcfsacco.com / treasurer123

### 2. Frontend Setup

```bash
# Navigate to frontend (in a new terminal)
cd smcf-sacco

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:5000/api" > .env

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:5173`

### 3. Access the Application

1. Open http://localhost:5173 in your browser
2. Register a new account or login with seeded credentials
3. Explore the SACCO management features

## Features

### Member Management
- Register and manage member accounts
- KYC verification workflow
- Track savings, shares, and loan balances
- Member profiles with complete history

### Loan Management
- Apply for loans with customizable terms
- Multi-level approval workflow
- Guarantor system
- Loan disbursement tracking
- Repayment schedules
- Risk scoring and assessment

### Financial Transactions
- Deposits and withdrawals
- Share purchases
- Loan repayments
- Transaction history
- Dividend distributions

### Dashboard & Analytics
- Real-time statistics
- Growth metrics
- Member analytics
- Loan portfolio overview
- Financial summaries

### Notifications
- System notifications
- Loan status updates
- Payment reminders
- Custom alerts

### Security & Compliance
- Role-based access control (6 user roles)
- Audit logging of all operations
- Secure authentication with JWT
- Data encryption
- Rate limiting

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management |
| **Credit Officer** | Manage members, loans, transactions |
| **Credit Committee** | Review and approve loan applications |
| **Treasurer** | Financial transactions, loan disbursements |
| **Auditor** | Read-only access to all data and audit logs |
| **Member** | Personal account access, loan applications |

## API Endpoints

For complete API documentation, see `smcf-sacco-backend/API_DOCUMENTATION.md`

Base URL: `http://localhost:5000/api`

**Authentication**
- POST `/auth/register` - Register new user
- POST `/auth/login` - Login user
- GET `/auth/me` - Get current user
- PUT `/auth/change-password` - Change password

**Members**
- GET `/members` - List all members
- POST `/members` - Create member
- GET `/members/:id` - Get member details
- PUT `/members/:id` - Update member
- PUT `/members/:id/verify-kyc` - Verify KYC

**Loans**
- GET `/loans` - List all loans
- POST `/loans` - Apply for loan
- PUT `/loans/:id/approve` - Approve loan
- PUT `/loans/:id/reject` - Reject loan
- PUT `/loans/:id/disburse` - Disburse loan

**Transactions**
- GET `/transactions` - List transactions
- POST `/transactions` - Create transaction

**Notifications**
- GET `/notifications` - Get user notifications
- PUT `/notifications/:id/read` - Mark as read

**Dashboard**
- GET `/dashboard/stats` - System statistics
- GET `/dashboard/growth` - Growth metrics

## Development

### Running Both Servers Concurrently

**Option 1**: Use two terminal windows
```bash
# Terminal 1 - Backend
cd smcf-sacco-backend
npm run dev

# Terminal 2 - Frontend
cd smcf-sacco
npm run dev
```

**Option 2**: Use npm-run-all (coming soon)

### Environment Variables

#### Backend (.env)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smcf-sacco
JWT_SECRET=your-secret-key-min-32-characters
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## Deployment

### Backend Deployment (Render)

1. **Prepare MongoDB Atlas**
   - Create cluster and database user
   - Whitelist IP addresses (0.0.0.0/0 for Render)
   - Get connection string

2. **Deploy to Render**
   - Connect GitHub repository
   - Select `smcf-sacco-backend` folder
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add environment variables

See `smcf-sacco-backend/DEPLOYMENT.md` for detailed instructions.

### Frontend Deployment (Vercel/Netlify)

1. **Update Environment**
   ```env
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```

2. **Build and Deploy**
   ```bash
   npm run build
   # Deploy dist/ folder
   ```

## Testing

### Test Backend API

Import Postman collection: `smcf-sacco-backend/postman_collection.json`

Or use curl:
```bash
# Health check
curl http://localhost:5000/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smcfsacco.com","password":"admin123"}'
```

### Frontend Testing
```bash
cd smcf-sacco
npm run test
```

## Documentation

- **Backend README**: `smcf-sacco-backend/README.md`
- **API Documentation**: `smcf-sacco-backend/API_DOCUMENTATION.md`
- **Deployment Guide**: `smcf-sacco-backend/DEPLOYMENT.md`
- **Frontend Integration**: `smcf-sacco-backend/FRONTEND_INTEGRATION.md`
- **Deployment Checklist**: `smcf-sacco-backend/DEPLOYMENT_CHECKLIST.md`

## Database Schema

### Main Collections

1. **users** - User accounts and authentication
2. **members** - SACCO member profiles
3. **loans** - Loan applications and tracking
4. **loan_guarantors** - Loan guarantor relationships
5. **loan_approvals** - Loan approval workflow
6. **transactions** - Financial transactions
7. **repayment_records** - Loan repayment schedules
8. **notifications** - User notifications
9. **audit_logs** - System audit trail
10. **savings_history** - Member savings over time
11. **simulation_history** - Loan simulation history
12. **simulation_presets** - Saved loan simulation scenarios

## Contributing

### Setting Up Development Environment

1. Clone the repository
2. Follow the Quick Start guide above
3. Create a feature branch
4. Make your changes
5. Test thoroughly
6. Submit a pull request

### Code Style

- TypeScript for all new code
- Follow existing patterns
- Add comments for complex logic
- Update documentation as needed

## Troubleshooting

### Backend Issues

**Cannot connect to MongoDB**
- Verify MongoDB Atlas connection string
- Check network access whitelist
- Ensure database user credentials are correct

**Port already in use**
- Change PORT in backend/.env
- Kill process on port 5000: `npx kill-port 5000`

### Frontend Issues

**API connection failed**
- Verify backend is running on http://localhost:5000
- Check VITE_API_URL in .env
- Check CORS configuration in backend

**Build errors**
- Delete node_modules and reinstall
- Clear vite cache: `npm run build -- --force`

### CORS Errors

Ensure backend .env has correct FRONTEND_URL:
```env
FRONTEND_URL=http://localhost:5173
```

## Security Notes

⚠️ **Important**: Before deploying to production:

1. Generate strong JWT secret (32+ characters)
2. Use environment-specific MongoDB credentials
3. Enable MongoDB Atlas IP whitelist
4. Use HTTPS for all connections
5. Regularly update dependencies
6. Monitor audit logs
7. Set appropriate rate limits

## Performance Optimization

- Backend uses connection pooling
- Database indexes on frequently queried fields
- Response compression enabled
- Rate limiting to prevent abuse
- Efficient query patterns

## Support & Resources

- **MongoDB Atlas**: https://cloud.mongodb.com
- **Render**: https://render.com
- **React Documentation**: https://react.dev
- **Express.js**: https://expressjs.com

## License

MIT

## Version

**Current Version**: 1.0.0  
**Last Updated**: February 28, 2026

---

## Project Status

✅ Backend API - Complete  
✅ Frontend Application - Complete  
✅ Authentication - Complete  
✅ Member Management - Complete  
✅ Loan Management - Complete  
✅ Transaction System - Complete  
✅ Notifications - Complete  
✅ Dashboard - Complete  
✅ Audit Logging - Complete  
⏳ Real-time Updates - Planned  
⏳ Mobile App - Planned  

---

**Ready for deployment!** 🚀

For deployment instructions, see:
- Backend: `smcf-sacco-backend/DEPLOYMENT.md`
- Frontend: Contact your deployment platform docs (Vercel/Netlify)
