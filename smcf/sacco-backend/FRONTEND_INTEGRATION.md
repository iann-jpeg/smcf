# Frontend Integration Guide

This guide explains how to update your frontend to connect to the new MongoDB/Express backend.

## Overview

Your frontend currently uses Supabase. We'll update it to use the new REST API backend while maintaining the same functionality.

## Step 1: Install Axios (if not already installed)

```bash
npm install axios
```

## Step 2: Create API Configuration

Create a new file for API configuration:

**File: `src/config/api.ts`**

```typescript
import axios from 'axios';

// Get API URL from environment or use default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/auth';
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

export default api;
```

## Step 3: Update Environment Variables

**File: `smcf-sacco/.env`**

```env
# Backend API URL
VITE_API_URL=http://localhost:5000/api

# For production (update with your Render URL)
# VITE_API_URL=https://your-backend-url.onrender.com/api
```

**File: `smcf-sacco/.env.example`**

```env
VITE_API_URL=http://localhost:5000/api
```

## Step 4: Update Authentication Hook

**File: `src/hooks/useAuth.tsx`**

Replace the Supabase auth logic with API calls:

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api from "@/config/api";

interface User {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
}

interface AuthContext {
  user: User | null;
  loading: boolean;
  roles: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  isStaff: boolean;
}

const AuthCtx = createContext<AuthContext>({
  user: null,
  loading: true,
  roles: [],
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  hasRole: () => false,
  isStaff: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data);
          setRoles(response.data.roles || []);
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData } = response.data;
    
    localStorage.setItem('token', token);
    setUser(userData);
    setRoles(userData.roles || []);
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const response = await api.post('/auth/register', { email, password, fullName });
    const { token, user: userData } = response.data;
    
    localStorage.setItem('token', token);
    setUser(userData);
    setRoles(userData.roles || []);
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    setUser(null);
    setRoles([]);
  };

  const hasRole = (role: string) => roles.includes(role);
  const isStaff = roles.some((r) =>
    ["admin", "credit_officer", "credit_committee", "treasurer", "auditor"].includes(r)
  );

  return (
    <AuthCtx.Provider value={{ user, loading, roles, signIn, signUp, signOut, hasRole, isStaff }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
```

## Step 5: Update Data Hooks

Replace Supabase queries with API calls:

**File: `src/hooks/useMembers.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import api from "@/config/api";

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const response = await api.get("/members");
      return response.data;
    },
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      const response = await api.get(`/members/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}
```

**File: `src/hooks/useLoans.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import api from "@/config/api";

export function useLoans() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const response = await api.get("/loans");
      return response.data;
    },
  });
}

export function useLoansByMember(memberId: string) {
  return useQuery({
    queryKey: ["loans", "member", memberId],
    queryFn: async () => {
      const response = await api.get(`/loans?memberId=${memberId}`);
      return response.data;
    },
    enabled: !!memberId,
  });
}
```

**File: `src/hooks/useTransactions.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import api from "@/config/api";

export function useTransactions(limit = 50) {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await api.get(`/transactions?limit=${limit}`);
      return response.data;
    },
  });
}

export function useTransactionsByMember(memberId: string) {
  return useQuery({
    queryKey: ["transactions", "member", memberId],
    queryFn: async () => {
      const response = await api.get(`/transactions?memberId=${memberId}`);
      return response.data;
    },
    enabled: !!memberId,
  });
}
```

**File: `src/hooks/useNotifications.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";

export function useNotifications() {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await api.get("/notifications");
      return response.data;
    },
  });

  const unreadCount = query.data?.filter((n: any) => !n.read).length ?? 0;

  return { ...query, unreadCount };
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return api.put(`/notifications/${id}/read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.put('/notifications/mark-all-read');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
```

## Step 6: Update Dashboard Stats Hook

**File: `src/hooks/useDashboardStats.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import api from "@/config/api";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const response = await api.get("/dashboard/stats");
      return response.data;
    },
  });
}

export function useGrowthMetrics(months = 6) {
  return useQuery({
    queryKey: ["dashboard", "growth", months],
    queryFn: async () => {
      const response = await api.get(`/dashboard/growth?months=${months}`);
      return response.data;
    },
  });
}
```

## Step 7: Update Auth Page

**File: `src/pages/Auth.tsx`**

Update the sign-in/sign-up logic:

```typescript
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ... rest of the component
}
```

## Step 8: Remove Supabase Dependencies (Optional)

Once everything is working, you can remove Supabase:

```bash
npm uninstall @supabase/supabase-js
```

Remove the `src/integrations/supabase` folder.

## Step 9: Test the Integration

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd smcf-sacco
   npm run dev
   ```

3. **Test Authentication:**
   - Register a new user
   - Login with existing user
   - Check if token is stored in localStorage

4. **Test API Calls:**
   - View members list
   - Create a new member
   - Apply for a loan
   - Check notifications

## Common Issues & Solutions

### CORS Errors
**Problem:** Browser blocks requests due to CORS  
**Solution:** Ensure backend `FRONTEND_URL` in `.env` matches your frontend URL exactly

### 401 Unauthorized
**Problem:** Token not being sent or expired  
**Solution:** Check if token is in localStorage and being added to headers

### Connection Refused
**Problem:** Backend not running or wrong URL  
**Solution:** Verify backend is running on correct port and `VITE_API_URL` is correct

### Data Structure Mismatch
**Problem:** Components expect Supabase data structure  
**Solution:** Update TypeScript interfaces to match new API response format

## Production Deployment

When deploying to production:

1. **Update Frontend `.env`:**
   ```env
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```

2. **Update Backend `FRONTEND_URL`:**
   ```env
   FRONTEND_URL=https://your-frontend-url.com
   ```

3. **Rebuild Frontend:**
   ```bash
   npm run build
   ```

4. **Deploy both backend and frontend**

## Real-time Updates Alternative

Since we're moving away from Supabase's real-time features, consider:

1. **Polling:** Use React Query's `refetchInterval`
2. **Websockets:** Implement Socket.IO for real-time updates (future enhancement)
3. **Manual refresh:** Add refresh buttons to update data

Example polling:
```typescript
useQuery({
  queryKey: ["members"],
  queryFn: fetchMembers,
  refetchInterval: 30000, // Refetch every 30 seconds
});
```

## Next Steps

1. Test all functionality thoroughly
2. Update error handling for better user experience
3. Add loading states and error boundaries
4. Consider adding optimistic updates for better UX
5. Implement proper TypeScript types for all API responses

---

**Need Help?** Check the API documentation in `backend/API_DOCUMENTATION.md`
