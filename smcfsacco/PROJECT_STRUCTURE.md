# SMCF SACCO Project Structure

Complete file structure reference for the SMCF SACCO Management System.

## Root Directory

```
d:\SMCF SACCO/
├── README.md                    # Main project documentation
├── QUICK_START.md              # 10-minute setup guide
├── .gitignore                  # Git ignore rules
│
├── smcf-sacco/                 # Frontend Application (React)
└── smcf-sacco-backend/         # Backend API (Node.js/Express)
```

---

## Frontend: smcf-sacco/

### Configuration Files
```
smcf-sacco/
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── tsconfig.app.json          # TypeScript app config
├── tsconfig.node.json         # TypeScript node config
├── vite.config.ts             # Vite build configuration
├── vitest.config.ts           # Vitest test configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
├── eslint.config.js           # ESLint rules
├── components.json            # Shadcn/ui components config
├── index.html                 # HTML entry point
├── .env                       # Environment variables (create this)
└── README.md                  # Frontend documentation
```

### Source Code
```
src/
├── main.tsx                   # React app entry point
├── App.tsx                    # Main app component
├── App.css                    # App-level styles
├── index.css                  # Global styles
├── vite-env.d.ts              # Vite types
│
├── components/                # React Components
│   ├── AppSidebar.tsx         # Navigation sidebar
│   ├── DashboardLayout.tsx    # Layout wrapper
│   ├── NavLink.tsx            # Navigation link component
│   ├── NotificationBell.tsx   # Notification indicator
│   ├── StatCard.tsx           # Statistics card
│   ├── TrustScoreCard.tsx     # Trust score display
│   ├── GrowthDashboardTab.tsx # Growth analytics tab
│   ├── GrowthInsightsPopup.tsx# Growth insights modal
│   ├── GuarantorVisibility.tsx# Guarantor visibility control
│   ├── LoanSafetyPanel.tsx    # Loan safety metrics
│   │
│   └── ui/                    # Shadcn UI Components
│       ├── accordion.tsx
│       ├── alert.tsx
│       ├── alert-dialog.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── form.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── toast.tsx
│       └── ... (more UI components)
│
├── pages/                     # Page Components
│   ├── Index.tsx              # Landing page
│   ├── Auth.tsx               # Login/Register
│   ├── Dashboard.tsx          # Main dashboard
│   ├── Members.tsx            # Member list
│   ├── MemberDetail.tsx       # Single member view
│   ├── Loans.tsx              # Loan list
│   ├── LoanApplication.tsx    # New loan application
│   ├── LoanApprovals.tsx      # Loan approval workflow
│   ├── LoanSimulator.tsx      # Loan calculator
│   ├── Accounts.tsx           # Account management
│   ├── Transactions.tsx       # Transaction history (implied)
│   ├── Guarantors.tsx         # Guarantor management
│   ├── Reports.tsx            # Report generation
│   ├── Documents.tsx          # Document management
│   ├── Notifications.tsx      # Notification center
│   ├── MyAccount.tsx          # User profile
│   ├── SettingsPage.tsx       # System settings
│   ├── Compliance.tsx         # Compliance monitoring
│   ├── RiskScoring.tsx        # Risk assessment
│   └── NotFound.tsx           # 404 page
│
├── hooks/                     # Custom React Hooks
│   ├── useAuth.tsx            # Authentication state/functions
│   ├── useMembers.ts          # Member data queries
│   ├── useLoans.ts            # Loan data queries
│   ├── useTransactions.ts     # Transaction queries
│   ├── useNotifications.ts    # Notification queries
│   ├── useGuarantors.ts       # Guarantor queries
│   ├── useGuaranteedLoans.ts  # Guaranteed loan queries
│   ├── useAuditLogs.ts        # Audit log queries
│   ├── useDashboardStats.ts   # Dashboard statistics
│   ├── useSimulationHistory.ts# Loan simulation history
│   ├── useSimulationPresets.ts# Loan simulation presets
│   ├── useMyAccount.ts        # Current user account
│   ├── useRealtimeQuery.ts    # Real-time updates
│   ├── use-mobile.tsx         # Mobile detection
│   └── use-toast.ts           # Toast notifications
│
├── lib/                       # Utility Libraries
│   ├── utils.ts               # General utilities (cn, formatters)
│   ├── trust-score.ts         # Trust score calculation
│   ├── risk-engine.ts         # Risk assessment engine
│   ├── loan-safety-engine.ts  # Loan safety calculations
│   ├── growth-intelligence.ts # Growth analytics
│   ├── amortization.ts        # Loan amortization
│   └── pdf-export.ts          # PDF generation
│
├── integrations/              # External Integrations
│   └── supabase/              # Supabase client (deprecated, pending migration)
│       ├── client.ts          # Supabase client configuration
│       └── types.ts           # Database type definitions
│
└── test/                      # Test Files
    ├── setup.ts               # Test setup
    └── example.test.ts        # Example test
```

