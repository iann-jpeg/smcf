import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
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

function SaccoBridge() {
  const isSaccoRoot = window.location.pathname === "/sacco/";

  useEffect(() => {
    // Force-load the SACCO entry when the root bundle receives a deep link.
    if (!isSaccoRoot) {
      window.location.replace("/sacco/");
    }
  }, [isSaccoRoot]);

  if (isSaccoRoot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f3ee] px-6 text-center text-[#162f2d]">
        <div>
          <p className="text-lg font-semibold">SMCF member portal unavailable</p>
          <p className="mt-2 text-sm text-[#536c67]">
            The portal bundle could not be loaded from this deployment.
          </p>
          <a className="mt-5 inline-block font-semibold underline" href="/">
            Return to SMCF
          </a>
        </div>
      </div>
    );
  }

  return null;
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
                <Route path="/auth" element={<SaccoBridge />} />
                <Route path="/sacco/*" element={<SaccoBridge />} />
                <Route path="/admin" element={<SaccoBridge />} />
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
