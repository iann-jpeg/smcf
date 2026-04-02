# SMCF SACCO Backend API

Backend API for SMCF SACCO Management System built with Node.js, Express, TypeScript, and MongoDB.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Member Management**: Complete CRUD operations for member records
- **Loan Management**: Loan applications, approvals, disbursements, and tracking
- **Transaction Processing**: Handle deposits, withdrawals, loan repayments
- **Notifications**: Real-time notification system
- **Dashboard Analytics**: Statistics and growth metrics
- **Audit Logging**: Track all critical operations
- **Security**: Helmet, rate limiting, input validation

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB Atlas
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting

## Setup

### Prerequisites

- Node.js 18 or higher
- MongoDB Atlas account
- npm or yarn

### Installation

1. Clone the repository and navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smcf-sacco
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

### Running the Application

Development mode with hot reload:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Members
- `GET /api/members` - Get all members
- `GET /api/members/:id` - Get single member
- `POST /api/members` - Create member (Staff only)
- `PUT /api/members/:id` - Update member (Staff only)
- `DELETE /api/members/:id` - Delete member (Admin only)
- `PUT /api/members/:id/verify-kyc` - Verify KYC (Staff only)

### Loans
- `GET /api/loans` - Get all loans
- `GET /api/loans/:id` - Get single loan
- `POST /api/loans` - Apply for loan
- `PUT /api/loans/:id/approve` - Approve loan (Staff only)
- `PUT /api/loans/:id/reject` - Reject loan (Staff only)
- `PUT /api/loans/:id/disburse` - Disburse loan (Treasurer only)

### Transactions
- `GET /api/transactions` - Get all transactions
- `GET /api/transactions/:id` - Get single transaction
- `POST /api/transactions` - Create transaction (Staff only)
- `PUT /api/transactions/:id` - Update transaction (Staff only)

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Dashboard
- `GET /api/dashboard/stats` - Get statistics (Staff only)
- `GET /api/dashboard/growth` - Get growth metrics (Staff only)

## User Roles

- `admin` - Full system access
- `credit_officer` - Loan management, member management
- `credit_committee` - Loan approvals
- `treasurer` - Financial transactions, loan disbursements
- `auditor` - Read-only access to all data
- `member` - Personal account access

## Deployment to Render

1. Push code to GitHub repository

2. Create new Web Service on Render:
   - Connect your GitHub repository
   - Select the backend folder
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

3. Add Environment Variables in Render dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRE`
   - `FRONTEND_URL`
   - `NODE_ENV=production`

4. Deploy!

## MongoDB Atlas Setup

1. Create a cluster on MongoDB Atlas
2. Create a database user
3. Whitelist Render's IP addresses (or use 0.0.0.0/0 for all)
4. Get connection string and add to `.env`

## Security Best Practices

- Always use strong JWT secrets in production
- Enable MongoDB Atlas IP whitelisting
- Use HTTPS in production
- Set appropriate CORS origins
- Regularly update dependencies
- Monitor rate limiting logs
- Review audit logs regularly

## License

MIT
