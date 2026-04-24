import API_BASE from "./api";
import { storeMemberIdForPush } from "./pushNotifications";

// Storage keys
const TOKEN_KEY = "smcf_token";
const USER_KEY = "smcf_user";

// Token management
export const authService = {
  // Save auth data
  saveAuth: (token: string, user: any) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    // Store member ID for push notifications (enables notifications even when logged out)
    if (user?._id || user?.id) {
      storeMemberIdForPush(user._id || user.id);
    }
  },

  // Get token
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  // Get user
  getUser: (): any | null => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  // Clear auth data (but keep push subscription)
  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Note: We keep smcf-member-id and smcf-push-subscription for background notifications
  },

  // Check if authenticated
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  // Get auth headers
  getAuthHeaders: () => {
    const token = authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

// API helper with auth
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...authService.getAuthHeaders(),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If unauthorized, clear auth
      if (response.status === 401) {
        authService.clearAuth();
        window.location.href = "/";
      }
      throw new Error(data.error || "Request failed");
    }

    return data;
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
};

// Specific API calls
export const api = {
  // Authentication
  auth: {
    login: (phone: string, password: string) =>
      apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      }),
  },

  // Members
  members: {
    getAll: () => apiRequest("/api/members"),

    getOne: (id: string) => apiRequest(`/api/members/${id}`),

    create: (data: any) =>
      apiRequest("/api/members", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: any) =>
      apiRequest(`/api/members/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest(`/api/members/${id}`, {
        method: "DELETE",
      }),

    reorder: (updates: any[]) =>
      apiRequest("/api/members/reorder", {
        method: "POST",
        body: JSON.stringify(updates),
      }),
  },

  // Payments
  payments: {
    getAll: () => apiRequest("/api/payments"),

    create: (data: any) =>
      apiRequest("/api/payments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Announcements
  announcements: {
    getAll: () => apiRequest("/api/announcements"),

    create: (data: any) =>
      apiRequest("/api/announcements", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest(`/api/announcements/${id}`, {
        method: "DELETE",
      }),
  },

  // Loans
  loans: {
    getAll: () => apiRequest("/api/loans"),

    request: (data: any) =>
      apiRequest("/api/loans/request", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateStatus: (id: string, status: string) =>
      apiRequest(`/api/loans/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
  },
};

export default api;
