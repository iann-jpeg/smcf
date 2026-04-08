# SACCO Shareholders Module - Setup & Implementation Guide

## Project Structure

```
smcfsacco/smcf-sacco/
├── src/
│   ├── pages/
│   │   ├── SACCOShareholders.tsx          # Main module component
│   │   └── tabs/
│   │       ├── OverviewTab.tsx            # Dashboard & analytics
│   │       ├── ShareholdersTab.tsx        # Member directory
│   │       ├── SharesLedgerTab.tsx        # Transaction history
│   │       ├── DividendsTab.tsx           # Dividend management
│   │       ├── ReserveFundTab.tsx         # Reserve fund management
│   │       ├── PoliciesDocumentsTab.tsx   # Document repository
│   │       ├── DownloadsTab.tsx           # Resource downloads
│   │       ├── ReportsTab.tsx             # Reports & analytics
│   │       └── AuditLogsTab.tsx           # Activity audit trail
│   ├── components/
│   │   └── SACCONavigation.tsx            # Navigation & header
│   ├── routes/
│   │   └── saccoRoutes.tsx                # Route configuration
│   ├── services/
│   │   └── saccoAPI.example.ts            # API service examples
│   └── App.tsx
├── public/
├── index.html
└── package.json
```

## Development Setup

### 1. Install Dependencies

```bash
# Navigate to the smcf-sacco directory
cd smcfsacco/smcf-sacco

# Install required packages
npm install

# Or with bun (if using bun as package manager)
bun install
```

### 2. Required Core Dependencies

The project assumes the following core dependencies are already installed:
- `react` & `react-dom` (v18+)
- `react-router-dom` (v6+)
- `typescript`
- `tailwindcss`
- `shadcn/ui` components
- `lucide-react` (icons)
- `recharts` (charts)

### 3. Add Missing UI Components

If not already installed, add shadcn/ui components:

```bash
# Install individual components as needed
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add select
```

### 4. Install Chart Library

```bash
npm install recharts
```

### 5. Environment Variables

Create `.env` file in the project root:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_ENV=development

# Auth Configuration (if applicable)
REACT_APP_AUTH_SERVER=http://localhost:3000/auth

# Feature Flags
REACT_APP_ENABLE_EXPORTS=true
REACT_APP_ENABLE_IMPORTS=true
REACT_APP_ENABLE_REPORTS=true
```

## Integration Steps

### Step 1: Add Routes to Main Router

Edit `src/App.tsx` or your main router file:

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import SACCOShareholdersModule from './pages/SACCOShareholders';
import { SACCONavbar } from './components/SACCONavigation';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // ... existing routes
      {
        path: 'sacco',
        element: <SACCOShareholdersModule />
      }
    ]
  }
]);

function MainLayout() {
  return (
    <>
      <SACCONavbar />
      <main className="container mx-auto">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return <RouterProvider router={router} />;
}
```

### Step 2: Create API Service

Copy `src/services/saccoAPI.example.ts` to `src/services/saccoAPI.ts` and update with your actual API endpoints:

```typescript
// src/services/saccoAPI.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Add authorization header if needed
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

export default api;
```

### Step 3: Implement API Services

Create hooks for data fetching using React Query:

```typescript
// src/hooks/useShareholders.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { shareholderAPI } from '../services/saccoAPI';

export function useShareholders(filters?: any) {
  return useQuery({
    queryKey: ['shareholders', filters],
    queryFn: () => shareholderAPI.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useShareholdersStats() {
  return useQuery({
    queryKey: ['shareholders-stats'],
    queryFn: () => shareholderAPI.getStats(),
  });
}

export function useCreateShareholder() {
  return useMutation({
    mutationFn: (shareholder) => shareholderAPI.create(shareholder),
  });
}
```

### Step 4: Update Tab Components with Real Data

Replace mock data with API calls:

```typescript
// src/pages/tabs/ShareholdersTab.tsx - Updated with real data
import { useShareholders } from '@/hooks/useShareholders';
import { useEffect, useState } from 'react';

export function ShareholdersTab({ searchQuery }) {
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  
  const { data, isLoading, error } = useShareholders({
    status: status !== 'all' ? status : undefined,
    category: category !== 'all' ? category : undefined,
    search: searchQuery || undefined
  });

  if (isLoading) return <div>Loading shareholders...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    // ... component JSX
  );
}
```

