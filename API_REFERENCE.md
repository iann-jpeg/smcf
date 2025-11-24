# SMCF API Quick Reference

Base URL: `http://localhost:4000` (development) or your production URL

## Authentication

All protected endpoints require a JWT token in the header:

```
Authorization: Bearer <your_jwt_token>
```

### Send OTP

```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "phone": "254759097157"
}
```

Response:

```json
{
  "success": true,
  "message": "OTP sent to 254759097157",
  "otp": "123456" // Only in development mode
}
```

### Verify OTP & Login

```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phone": "254759097157",
  "otp": "123456"
}
```

Response (Admin):

```json
{
  "success": true,
  "role": "admin",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Admin Name",
    "phone": "254759097157",
    "role": "admin",
    "permissions": {
      "canAddMembers": true,
      "canEditMembers": true,
      "canDeleteMembers": true,
      "canDisburseFunds": true,
      "canApproveLoans": true,
      "canViewReports": true
    }
  }
}
```

Response (Member):

```json
{
  "success": true,
  "role": "member",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439012",
    "name": "John Doe",
    "phone": "254712345678",
    "member_id": "SMCF-0001",
    "status": "active",
    "position": 1
  }
}
```

### Setup Initial Admin (One-time)

```http
POST /api/auth/setup-admin
Content-Type: application/json

{
  "name": "Admin Name",
  "phone": "254759097157",
  "password": "SecurePassword123"
}
```

## Members (Admin Only)

### Get All Members

```http
GET /api/members
Authorization: Bearer <admin_token>
```

Response:

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "member_id": "SMCF-0001",
    "name": "John Doe",
    "phone": "254712345678",
    "id_number": "12345678",
    "status": "active",
    "payment_status": "paid",
    "position": 1,
    "monthly_contribution": 204,
    "join_date": "2024-01-15T00:00:00.000Z",
    "registered_by_admin": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-20T15:45:00.000Z"
  }
]
```

### Get Single Member

```http
GET /api/members/:id
Authorization: Bearer <token>
```

### Create Member (Admin Registers Member)

```http
POST /api/members
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Jane Smith",
  "phone": "254723456789",
  "id_number": "23456789",
  "position": 2
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "member_id": "SMCF-0002",
    "name": "Jane Smith",
    "phone": "254723456789",
    "id_number": "23456789",
    "position": 2,
    "status": "active",
    "payment_status": "pending",
    "registered_by_admin": true,
    "created_at": "2024-01-20T10:00:00.000Z"
  }
}
```

### Update Member

```http
PUT /api/members/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Jane Updated",
  "payment_status": "paid"
}
```

### Delete Member

```http
DELETE /api/members/:id
Authorization: Bearer <admin_token>
```

### Reorder Members

```http
POST /api/members/reorder
Authorization: Bearer <admin_token>
Content-Type: application/json

[
  { "id": "507f1f77bcf86cd799439011", "position": 2 },
  { "id": "507f1f77bcf86cd799439012", "position": 1 }
]
```

## Payments

### Get All Payments

```http
GET /api/payments
Authorization: Bearer <token>
```

Response:

```json
[
  {
    "_id": "507f1f77bcf86cd799439020",
    "member_id": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "phone": "254712345678",
      "member_id": "SMCF-0001"
    },
    "amount": 204,
    "phone": "254712345678",
    "mpesa_transaction_id": "QAA12345XYZ",
    "payment_method": "mpesa",
    "status": "completed",
    "cycle_number": 15,
    "date": "2024-01-20T14:30:00.000Z"
  }
]
```

### Record Payment (Admin)

```http
POST /api/payments
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "member_id": "507f1f77bcf86cd799439011",
  "amount": 204,
  "phone": "254712345678",
  "mpesa_transaction_id": "QAA12345XYZ",
  "payment_method": "mpesa",
  "cycle_number": 15
}
```

## Announcements

### Get All Announcements

```http
GET /api/announcements
Authorization: Bearer <token>
```

Response:

```json
[
  {
    "_id": "507f1f77bcf86cd799439030",
    "title": "Important Meeting",
    "message": "Group meeting on Friday at 5 PM",
    "priority": "high",
    "created_by": {
      "_id": "507f1f77bcf86cd799439010",
      "name": "Admin Name",
      "role": "admin"
    },
    "created_at": "2024-01-20T09:00:00.000Z"
  }
]
```

### Create Announcement (Admin)

```http
POST /api/announcements
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "Payment Reminder",
  "message": "Please make your payments by Friday",
  "priority": "medium"
}
```

### Delete Announcement (Admin)

```http
DELETE /api/announcements/:id
Authorization: Bearer <admin_token>
```

## Loans

### Get All Loans

```http
GET /api/loans
Authorization: Bearer <token>
```

Response:

```json
[
  {
    "_id": "507f1f77bcf86cd799439040",
    "member_id": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "phone": "254712345678",
      "member_id": "SMCF-0001"
    },
    "amount": 5000,
    "purpose": "Emergency medical expenses",
    "status": "pending",
    "interest_rate": 5,
    "total_repayable": 5250,
    "created_at": "2024-01-20T10:00:00.000Z"
  }
]
```

### Request Loan (Member)

```http
POST /api/loans/request
Authorization: Bearer <member_token>
Content-Type: application/json

{
  "amount": 5000,
  "purpose": "Emergency medical expenses",
  "interest_rate": 5
}
```

### Update Loan Status (Admin)

```http
PUT /api/loans/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "approved"  // or "rejected", "disbursed", "repaid"
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP Status Codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no token or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Socket.IO Events

Connect to Socket.IO:

```javascript
import io from "socket.io-client";
const socket = io("http://localhost:4000");
```

### Listen for Events

**New Member Added:**

```javascript
socket.on("member:new", (member) => {
  console.log("New member:", member);
});
```

**New Announcement:**

```javascript
socket.on("announcement:new", (announcement) => {
  console.log("New announcement:", announcement);
});
```

**New Payment:**

```javascript
socket.on("payment:new", (payment) => {
  console.log("New payment:", payment);
});
```

## Testing with cURL

### Login as Admin

```bash
# Send OTP
curl -X POST http://localhost:4000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"254759097157"}'

# Verify OTP (get OTP from backend console)
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"254759097157","otp":"123456"}'

# Save the returned token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Add a Member

```bash
curl -X POST http://localhost:4000/api/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Member",
    "phone": "254712345678",
    "id_number": "12345678"
  }'
```

### Get All Members

```bash
curl http://localhost:4000/api/members \
  -H "Authorization: Bearer $TOKEN"
```

## Postman Collection

Import this into Postman for easier testing:

1. Create new collection "SMCF API"
2. Set base URL variable: `{{baseUrl}}` = `http://localhost:4000`
3. Set auth token variable: `{{token}}` = your JWT token
4. Add requests from above examples

## Rate Limiting

Currently no rate limiting in place. For production, implement:

- OTP requests: 3 per hour per phone number
- Login attempts: 5 per hour per phone number
- API requests: 100 per minute per token
