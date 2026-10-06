import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { lazy, Suspense, useEffect, Component, type ErrorInfo, type ReactNode } from "react";
import { api, normalizeNotification } from "@/lib/api";
import { fetchDashboardStats, DASHBOARD_STATS_KEY } from "@/hooks/useDashboardStats";
import { useConnectivityNotifications } from "@/hooks/useConnectivityNotifications";

// Lazy-load every page so only the current route's JS is parsed on startup.
const lazyPage = (loader: () => Promise<any>, pageName: string) => lazy(async () => {
  try {
    return await loader();
  } catch (error) {
    const retryKey = `smcf-chunk-retry:${pageName}`;
    if (!sessionStorage.getItem(retryKey)) {
      sessionStorage.setItem(retryKey, "1");
      window.location.reload();
      return new Promise(() => undefined);
    }
    throw error;
  }
});

const Dashboard        = lazyPage(() => import("./pages/Dashboard"), "dashboard");
const Members          = lazyPage(() => import("./pages/Members"), "members");
const Loans            = lazyPage(() => import("./pages/Loans"), "loans");
const Accounts         = lazyPage(() => import("./pages/Accounts"), "accounts");
const Guarantors       = lazyPage(() => import("./pages/Guarantors"), "guarantors");
const Reports          = lazyPage(() => import("./pages/Reports"), "reports");
const Compliance       = lazyPage(() => import("./pages/Compliance"), "compliance");
const Documents        = lazyPage(() => import("./pages/Documents"), "documents");
const RegistrationFee  = lazyPage(() => import("./pages/RegistrationFee"), "registration-fee");
const SettingsPage     = lazyPage(() => import("./pages/SettingsPage"), "settings");
const AdminEmail       = lazyPage(() => import("./pages/AdminEmail"), "admin-email");
const MemberDetail     = lazyPage(() => import("./pages/MemberDetail"), "member-detail");
const RiskScoring      = lazyPage(() => import("./pages/RiskScoring"), "risk-scoring");
const LoanApplication  = lazyPage(() => import("./pages/LoanApplication"), "loan-application");
const LoanApprovals    = lazyPage(() => import("./pages/LoanApprovals"), "loan-approvals");
const LoanSimulator    = lazyPage(() => import("./pages/LoanSimulator"), "loan-simulator");
const Notifications    = lazyPage(() => import("./pages/Notifications"), "notifications");
const Auth             = lazyPage(() => import("./pages/Auth"), "auth");
const ResetPassword    = lazyPage(() => import("./pages/ResetPassword"), "reset-password");
const MyAccount        = lazyPage(() => import("./pages/MyAccount"), "my-account");
const FinanceCompliance = lazyPage(() => import("./pages/FinanceCompliance"), "finance-compliance");
const CycleAdmin       = lazyPage(() => import("./pages/CycleAdmin"), "cycle-admin");
const TenXAdmin        = lazyPage(() => import("./pages/TenXAdmin"), "tenx");
const NotFound         = lazyPage(() => import("./pages/NotFound"), "not-found");
const Transparency     = lazyPage(() => import("./pages/Transparency"), "transparency");
const StrategicIntelligence = lazyPage(() => import("./pages/StrategicIntelligence"), "strategic-intelligence");

// Thin route-level fallback — reuses the CSS spinner already on the page.
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}


class PageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SACCO page failed to load", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">This page could not be loaded</h1>
            <p className="mt-2 text-sm text-muted-foreground">Refresh the page to retry loading the latest version.</p>
            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => window.location.reload()}>Refresh page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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

const routerBasename = import.meta.env.DEV ? undefined : "/sacco";

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
  const { user, loading, isStaff } = useAuth();
  const queryClient = useQueryClient();

  useConnectivityNotifications(!!user);

  // As soon as we know the user is authenticated (resolved from localStorage
  // synchronously), kick off background prefetches so dashboard data is already
  // in-flight before the user even clicks the Dashboard link.
  useEffect(() => {
    if (!user) return;
    queryClient.prefetchQuery({
      queryKey: ["notifications"],
      queryFn: async () => {
        const res = await api.get("/notifications");
        const arr = extractList<NotificationInput>(res);
        return arr.map(normalizeNotification);
      },
    });
    if (isStaff) {
      queryClient.prefetchQuery({ queryKey: DASHBOARD_STATS_KEY, queryFn: fetchDashboardStats });
    }
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
      <PageErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/my-account" element={<MyAccount />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:id" element={<MemberDetail />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/loans/apply" element={<LoanApplication />} />
          <Route path="/loans/approvals" element={<LoanApprovals />} />
          <Route path="/loans/simulator" element={<LoanSimulator />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/guarantors" element={<Guarantors />} />
          <Route path="/risk-scoring" element={<RiskScoring />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/cycle-admin" element={<CycleAdmin />} />
          <Route path="/tenx" element={<TenXAdmin />} />
          <Route path="/finance-compliance" element={<FinanceCompliance />} />
          <Route path="/strategic-intelligence" element={<StrategicIntelligence />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/registration-fee" element={<RegistrationFee />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin-email" element={<AdminEmail />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PageErrorBoundary>
    </DashboardLayout>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Auth />
      </Suspense>
    </PageErrorBoundary>
  );
}

function VerifyEmailRoute() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Auth />
      </Suspense>
    </PageErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={routerBasename}>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/reset-password" element={
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <ResetPassword />
                  </Suspense>
                </PageErrorBoundary>
              } />
              <Route path="/verify-email" element={<VerifyEmailRoute />} />
              <Route path="/transparency" element={<Transparency />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
