import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { getApiBaseForDebug } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user, isStaff } = useAuth();
  const { theme, setTheme } = useTheme();
  const apiBase = getApiBaseForDebug();
  const maskEmail = (value?: string | null): string => {
    if (!value) return "";
    const [local, domain] = value.split("@");
    if (!domain) return value;
    const maskedLocal = local.length <= 2
      ? `${local.charAt(0)}*`
      : `${local.charAt(0)}${"*".repeat(Math.max(1, local.length - 2))}${local.charAt(local.length - 1)}`;
    const domainParts = domain.split(".");
    const domainName = domainParts[0] || "";
    const maskedDomain = domainName.length <= 2
      ? `${domainName.charAt(0)}*`
      : `${domainName.charAt(0)}${"*".repeat(Math.max(1, domainName.length - 2))}${domainName.charAt(domainName.length - 1)}`;
    const suffix = domainParts.length > 1 ? `.${domainParts.slice(1).join(".")}` : "";
    return `${maskedLocal}@${maskedDomain}${suffix}`;
  };
  const maskApiDisplay = (value: string): string => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const maskedPath = pathParts.length > 0 ? `/${pathParts[0]}/...` : "";
      return `${url.host}${maskedPath}`;
    } catch {
      const parts = trimmed.replace(/\/+$/, "").split("/").filter(Boolean);
      if (parts.length <= 1) return trimmed;
      return `/${parts[0]}/...`;
    }
  };
  const apiHost = (() => {
    try {
      return new URL(apiBase).host;
    } catch {
      return apiBase;
    }
  })();
  const apiDisplay = maskApiDisplay(apiBase || apiHost);
  const safeEmail = maskEmail(user?.email || "");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex min-w-0 flex-col">
          <header className="h-14 border-b bg-card flex items-center justify-between px-2 sm:px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              {isStaff && (
                <span
                  className="hidden md:inline rounded border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                  title={`SACCO API: ${apiDisplay}`}
                >
                  API: {apiDisplay || "Hidden"}
                </span>
              )}
              <span className="text-xs text-muted-foreground hidden sm:inline">{safeEmail}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
