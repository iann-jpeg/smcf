# SMCF - Smart Moves Cash Flow Platform

A digital table banking platform for managing group contributions, payments, and disbursements with M-Pesa integration.

## 🚀 Features

- **Custom Authentication**: OTP-based login system
- **Admin-Controlled Registration**: Members must be registered by admin before they can login
- **Real-time Updates**: Socket.IO powered live notifications
- **Payment Tracking**: Monitor contributions and payment status
- **Loan Management**: Request and approve loans
- **Announcements**: Broadcast messages to all members
- **M-Pesa Integration**: Ready for M-Pesa payment integration
- **Role-Based Access**: Admin and member roles with different permissions

## 📋 Architecture

### Frontend
- React 18 + TypeScript
- Vite for build tooling
- TailwindCSS + shadcn/ui components
- Socket.IO client for real-time updates
- React Router for navigation

### Backend
- Node.js + Express
- MongoDB for data storage
- JWT authentication
- Socket.IO for real-time communication
- RESTful API design

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Easy Setup (Recommended)

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd smcf
```

2. **Run the startup script**
```bash
./start.sh
```

This will:
- Check and start MongoDB
- Install dependencies for both frontend and backend
- Create environment files from examples
- Start both servers

3. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- API Docs: http://localhost:4000/

### Manual Setup

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions.

## 📖 Documentation

- **[Complete Setup Guide](./SETUP_GUIDE.md)** - Detailed setup and deployment instructions
- **[Backend API Documentation](./backend/README.md)** - API endpoints and usage
- **[Authentication Flow](#authentication-flow)** - How authentication works

## 🔐 Authentication Flow

### Admin Registration & Login
1. Create initial admin account via `/api/auth/setup-admin`
2. Admin logs in using OTP verification
3. Admin has full access to platform features

### Member Registration & Login (Admin-Controlled)
1. **Admin registers member** via admin dashboard
   - Admin adds member's name, phone, and ID number
   - System creates member account with `registered_by_admin: true`
   - Member receives unique member ID (e.g., SMCF-0001)

2. **Member attempts login**
   - Member enters phone number
   - Requests OTP
   - System checks if member exists and was registered by admin
   - If yes: OTP is sent and member can login
   - If no: Login denied with message to contact admin

3. **Member access**
   - Once logged in, member can view dashboard, payments, and announcements
   - Member can request loans
   - Member cannot access admin functions

## 🎯 Key Concepts

### Admin-Controlled Registration
- **Members cannot self-register** - This is intentional for security
- Only admin can create new member accounts
- This ensures all members are vetted before joining
- Admin sets initial member details and position

### Payment Cycle
- Fixed contribution of KES 204 every 5 days
- Admin tracks payment status (paid/pending)
- Automated reminders for pending payments
- Members receive funds in their assigned position

## 🚦 Development

### Start Development Servers

**Both servers:**
```bash
./start.sh
```

**Backend only:**
```bash
cd backend
npm run dev
```

**Frontend only:**
```bash
npm run dev
```

### Stop Servers
```bash
./stop.sh
```

### Project Structure
```
smcf/
├── backend/                 # Node.js/Express backend
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── middleware/         # Auth & other middleware
│   └── server.js           # Main server file
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── lib/                # Utilities and API client
│   └── integrations/       # (Removed - was Supabase)
├── start.sh                # Startup script
├── stop.sh                 # Stop script
└── SETUP_GUIDE.md         # Detailed setup guide
```

## 🔧 Configuration

### Backend Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/smcf
PORT=4000
JWT_SECRET=your-secret-key
ADMIN_PHONE=254759097157
```

### Frontend Environment Variables
```env
VITE_API_URL=http://localhost:4000
```

## 📱 API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/setup-admin` - Create initial admin

### Members (Admin only)
- `GET /api/members` - Get all members
- `POST /api/members` - Register new member
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member
- `POST /api/members/reorder` - Reorder members

### Payments
- `GET /api/payments` - Get payment history
- `POST /api/payments` - Record payment

### Announcements
- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement

### Loans
- `GET /api/loans` - Get all loans
- `POST /api/loans/request` - Request loan
- `PUT /api/loans/:id/status` - Update loan status

## 🚀 Deployment

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for production deployment instructions including:
- Server setup (Ubuntu/VPS)
- MongoDB configuration
- Nginx reverse proxy
- SSL certificates
- PM2 process management
- SMS gateway integration

## 🔒 Security Features

- JWT token authentication
- OTP verification for login
- Admin-controlled member registration
- Role-based access control
- Password hashing with bcrypt
- Protected API endpoints
- CORS configuration

## 🤝 Contributing

This is a proprietary project. For access or contributions, please contact the development team.

## 📄 License

Proprietary - SMCF Platform

## 🆘 Support

For issues or questions:
- Check the [Setup Guide](./SETUP_GUIDE.md)
- Review API documentation in `backend/README.md`
- Check server logs: `tail -f backend.log` or `tail -f frontend.log`

## 🎉 Credits

Built with ❤️ for the SMCF community