### Build Output
```
dist/                          # Production build (generated)
node_modules/                  # Dependencies (generated)
```

---

## Backend: smcf-sacco-backend/

### Configuration Files
```
smcf-sacco-backend/
├── package.json               # Backend dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── .env                       # Environment variables (create this)
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── README.md                  # Backend documentation
├── render.yaml                # Render deployment config
└── build.sh                   # Render build script
```

### Source Code
```
src/
├── server.ts                  # Express app entry point
│
├── config/                    # Configuration
│   └── database.ts            # MongoDB connection
│
├── models/                    # MongoDB Schemas (13 models)
│   ├── User.ts                # User accounts & authentication
│   ├── Member.ts              # SACCO member profiles
│   ├── Loan.ts                # Loan applications
│   ├── LoanGuarantor.ts       # Loan guarantor relationships
│   ├── LoanApproval.ts        # Loan approval workflow
│   ├── Transaction.ts         # Financial transactions
│   ├── RepaymentRecord.ts     # Loan repayment schedules
│   ├── Notification.ts        # User notifications
│   ├── AuditLog.ts            # System audit trail
│   ├── SavingsHistory.ts      # Member savings history
│   ├── SimulationHistory.ts   # Loan simulations
│   └── SimulationPreset.ts    # Saved simulation scenarios
│
├── routes/                    # API Routes (6 route files)
│   ├── auth.ts                # POST /register, /login, /change-password
│   ├── members.ts             # CRUD /members, verify KYC
│   ├── loans.ts               # CRUD /loans, approve/reject/disburse
│   ├── transactions.ts        # GET/POST /transactions
│   ├── notifications.ts       # CRUD /notifications
│   └── dashboard.ts           # GET /stats, /growth
│
├── middleware/                # Express Middleware
│   ├── auth.ts                # JWT verification, RBAC authorization
│   ├── errorHandler.ts        # Centralized error handling
│   └── auditLog.ts            # Audit logging
│
└── scripts/                   # Utility Scripts
    └── seedData.ts            # Database seeding
```

### Build Output
```
dist/                          # Compiled JavaScript (generated)
node_modules/                  # Dependencies (generated)
```

### Documentation Files
```
smcf-sacco-backend/
├── API_DOCUMENTATION.md       # Complete API reference
├── DEPLOYMENT.md              # Render & MongoDB Atlas guide
├── DEPLOYMENT_CHECKLIST.md    # Pre/post deployment checks
├── FRONTEND_INTEGRATION.md    # How to update frontend
├── PROJECT_SETUP.md           # Overall project guide
├── postman_collection.json    # Postman API tests
└── ecosystem.config.js        # PM2 configuration
```

---

## Key Files Explained

### Frontend Entry Points
- **index.html** → HTML template, loads React
- **src/main.tsx** → React app initialization
- **src/App.tsx** → Root React component, routing

### Backend Entry Point
- **src/server.ts** → Express server, middleware, routes

### Configuration Files

#### Frontend .env
```env
VITE_API_URL=http://localhost:5000/api
```

#### Backend .env
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smcf_sacco
JWT_SECRET=your-secret-key-at-least-32-characters
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

### Package Scripts

