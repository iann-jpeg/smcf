import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Admin from "./pages/Admin";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useSocketNotifications } from "@/hooks/use-socket-notifications";

const queryClient = new QueryClient();

const userData: any = null;
const onLogout: any = () => {};

// Component to initialize socket notifications at app level
function SocketNotificationHandler({ children }: { children: React.ReactNode }) {
  useSocketNotifications();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="smcf-ui-theme">
      <NotificationProvider>
        <SocketNotificationHandler>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Navigate to="/sacco/auth" replace />} />
                <Route
                  path="/admin"
                  element={<Admin userData={userData} onLogout={onLogout} />}
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SocketNotificationHandler>
      </NotificationProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
