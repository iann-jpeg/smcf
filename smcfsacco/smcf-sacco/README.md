# SMCF SACCO Frontend

React-based frontend application for the SMCF SACCO Management System.

## Overview

This is the frontend application that provides a user interface for managing a SACCO (Savings and Credit Cooperative). It communicates with the backend API located in the `../smcf-sacco-backend` folder.

## Features

- 👥 Member management and registration
- 💰 Loan application and tracking
- 💳 Transaction management
- 📊 Dashboard with analytics
- 🔔 Real-time notifications
- 📈 Growth metrics and reports
- 🔒 Role-based access control
- 🎯 Loan simulator and risk scoring

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TanStack Query** - Data fetching and caching
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components
- **React Router** - Navigation

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Backend API running (see `../smcf-sacco-backend/README.md`)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create environment file**:
   ```bash
   # Create .env file
   echo "VITE_API_URL=http://localhost:5000/api" > .env
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open browser**:
   Navigate to http://localhost:5173

## Environment Variables

Create a `.env` file in the root of the frontend directory:

```env
# Backend API URL
VITE_API_URL=http://localhost:5000/api

# For production, use your deployed backend URL
# VITE_API_URL=https://your-backend.onrender.com/api
```

## Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Run tests
npm run test
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Shadcn UI components
│   ├── AppSidebar.tsx  # Navigation sidebar
│   ├── DashboardLayout.tsx
│   └── ...
├── hooks/              # Custom React hooks
│   ├── useAuth.tsx     # Authentication hook
│   ├── useMembers.ts   # Members data hook
│   ├── useLoans.ts     # Loans data hook
│   └── ...
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Members.tsx
│   ├── Loans.tsx
│   └── ...
├── lib/                # Utility libraries
│   ├── utils.ts
│   ├── risk-engine.ts
│   └── ...
└── App.tsx            # Main app component
```

## Connecting to Backend

The frontend expects the backend to be running and accessible. By default:
- Backend runs on: http://localhost:5000
- API base URL: http://localhost:5000/api

## Deployment

### Vercel

1. Connect your GitHub repository
2. Set environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`
3. Deploy

### Netlify

1. Connect your GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`
5. Deploy

## Troubleshooting

**Error: Network Error**
- Ensure backend is running on http://localhost:5000
- Check VITE_API_URL in .env
- Verify CORS settings in backend

**TypeScript errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Related Documentation

- Backend API: `../smcf-sacco-backend/API_DOCUMENTATION.md`
- Deployment: `../smcf-sacco-backend/DEPLOYMENT.md`
- Integration Guide: `../smcf-sacco-backend/FRONTEND_INTEGRATION.md`
- Root README: `../README.md`

## Important Notes

### ⚠️ Supabase Migration Pending

This frontend currently uses Supabase for data operations. The backend has been migrated to MongoDB with a REST API. To complete the migration:

1. Follow the integration guide: `../smcf-sacco-backend/FRONTEND_INTEGRATION.md`
2. Update all hooks in `src/hooks/` to use REST API instead of Supabase
3. Update authentication in `src/hooks/useAuth.tsx`
4. Test all functionality after migration
5. Remove `@supabase/supabase-js` dependency once migration is complete

Until migration is complete, the Supabase integration remains functional.

## License

MIT
