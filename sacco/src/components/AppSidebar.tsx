import {
  LayoutDashboard, Users, Landmark, BookOpen, BarChart3, Shield, Settings,
  FileText, AlertTriangle, ShieldCheck, Gavel, UserCircle, CreditCard, CalendarCheck, FlaskConical,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const staffNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Members", url: "/members", icon: Users },
  { title: "Loans", url: "/loans", icon: Landmark },
  { title: "Accounts & Ledger", url: "/accounts", icon: BookOpen },
  { title: "Guarantor Exposure", url: "/guarantors", icon: AlertTriangle },
  { title: "Risk Scoring", url: "/risk-scoring", icon: ShieldCheck },
  { title: "Loan Simulator", url: "/loans/simulator", icon: FlaskConical },
  { title: "Loan Approvals", url: "/loans/approvals", icon: Gavel },
];

const memberNav = [
  { title: "My Account", url: "/my-account", icon: UserCircle },
  { title: "Apply for Loan", url: "/loans/apply", icon: CreditCard },
];

const adminNav = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Compliance & Audit", url: "/compliance", icon: Shield },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { user, roles, isStaff } = useAuth();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "??";
  const displayRole = roles.length > 0 ? roles[0].replace("_", " ") : "member";

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="SMCF SACCO" className="w-10 h-10 rounded-lg" />
          <div>
            <h1 className="text-base font-heading font-bold">
              <span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span>
            </h1>
            <p className="text-xs text-sidebar-foreground/60">SACCO</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Member Self-Service — only for non-staff members */}
        {!isStaff && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">My Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {memberNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                      <item.icon className="mr-3 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {/* Staff Operations - only visible to staff */}
        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {staffNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <item.icon className="mr-3 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Administration - only visible to staff */}
        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <item.icon className="mr-3 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-xs font-semibold text-sidebar-primary">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[140px]">{user?.email}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{displayRole}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