### Step 5: Add Authentication

If needed, integrate with authentication:

```typescript
// src/services/auth.ts
import axios from 'axios';

export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await axios.post(
      `${process.env.REACT_APP_AUTH_SERVER}/login`,
      { email, password }
    );
    localStorage.setItem('token', response.data.token);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};
```

## Running the Application

### Development Mode

```bash
# Terminal 1: Start the development server
npm run dev

# The app will be available at http://localhost:5173 (Vite)
# or http://localhost:3000 (Create React App)
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Testing Setup

### Unit Tests

Create test files for each component:

```typescript
// src/pages/tabs/__tests__/ShareholdersTab.test.tsx
import { render, screen } from '@testing-library/react';
import { ShareholdersTab } from '../ShareholdersTab';

describe('ShareholdersTab', () => {
  it('renders shareholders table', () => {
    render(<ShareholdersTab searchQuery="" />);
    expect(screen.getByText(/shareholders directory/i)).toBeInTheDocument();
  });
});
```

### Run Tests

```bash
npm run test
```

## Troubleshooting

### Issue: Components not rendering

**Solution**: Check that all required UI components from shadcn/ui are installed

```bash
# Reinstall missing components
npx shadcn-ui@latest add [component-name]
```

### Issue: API errors

**Solution**: Check API URLs and authentication

```typescript
// Debug API calls
console.log(process.env.REACT_APP_API_URL);
// Verify CORS headers if needed
```

### Issue: Styling issues with Tailwind

**Solution**: Ensure Tailwind is properly configured

```bash
# Rebuild Tailwind CSS
npm run build:css
```

### Issue: Chart not displaying

**Solution**: Ensure Recharts is installed and ResponsiveContainer is used

```bash
npm install recharts
```

## Performance Optimization

### 1. Code Splitting

```typescript
import { lazy, Suspense } from 'react';

const OverviewTab = lazy(() => import('./tabs/OverviewTab'));

function SACCOShareholders() {
  return (
    <Suspense fallback={<Loading />}>
      <OverviewTab />
    </Suspense>
  );
}
```

### 2. Memoization

```typescript
import { memo } from 'react';

const ShareholdersTable = memo(function ({ data, onRowClick }) {
  return (
    // ... table JSX
  );
});
```

### 3. Data Caching

```typescript
// Configure React Query cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
    },
  },
});
```

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build and deploy
netlify deploy --prod --dir dist
```

### Environment Variables on Deployment

Set the following in your deployment platform:
- `REACT_APP_API_URL` - Your backend API URL
- `REACT_APP_ENV` - Environment (production, staging, etc.)

## Monitoring & Analytics

### Add Error Tracking

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_ENV,
});
```

### Add Analytics

```typescript
import { trackPageView, trackEvent } from '@/analytics';

// Track page views
useEffect(() => {
  trackPageView('shareholders');
}, []);

// Track events
const handleExport = () => {
  trackEvent('export_shareholders', { format: 'csv' });
};
```

## Next Steps

1. **Backend Integration**: Implement API endpoints matching the service examples
2. **Authentication**: Integrate user authentication and authorization
3. **Real-time Updates**: Add WebSocket support for live data
4. **Notifications**: Implement in-app notifications
5. **Advanced Features**: Add batch operations, bulk import/export
6. **Testing**: Write comprehensive unit and integration tests
7. **Documentation**: Create user documentation and API docs
8. **Performance**: Implement advanced caching and optimization

## Support & Resources

- [React Documentation](https://react.dev)
- [React Router Docs](https://reactrouter.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Recharts Documentation](https://recharts.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview        # Preview production build
npm run lint           # Run ESLint
npm run type-check    # Run TypeScript type checking

# Testing
npm run test          # Run tests
npm run test:ui       # Run tests with UI
npm run test:coverage # Generate coverage report

# Formatting
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
```

---

**Created**: 2025-03-15  
**Last Updated**: 2025-03-15  
**Version**: 1.0.0
