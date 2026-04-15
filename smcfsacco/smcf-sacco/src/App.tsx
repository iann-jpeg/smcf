import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { lazy, Suspense, useEffect } from "react";
import { api, normalizeNotification } from "@/lib/api";
import { fetchDashboardStats, DASHBOARD_STATS_KEY } from "@/hooks/useDashboardStats";
import { useConnectivityNotifications } from "@/hooks/useConnectivityNotifications";

const STAFF_ROLES = ["admin", "credit_officer", "credit_committee", "treasurer", "auditor"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const ROUTE_ACCESS: Record<string, StaffRole[]> = {
  members: ["admin", "credit_officer"],
  memberDetail: ["admin", "credit_officer"],
  loans: ["admin", "credit_officer", "credit_committee"],
  loanApprovals: ["admin", "credit_officer", "credit_committee"],
  accounts: ["admin", "treasurer"],
  guarantors: ["admin", "treasurer"],
  riskScoring: ["admin", "credit_officer"],
  reports: ["admin", "credit_committee", "treasurer", "auditor"],
  compliance: ["admin", "auditor"],
  documents: ["admin", "auditor"],
  settings: ["admin"],
  adminEmail: ["admin"],
};

// Lazy-load every page so only the current route's JS is parsed on startup.
const Dashboard        = lazy(() => import("./pages/Dashboard"));
const Members          = lazy(() => import("./pages/Members"));
const Loans            = lazy(() => import("./pages/Loans"));
const Accounts         = lazy(() => import("./pages/Accounts"));
const Guarantors       = lazy(() => import("./pages/Guarantors"));
const Reports          = lazy(() => import("./pages/Reports"));
const Compliance       = lazy(() => import("./pages/Compliance"));
const Documents        = lazy(() => import("./pages/Documents"));
const SettingsPage     = lazy(() => import("./pages/SettingsPage"));
const AdminEmail       = lazy(() => import("./pages/AdminEmail"));
const MemberDetail     = lazy(() => import("./pages/MemberDetail"));
const RiskScoring      = lazy(() => import("./pages/RiskScoring"));
const LoanApplication  = lazy(() => import("./pages/LoanApplication"));
const LoanApprovals    = lazy(() => import("./pages/LoanApprovals"));
const LoanSimulator    = lazy(() => import("./pages/LoanSimulator"));
const Notifications    = lazy(() => import("./pages/Notifications"));
const Auth             = lazy(() => import("./pages/Auth"));
const ForgotPassword   = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword    = lazy(() => import("./pages/ResetPassword"));
const MyAccount        = lazy(() => import("./pages/MyAccount"));
const Forbidden        = lazy(() => import("./pages/Forbidden"));
const NotFound         = lazy(() => import("./pages/NotFound"));

// Thin route-level fallback — reuses the CSS spinner already on the page.
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 2 minutes — no background refetch on every navigation.
      staleTime: 2 * 60 * 1000,
      // Keep unused query data in cache for 5 minutes.
      gcTime: 5 * 60 * 1000,
      // Only retry once on failure to avoid hanging on flaky connections.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type NotificationInput = Record<string, unknown> & {
  _id?: string | object;
  id?: string;
};

const extractList = <T,>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    const data = (res as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
};

function ProtectedRoutes() {
  const { user, loading, roles } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isStaff = roles.some((role) => STAFF_ROLES.includes(role as StaffRole));

  const canAccess = (allowedRoles: StaffRole[]) => {
    if (roles.includes("admin")) return true;
    return roles.some((role) => allowedRoles.includes(role as StaffRole));
  };

  const guard = (element: JSX.Element, allowedRoles: StaffRole[]) => {
    if (canAccess(allowedRoles)) return element;
    return <Navigate to="/forbidden" replace state={{ from: location.pathname }} />;
  };

  useConnectivityNotifications(!!user);

  // As soon as we know the user is authenticated (resolved from localStorage
  // synchronously), kick off background prefetches so dashboard data is already
  // in-flight before the user even clicks the Dashboard link.
  useEffect(() => {
    if (!user || !isStaff) return;
    queryClient.prefetchQuery({ queryKey: DASHBOARD_STATS_KEY, queryFn: fetchDashboardStats });
    queryClient.prefetchQuery({
      queryKey: ["notifications"],
      queryFn: async () => {
        const res = await api.get("/notifications");
        const arr = extractList<NotificationInput>(res);
        return arr.map(normalizeNotification);
      },
    });
  }, [user, isStaff, queryClient]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/my-account" element={<MyAccount />} />
          <Route path="/forbidden" element={<Forbidden />} />
          <Route path="/members" element={guard(<Members />, ROUTE_ACCESS.members)} />
          <Route path="/members/:id" element={guard(<MemberDetail />, ROUTE_ACCESS.memberDetail)} />
          <Route path="/loans" element={guard(<Loans />, ROUTE_ACCESS.loans)} />
          <Route path="/loans/apply" element={<LoanApplication />} />
          <Route path="/loans/approvals" element={guard(<LoanApprovals />, ROUTE_ACCESS.loanApprovals)} />
          <Route path="/loans/simulator" element={<LoanSimulator />} />
          <Route path="/accounts" element={guard(<Accounts />, ROUTE_ACCESS.accounts)} />
          <Route path="/guarantors" element={guard(<Guarantors />, ROUTE_ACCESS.guarantors)} />
          <Route path="/risk-scoring" element={guard(<RiskScoring />, ROUTE_ACCESS.riskScoring)} />
          <Route path="/reports" element={guard(<Reports />, ROUTE_ACCESS.reports)} />
          <Route path="/compliance" element={guard(<Compliance />, ROUTE_ACCESS.compliance)} />
          <Route path="/documents" element={guard(<Documents />, ROUTE_ACCESS.documents)} />
          <Route path="/settings" element={guard(<SettingsPage />, ROUTE_ACCESS.settings)} />
          <Route path="/admin-email" element={guard(<AdminEmail />, ROUTE_ACCESS.adminEmail)} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </DashboardLayout>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <Auth />
    </Suspense>
  );
}

function VerifyEmailRoute() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Auth />
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/forgot-password" element={
                <Suspense fallback={<PageLoader />}>
                  <ForgotPassword />
                </Suspense>
              } />
              <Route path="/reset-password" element={
                <Suspense fallback={<PageLoader />}>
                  <ResetPassword />
                </Suspense>
              } />
              <Route path="/verify-email" element={<VerifyEmailRoute />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
