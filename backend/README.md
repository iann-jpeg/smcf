# SMCF Custom Backend

This is the custom backend for the SMCF (Smart Moves Cash Flow) platform, replacing Supabase with a self-hosted solution.

## Features

- **Custom Authentication**: OTP-based login system
- **Admin-Controlled Registration**: Members can only login after being registered by an admin
- **Real-time Updates**: Socket.IO for live notifications
- **MongoDB Database**: Flexible document storage
- **RESTful API**: Clean and organized endpoints
- **Role-Based Access**: Admin and member roles with different permissions

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: A secure random string
- `ADMIN_PHONE`: Primary admin phone number

### 3. Install and Start MongoDB

**Option A: Local MongoDB**

```bash
# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# macOS
brew install mongodb-community
brew services start mongodb-community
```

**Option B: MongoDB Atlas (Cloud)**

1. Create free account at mongodb.com/atlas
2. Create a cluster
3. Get connection string and add to `.env`

### 4. Create Initial Admin

Run the server and make a POST request to create the first admin:

```bash
npm run dev
```

Then use curl or Postman:

```bash
curl -X POST http://localhost:4000/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin Name",
    "phone": "254759097157",
    "password": "secure-password"
  }'
```

### 5. Start the Server

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/send-otp` - Send OTP to phone number
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/setup-admin` - Create initial admin (one-time)

### Members (Admin only)

- `GET /api/members` - Get all members
- `GET /api/members/:id` - Get single member
- `POST /api/members` - Register new member (admin creates account)
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member
- `POST /api/members/reorder` - Reorder members

### Payments

- `GET /api/payments` - Get all payments
- `POST /api/payments` - Record payment (admin)
- `POST /api/payments/mpesa-callback` - M-Pesa webhook

### Announcements

- `GET /api/announcements` - Get all announcements
- `POST /api/announcements` - Create announcement (admin)
- `DELETE /api/announcements/:id` - Delete announcement

### Loans

- `GET /api/loans` - Get all loans
- `POST /api/loans/request` - Request loan (member)
- `PUT /api/loans/:id/status` - Approve/reject loan (admin)

## Authentication Flow

1. **Admin Registration**:

   - First admin creates account via `/api/auth/setup-admin`
   - Admin can login using OTP

2. **Member Registration** (Admin-controlled):

   - Admin registers member via `POST /api/members`
   - Member details stored with `registered_by_admin: true`
   - Member receives member_id (e.g., SMCF-0001)

3. **Member Login**:
   - Member requests OTP via `/api/auth/send-otp`
   - System checks if member exists and is registered by admin
   - If yes, member can verify OTP and login
   - If no, login is denied with message to contact admin

## Security Features

- JWT tokens for authentication
- OTP verification for login
- Admin-only routes protected by middleware
- Password hashing with bcrypt
- Role-based access control
- Member must be registered by admin before login

## Database Models

- **Admin**: Administrative users with permissions
- **Member**: Group members registered by admin
- **OTP**: One-time passwords for authentication
- **Payment**: Payment records and M-Pesa transactions
- **Announcement**: Admin announcements to members
- **Loan**: Loan requests and approvals

## Socket.IO Events

- `member:new` - Emitted when new member is added
- `announcement:new` - Emitted when new announcement is created
- `payment:new` - Emitted when new payment is recorded

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a secure `JWT_SECRET`
3. Set up proper MongoDB credentials
4. Configure M-Pesa credentials for live payments
5. Integrate SMS gateway for OTP delivery
6. Use HTTPS/SSL certificates
7. Set up proper logging and monitoring

## Support

For issues or questions, contact the development team.
