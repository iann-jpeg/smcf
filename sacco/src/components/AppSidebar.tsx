import {
  LayoutDashboard, Users, Landmark, BookOpen, BarChart3, Shield, Settings,
  FileText, AlertTriangle, ShieldCheck, Gavel, UserCircle, UserCircle2, CreditCard, CalendarCheck, FlaskConical, Receipt, Percent,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

type StaffRole = "admin" | "credit_officer" | "credit_committee" | "treasurer" | "auditor";

type StaffNavItem = {
  title: string;
  url: string;
  icon: any;
  allowedRoles: StaffRole[];
};

const staffNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, allowedRoles: ["admin", "credit_officer", "credit_committee", "treasurer", "auditor"] },
  { title: "Members", url: "/members", icon: Users, allowedRoles: ["admin", "credit_officer"] },
  { title: "Loans", url: "/loans", icon: Landmark, allowedRoles: ["admin", "credit_officer", "credit_committee"] },
  { title: "Accounts & Ledger", url: "/accounts", icon: BookOpen, allowedRoles: ["admin", "treasurer"] },
  { title: "Savings Interest", url: "/accounts?tab=savings-interest", icon: Percent, allowedRoles: ["admin"] },
  { title: "Guarantor Exposure", url: "/guarantors", icon: AlertTriangle, allowedRoles: ["admin", "treasurer"] },
  { title: "Risk Scoring", url: "/risk-scoring", icon: ShieldCheck, allowedRoles: ["admin", "credit_officer"] },
  { title: "Loan Simulator", url: "/loans/simulator", icon: FlaskConical, allowedRoles: ["admin", "credit_officer", "credit_committee", "treasurer", "auditor"] },
  { title: "Loan Approvals", url: "/loans/approvals", icon: Gavel, allowedRoles: ["admin", "credit_officer", "credit_committee"] },
] satisfies StaffNavItem[];

const memberNav = [
  { title: "My Account", url: "/my-account", icon: UserCircle },
  { title: "Apply for Loan", url: "/loans/apply", icon: CreditCard },
  { title: "Profile", url: "/my-account?tab=profile", icon: UserCircle2 },
];

const adminNav = [
  { title: "Reports", url: "/reports", icon: BarChart3, allowedRoles: ["admin", "credit_committee", "treasurer", "auditor"] },
  { title: "Registration Fee", url: "/registration-fee", icon: Receipt, allowedRoles: ["admin"] },
  { title: "Compliance & Audit", url: "/compliance", icon: Shield, allowedRoles: ["admin", "auditor"] },
  { title: "Documents", url: "/documents", icon: FileText, allowedRoles: ["admin", "auditor"] },
  { title: "Settings", url: "/settings", icon: Settings, allowedRoles: ["admin"] },
] satisfies StaffNavItem[];

export function AppSidebar() {
  const { user, roles, isStaff } = useAuth();
  const { setOpenMobile } = useSidebar();
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
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "??";
  const safeEmail = maskEmail(user?.email || "");
  const displayRole = roles.length > 0 ? roles[0].replace("_", " ") : "member";

  const handleNavClick = () => {
    setOpenMobile(false);
  };

  const hasAccess = (allowedRoles: StaffRole[]) => {
    if (roles.includes("admin")) return true;
    return roles.some((r) => allowedRoles.includes(r as StaffRole));
  };

  const visibleStaffNav = staffNav.filter((item) => hasAccess(item.allowedRoles));
  const visibleAdminNav = adminNav.filter((item) => hasAccess(item.allowedRoles));

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
                    <NavLink to={item.url} onClick={handleNavClick} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
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
                {visibleStaffNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} onClick={handleNavClick} end={item.url === "/"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
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
                {visibleAdminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} onClick={handleNavClick} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
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
            <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[140px]">{safeEmail}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{displayRole}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
