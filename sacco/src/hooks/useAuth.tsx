import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ─── Auth user shape returned by the backend ──────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  roles: string[];
}

// ─── Storage keys ──────────────────────────────────────────────────────────
const TOKEN_KEY = "smcf_auth_token";
const USER_KEY  = "smcf_auth_user";

/** Save token + user to localStorage and notify all listeners. */
export function storeAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("smcf-auth-change"));
}

/** Clear stored credentials and notify all listeners. */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("smcf-auth-change"));
}

/** Read current auth state from localStorage (no network call). */
function readStoredAuth(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw   = localStorage.getItem(USER_KEY);
    return { token, user: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, user: null };
  }
}

// ─── Context ───────────────────────────────────────────────────────────────
interface AuthContext {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  roles: string[];
  signOut: () => void;
  hasRole: (role: string) => boolean;
  isStaff: boolean;
}

const AuthCtx = createContext<AuthContext>({
  user: null,
  token: null,
  loading: true,
  roles: [],
  signOut: () => {},
  hasRole: () => false,
  isStaff: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read localStorage synchronously so loading is never true on first paint.
  const _init = readStoredAuth();
  const [user,    setUser]    = useState<AuthUser | null>(_init.user);
  const [token,   setToken]   = useState<string | null>(_init.token);
  // Always starts resolved — no async phase needed since storage is synchronous.
  const [loading, setLoading] = useState(false);

  const sync = () => {
    const { token, user } = readStoredAuth();
    setToken(token);
    setUser(user);
    setLoading(false);
  };

  useEffect(() => {
    // Still listen for cross-tab sign-in / sign-out events.
    window.addEventListener("smcf-auth-change", sync);
    return () => window.removeEventListener("smcf-auth-change", sync);
  }, []);

  const signOut = () => {
    clearAuth();
    window.location.href = "/sacco/auth";
  };

  const roles   = user?.roles ?? [];
  const hasRole = (role: string) => roles.includes(role);
  const isStaff = roles.some((r) =>
    ["admin", "credit_officer", "credit_committee", "treasurer", "auditor"].includes(r)
  );

  return (
    <AuthCtx.Provider value={{ user, token, loading, roles, signOut, hasRole, isStaff }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
