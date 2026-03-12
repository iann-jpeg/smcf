import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { lazy, Suspense, useEffect } from "react";
import { api, normalizeNotification } from "@/lib/api";
import { fetchDashboardStats, DASHBOARD_STATS_KEY } from "@/hooks/useDashboardStats";

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
const MemberDetail     = lazy(() => import("./pages/MemberDetail"));
const RiskScoring      = lazy(() => import("./pages/RiskScoring"));
const LoanApplication  = lazy(() => import("./pages/LoanApplication"));
const LoanApprovals    = lazy(() => import("./pages/LoanApprovals"));
const LoanSimulator    = lazy(() => import("./pages/LoanSimulator"));
const Notifications    = lazy(() => import("./pages/Notifications"));
const Auth             = lazy(() => import("./pages/Auth"));
const MyAccount        = lazy(() => import("./pages/MyAccount"));
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

function ProtectedRoutes() {
  const { user, loading, isStaff } = useAuth();
  const queryClient = useQueryClient();

  // As soon as we know the user is authenticated (resolved from localStorage
  // synchronously), kick off background prefetches so dashboard data is already
  // in-flight before the user even clicks the Dashboard link.

  useEffect(() => {
    if (!user) return;
    // dashboard/stats is staff-only on the backend — skip prefetch for regular members
    if (isStaff) {
      queryClient.prefetchQuery({ queryKey: DASHBOARD_STATS_KEY, queryFn: fetchDashboardStats });
    }
    queryClient.prefetchQuery({
      queryKey: ["notifications"],
      queryFn: async () => {
        const res = await api.get("/notifications");
        const arr = Array.isArray(res) ? res : (res as any).data ?? [];
        return arr.map(normalizeNotification);
      },
    });
  }, [user, queryClient]);

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
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/settings" element={<SettingsPage />} />
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename="/sacco">
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