#### Frontend (smcf-sacco/package.json)
```json
{
  "scripts": {
    "dev": "vite",              // Start dev server
    "build": "tsc && vite build", // Build for production
    "preview": "vite preview",  // Preview build
    "lint": "eslint .",         // Check code quality
    "test": "vitest"            // Run tests
  }
}
```

#### Backend (smcf-sacco-backend/package.json)
```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",  // Start with hot reload
    "build": "tsc",                     // Compile TypeScript
    "start": "node dist/server.js",     // Start production
    "seed": "tsx src/scripts/seedData.ts" // Seed database
  }
}
```

---

## File Relationships

### Authentication Flow
```
Frontend                          Backend
--------                          -------
pages/Auth.tsx                 → routes/auth.ts
  └→ hooks/useAuth.tsx         → middleware/auth.ts
                               → models/User.ts
```

### Member Management
```
Frontend                          Backend
--------                          -------
pages/Members.tsx              → routes/members.ts
pages/MemberDetail.tsx         → models/Member.ts
  └→ hooks/useMembers.ts       → models/Transaction.ts
                               → models/SavingsHistory.ts
```

### Loan Processing
```
Frontend                          Backend
--------                          -------
pages/LoanApplication.tsx      → routes/loans.ts
pages/LoanApprovals.tsx        → models/Loan.ts
pages/Loans.tsx                → models/LoanGuarantor.ts
  └→ hooks/useLoans.ts         → models/LoanApproval.ts
                               → models/RepaymentRecord.ts
                               → middleware/auditLog.ts
```

### Transaction Processing
```
Frontend                          Backend
--------                          -------
pages/Accounts.tsx             → routes/transactions.ts
components/StatCard.tsx        → models/Transaction.ts
  └→ hooks/useTransactions.ts  → models/Member.ts
                               → middleware/auditLog.ts
```

---

## Navigation Map

### Starting Points
1. **Setup Guide** → `/QUICK_START.md`
2. **Project Overview** → `/README.md`
3. **Frontend Docs** → `/smcf-sacco/README.md`
4. **Backend Docs** → `/smcf-sacco-backend/README.md`

### Development
1. **API Reference** → `/smcf-sacco-backend/API_DOCUMENTATION.md`
2. **Integration Guide** → `/smcf-sacco-backend/FRONTEND_INTEGRATION.md`
3. **Project Setup** → `/smcf-sacco-backend/PROJECT_SETUP.md`

### Deployment
1. **Deployment Guide** → `/smcf-sacco-backend/DEPLOYMENT.md`
2. **Deployment Checklist** → `/smcf-sacco-backend/DEPLOYMENT_CHECKLIST.md`
3. **Render Config** → `/smcf-sacco-backend/render.yaml`

---

## Dependencies Overview

### Frontend Core
- React 18.3.1
- TypeScript 5.5.3
- Vite 5.4.2
- TanStack Query 5.x

### Frontend UI
- Tailwind CSS 3.4.1
- Shadcn/ui components
- Lucide React (icons)
- Recharts (charts)

### Backend Core
- Node.js 18+
- Express 4.18.2
- TypeScript 5.3.3
- Mongoose 8.1.1

### Backend Security
- jsonwebtoken 9.0.2
- bcryptjs 2.4.3
- helmet 7.1.0
- cors 2.8.5
- express-rate-limit 7.1.5
- express-validator 7.0.1

---

## File Count Summary

- **Frontend**: ~60 files (src + config)
- **Backend**: ~25 files (src + docs)
- **Documentation**: 8 files
- **Configuration**: 10 files

**Total Project Files**: ~100+ files (excluding node_modules)

---

## Important Notes

### Do NOT Edit
- `node_modules/` - Dependencies (generated)
- `dist/` - Build output (generated)
- `.lock` files - Dependency locks (auto-managed)

### Always Edit
- `.env` - Environment configuration
- `src/` - Source code
- Documentation files

### Commit to Git
- ✅ Source code (`src/`)
- ✅ Configuration files
- ✅ Documentation
- ❌ `node_modules/`
- ❌ `dist/`
- ❌ `.env` (use `.env.example` instead)

---

For questions about specific files or structures, refer to the README files in each folder.
