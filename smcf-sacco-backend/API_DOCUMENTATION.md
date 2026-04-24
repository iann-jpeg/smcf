# API Documentation

Base URL: `http://localhost:5000/api`  
Production URL: `https://your-app.onrender.com/api`

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {},
  "count": 0  // For list endpoints
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": []  // Validation errors if any
}
```

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Create a new user account.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "fullName": "John Doe",
      "roles": ["member"]
    }
  }
}
```

---

### Login
**POST** `/auth/login`

Authenticate and get JWT token.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "fullName": "John Doe",
      "roles": ["member"]
    }
  }
}
```

---

### Get Current User
**GET** `/auth/me`

Get currently authenticated user details.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "roles": ["member"],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### Update Profile
**PUT** `/auth/update`

Update user profile information.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "fullName": "John Smith",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Response:** `200 OK`

---

### Change Password
**PUT** `/auth/change-password`

Change user password.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response:** `200 OK`

---

## Member Endpoints

### Get All Members
**GET** `/members`

Get list of all members.

**Headers:** `Authorization: Bearer <token>`  
**Access:** All authenticated users

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "member-id",
      "memberId": "MEM2024001",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+254712345678",
      "status": "active",
      "savings": 50000,
      "shares": 10000,
      "loanBalance": 0,
      "kycVerified": true,
      "joinDate": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Single Member
**GET** `/members/:id`

Get details of a specific member.

**Headers:** `Authorization: Bearer <token>`  
**Access:** All authenticated users

**Response:** `200 OK`

---

### Create Member
**POST** `/members`

Create a new member.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Credit Officer, Treasurer

**Body:**
```json
{
  "memberId": "MEM2024001",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+254712345678",
  "joinDate": "2024-01-01",
  "savings": 0,
  "shares": 0
}
```

**Response:** `201 Created`

---

### Update Member
**PUT** `/members/:id`

Update member information.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Credit Officer, Treasurer

**Body:**
```json
{
  "name": "John Smith",
  "phone": "+254723456789",
  "status": "active"
}
```

**Response:** `200 OK`

---

### Delete Member
**DELETE** `/members/:id`

Delete a member.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin only

**Response:** `200 OK`

---

### Verify KYC
**PUT** `/members/:id/verify-kyc`

Verify member's KYC status.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Credit Officer

**Response:** `200 OK`

---

## Loan Endpoints

### Get All Loans
**GET** `/loans`

Get list of all loans with optional filters.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected, disbursed, active, completed)
- `memberId` (optional): Filter by member ID

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "loan-id",
      "loanNumber": "LN2024001",
      "memberId": {
        "name": "John Doe",
        "memberId": "MEM2024001"
      },
      "principal": 100000,
      "interestRate": 12,
      "termMonths": 12,
      "monthlyInstallment": 8885,
      "totalPayable": 106620,
      "balance": 106620,
      "status": "pending",
      "appliedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Single Loan
**GET** `/loans/:id`

Get details of a specific loan including guarantors.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "loan-id",
    "loanNumber": "LN2024001",
    "memberId": {...},
    "principal": 100000,
    "guarantors": [
      {
        "memberId": {...},
        "guaranteeAmount": 50000
      }
    ]
  }
}
```

---

### Apply for Loan
**POST** `/loans`

Submit a new loan application.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "memberId": "member-id",
  "principal": 100000,
  "interestRate": 12,
  "termMonths": 12,
  "guarantors": [
    {
      "memberId": "guarantor-member-id",
      "guaranteeAmount": 50000
    }
  ]
}
```

**Response:** `201 Created`

---

### Approve Loan
**PUT** `/loans/:id/approve`

Approve a pending loan application.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Credit Officer, Credit Committee

**Response:** `200 OK`

---

### Reject Loan
**PUT** `/loans/:id/reject`

Reject a loan application.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Credit Officer, Credit Committee

**Body:**
```json
{
  "reason": "Insufficient guarantors"
}
```

**Response:** `200 OK`

---

### Disburse Loan
**PUT** `/loans/:id/disburse`

Disburse an approved loan.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Treasurer

**Response:** `200 OK`

---

## Transaction Endpoints

### Get All Transactions
**GET** `/transactions`

Get list of transactions with optional filters.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `memberId` (optional): Filter by member
- `type` (optional): Filter by type
- `status` (optional): Filter by status
- `limit` (optional): Limit results (default: 50)

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "transaction-id",
      "transactionRef": "TXN20240001",
      "memberId": {...},
      "type": "deposit",
      "amount": 10000,
      "status": "completed",
      "processedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Single Transaction
**GET** `/transactions/:id`

Get details of a specific transaction.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

### Create Transaction
**POST** `/transactions`

Create a new transaction.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Treasurer, Credit Officer

**Body:**
```json
{
  "memberId": "member-id",
  "type": "deposit",
  "amount": 10000,
  "description": "Monthly savings"
}
```

**Types:** `deposit`, `withdrawal`, `loan_disbursement`, `loan_repayment`, `share_purchase`, `dividend`

**Response:** `201 Created`

---

### Update Transaction
**PUT** `/transactions/:id`

Update transaction status.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Admin, Treasurer

**Body:**
```json
{
  "status": "completed"
}
```

**Response:** `200 OK`

---

## Notification Endpoints

### Get Notifications
**GET** `/notifications`

Get current user's notifications.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 5,
  "unreadCount": 2,
  "data": [
    {
      "_id": "notification-id",
      "title": "Loan Approved",
      "message": "Your loan application has been approved",
      "type": "info",
      "link": "/loans/loan-id",
      "read": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Create Notification
**POST** `/notifications`

Create a new notification.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "userId": "user-id",
  "title": "Important Alert",
  "message": "This is a notification message",
  "type": "info",
  "link": "/path"
}
```

**Response:** `201 Created`

---

### Mark as Read
**PUT** `/notifications/:id/read`

Mark a notification as read.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

### Mark All as Read
**PUT** `/notifications/mark-all-read`

Mark all user's notifications as read.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

### Delete Notification
**DELETE** `/notifications/:id`

Delete a notification.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

---

## Dashboard Endpoints

### Get Statistics
**GET** `/dashboard/stats`

Get overall system statistics.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Staff only (Admin, Credit Officer, Treasurer, Credit Committee, Auditor)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalMembers": 150,
    "totalSavings": 5000000,
    "totalShares": 1000000,
    "activeLoans": 45,
    "totalLoanBalance": 8000000,
    "pendingLoans": 5,
    "recentTransactions": [...]
  }
}
```

---

### Get Growth Metrics
**GET** `/dashboard/growth`

Get growth statistics over time.

**Headers:** `Authorization: Bearer <token>`  
**Access:** Staff only

**Query Parameters:**
- `months` (optional): Number of months to look back (default: 6)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "memberGrowth": [
      {
        "_id": { "year": 2024, "month": 1 },
        "count": 20
      }
    ],
    "loanGrowth": [
      {
        "_id": { "year": 2024, "month": 1 },
        "count": 15,
        "totalAmount": 1500000
      }
    ]
  }
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

- Window: 15 minutes
- Max Requests: 100 per window
- Response when exceeded: `429 Too Many Requests`

---

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| `admin` | Full system access |
| `credit_officer` | Manage members, loans, transactions |
| `credit_committee` | Approve/reject loans |
| `treasurer` | Financial transactions, loan disbursements |
| `auditor` | Read-only access to all data |
| `member` | View own account, apply for loans |
