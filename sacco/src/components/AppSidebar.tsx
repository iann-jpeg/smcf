import {
  LayoutDashboard, Users, Landmark, BookOpen, BarChart3, Shield, Settings,
  FileText, AlertTriangle, ShieldCheck, Gavel, UserCircle, UserCircle2, CreditCard, CalendarCheck, FlaskConical, Receipt, Percent, Calculator, ArrowLeftRight, Wallet, TrendingUp, BadgeCheck, Bell, ClipboardList, CircleDollarSign, UsersRound,
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
] satisfies StaffNavItem[];

const financeNav = [
  { title: "Accounts & Ledger", url: "/accounts", icon: BookOpen, allowedRoles: ["admin", "treasurer"] },
  { title: "Wallet Deposits", url: "/accounts?tab=wallet", icon: Wallet, allowedRoles: ["admin", "treasurer"] },
  { title: "Transactions", url: "/accounts?tab=transactions", icon: ArrowLeftRight, allowedRoles: ["admin", "treasurer", "auditor"] },
  { title: "Statements & Reports", url: "/reports", icon: FileText, allowedRoles: ["admin", "treasurer", "auditor"] },
] satisfies StaffNavItem[];

const cycleNav = [
  { title: "Cycle Command Centre", url: "/cycle-admin", icon: CalendarCheck, allowedRoles: ["admin", "treasurer"] },
  { title: "Contributions", url: "/accounts?tab=cycles", icon: CircleDollarSign, allowedRoles: ["admin", "treasurer"] },
  { title: "Payouts & Disbursements", url: "/cycle-admin?tab=disbursements", icon: Wallet, allowedRoles: ["admin", "treasurer"] },
] satisfies StaffNavItem[];

const loanNav = [
  { title: "Loan Portfolio", url: "/loans", icon: Landmark, allowedRoles: ["admin", "credit_officer", "credit_committee"] },
  { title: "Loan Applications", url: "/loans/approvals", icon: Gavel, allowedRoles: ["admin", "credit_officer", "credit_committee"] },
  { title: "Repayments", url: "/loans", icon: CreditCard, allowedRoles: ["admin", "credit_officer", "treasurer", "auditor"] },
  { title: "Risk Scoring", url: "/risk-scoring", icon: ShieldCheck, allowedRoles: ["admin", "credit_officer"] },
  { title: "Loan Simulator", url: "/loans/simulator", icon: FlaskConical, allowedRoles: ["admin", "credit_officer", "credit_committee", "treasurer", "auditor"] },
  { title: "Guarantor Requests", url: "/guarantors", icon: AlertTriangle, allowedRoles: ["admin", "treasurer"] },
] satisfies StaffNavItem[];

const shareNav = [
  { title: "Share Capital & Dividends", url: "/accounts?tab=share-capital-dividends", icon: Percent, allowedRoles: ["admin"] },
  { title: "Savings Interest", url: "/accounts?tab=savings-interest", icon: Percent, allowedRoles: ["admin"] },
] satisfies StaffNavItem[];

const memberNav = [
  { title: "My Account", url: "/my-account", icon: UserCircle },
  { title: "Wallet & Cycles", url: "/my-account?tab=wallet-cycles", icon: CalendarCheck },
  { title: "Apply for Loan", url: "/loans/apply", icon: CreditCard },
];

const memberFinanceNav = [
  { title: "Savings", url: "/my-account?tab=savings", icon: Wallet },
  { title: "Shares", url: "/my-account?tab=shares", icon: Percent },
  { title: "Loans", url: "/my-account?tab=loans", icon: Landmark },
  { title: "Repayments", url: "/my-account?tab=repayments", icon: CreditCard },
  { title: "Transactions", url: "/my-account?tab=transactions", icon: ArrowLeftRight },
  { title: "Statements", url: "/my-account?tab=statements", icon: FileText },
];

const memberServicesNav = [
  { title: "Repayment History", url: "/my-account?tab=repayment-history", icon: Receipt },
  { title: "Growth", url: "/my-account?tab=growth", icon: TrendingUp },
  { title: "Guarantor Requests", url: "/my-account?tab=guarantors", icon: ShieldCheck },
  { title: "Registration Details", url: "/my-account?tab=registration-form", icon: FileText },
  { title: "ID Card", url: "/my-account?tab=membership-card", icon: BadgeCheck },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Profile & Security", url: "/my-account?tab=profile", icon: UserCircle2 },
];

const adminNav = [
  { title: "10X Group", url: "/tenx", icon: UsersRound, allowedRoles: ["admin", "treasurer"] },
  { title: "Finance & Compliance", url: "/finance-compliance", icon: Calculator, allowedRoles: ["admin", "treasurer", "auditor"] },
  { title: "Reports", url: "/reports", icon: BarChart3, allowedRoles: ["admin", "credit_committee", "treasurer", "auditor"] },
  { title: "Registration Fee", url: "/registration-fee", icon: Receipt, allowedRoles: ["admin"] },
] satisfies StaffNavItem[];

const systemNav = [
  { title: "Notifications", url: "/notifications", icon: Bell, allowedRoles: ["admin", "treasurer", "auditor"] },
  { title: "Audit & Compliance", url: "/compliance", icon: ClipboardList, allowedRoles: ["admin", "auditor"] },
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
  const navGroups = [
    ["Finance", financeNav],
    ["Cycles", cycleNav],
    ["Loans", loanNav],
    ["Shares", shareNav],
    ["Compliance & Reports", adminNav],
    ["System", systemNav],
  ].map(([label, items]) => [label, (items as StaffNavItem[]).filter((item) => hasAccess(item.allowedRoles))] as const).filter(([, items]) => items.length > 0);

  const renderNavGroup = (label: string, items: StaffNavItem[]) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-[0.16em]">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={`${label}-${item.title}`}>
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
  );

  const renderMemberGroup = (label: string, items: typeof memberFinanceNav) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-[0.16em]">{label}</SidebarGroupLabel>
      <SidebarGroupContent><SidebarMenu>{items.map((item) => <SidebarMenuItem key={item.title}><SidebarMenuButton asChild><NavLink to={item.url} onClick={handleNavClick} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"><item.icon className="mr-3 h-4 w-4" /><span>{item.title}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
    </SidebarGroup>
  );

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
        {!isStaff && <>{renderMemberGroup("My Account", memberNav)}{renderMemberGroup("Financial", memberFinanceNav)}{renderMemberGroup("Account & Services", memberServicesNav)}</>}

        {/* Staff Operations - only visible to staff */}
        {isStaff && <SidebarGroup><SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-[0.16em]">Command Centre</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{visibleStaffNav.map((item) => <SidebarMenuItem key={item.title}><SidebarMenuButton asChild><NavLink to={item.url} onClick={handleNavClick} end={item.url === "/"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"><item.icon className="mr-3 h-4 w-4" /><span>{item.title}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>}

        {/* Administration - only visible to staff */}
        {isStaff && navGroups.map(([label, items]) => renderNavGroup(label, items))}
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
