import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
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
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
