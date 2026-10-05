import smcfLogo from "@/assets/newsmcflogo.png";
import landingBackground from "@/assets/landingbackground.jpg";
import { LoadingScreen } from "@/components/LoadingScreen";
import SEO from "@/components/SEO";
import { StyledSMCF } from "@/components/StyledSMCF";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  Shield,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
  ArrowRight,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
// Test components removed; render the real AdminDashboard
import OrganizationDialog from "@/components/OrganizationDialog";
import MemberMessageComposer from "@/components/MemberMessageComposer";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

type CycleData = {
  currentCycle: number;
  daysLeft: number;
  paidMembers: number;
  totalMembers: number;
  collectedAmount: number;
  totalAmount: number;
  nextRecipient: string;
  cycleStartDate?: string;
  cycleEndDate?: string;
};

type UserData = {
  _id?: string;
  id?: string;
  memberId?: string;
  member_id?: string;
  phoneNumber?: string;
  phone?: string;
  total_contributed?: number;
  total_received?: number;
  position?: number;
  payment_status?: string;
  token?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
};

type CurrentUser = UserData & {
  cycleData?: CycleData;
};

type Member = Record<string, unknown>;
type Announcement = Record<string, unknown>;

const AdminDashboard = lazy(() => import("@/components/AdminDashboard"));
const Dashboard = lazy(() => import("@/components/Dashboard"));

const getAuthHeaders = (): HeadersInit | undefined => {
  const authHeaders = authService.getAuthHeaders() as Record<string, string>;
  return Object.keys(authHeaders).length ? authHeaders : undefined;
};

const Index = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [showOrganization, setShowOrganization] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // userRole is simplified for UI: 'admin' means any administrative role (treasurer, secretary, etc.)
  const [userRole, setUserRole] = useState<"admin" | "member" | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const currentUserPhone = currentUser?.phoneNumber || currentUser?.phone;
  const hasCurrentUser = Boolean(currentUser);

  // Restore authentication on page load
  useEffect(() => {
    const restoreAuth = () => {
      const savedUser = authService.getUser();
      const token = authService.getToken();

      if (savedUser && token) {
        console.log("Restoring authentication:", savedUser);
        const adminRoles = new Set([
          "admin",
          "treasurer",
          "secretary",
          "auditor",
          "superadmin",
          "viewer",
        ]);
        const normalizedRole: "admin" | "member" = adminRoles.has(
          savedUser.role
        )
          ? "admin"
          : "member";
        setUserRole(normalizedRole);

        if (normalizedRole === "admin") {
          setCurrentUser({
            ...savedUser,
            cycleData: {
              currentCycle: 0,
              daysLeft: 0,
              paidMembers: 0,
              totalMembers: 0,
              collectedAmount: 0,
              totalAmount: 0,
              nextRecipient: "No Active Cycle",
            },
          });
        } else {
          // Restore member with all required fields
          const memberUserData = {
            ...savedUser,
            _id: savedUser._id || savedUser.id,
            memberId: savedUser.memberId || savedUser.member_id,
            phoneNumber: savedUser.phoneNumber || savedUser.phone,
            total_contributed: savedUser.total_contributed || 0,
            total_received: savedUser.total_received || 0,
            position: savedUser.position || 0,
            payment_status: savedUser.payment_status || "pending",
          };
          setCurrentUser(memberUserData);
        }
      }
      setIsLoading(false);
    };

    restoreAuth();
  }, []);

  // Fetch data when admin logs in - MUST be before any conditional returns
  useEffect(() => {
    if (userRole === "admin" && hasCurrentUser) {
      // Silent background data fetch without UI flicker
      const fetchData = async () => {
        try {
          // Fetch all data in parallel for better performance
          // Use lean query for members to exclude large profile pictures
          const [cycleRes, membersRes, announcementsRes] = await Promise.all([
            fetch(`${API_BASE}/api/cycles/current`, {
              headers: getAuthHeaders(),
            }),
            fetch(`${API_BASE}/api/members?lean=true`, {
              headers: getAuthHeaders(),
            }),
            fetch(`${API_BASE}/api/announcements`, {
              headers: getAuthHeaders(),
            }),
          ]);

          const cycleData = await cycleRes.json();
          const membersData = await membersRes.json();
          const announcementsData = await announcementsRes.json();

          // Batch state updates to prevent multiple re-renders
          // Update members silently - use simple length check instead of expensive JSON.stringify
          setMembers((prev) => {
            const newData = Array.isArray(membersData) ? membersData : [];
            // Only update if length changed or data is new
            if (!prev || prev.length !== newData.length) {
              return newData;
            }
            return prev;
          });

          // Update announcements silently
          setAnnouncements((prev) => {
            const newData = Array.isArray(announcementsData)
              ? announcementsData
              : [];
            if (!prev || prev.length !== newData.length) {
              return newData;
            }
            return prev;
          });

          // Update cycle data silently
          if (cycleData.success) {
            const cycle = cycleData.data;
            setCurrentUser((prev) => {
              if (!prev) return prev;
              
              // Safe date parsing with validation
              const parseDate = (dateInput: unknown) => {
                if (!dateInput) return "Not Set";
                const date =
                  dateInput instanceof Date
                    ? dateInput
                    : new Date(String(dateInput));
                return isNaN(date.getTime()) ? "Not Set" : date.toLocaleDateString();
              };
              
              const newCycleData = {
                currentCycle: cycle.cycle_number || 0,
                daysLeft: cycle.days_left || 0,
                paidMembers: cycle.paid_members_count || 0,
                totalMembers: cycle.total_members || 0,
                collectedAmount: cycle.total_amount_collected || 0,
                totalAmount: cycle.expected_amount || 0,
                nextRecipient: cycle.next_recipient?.name || "TBD",
                cycleStartDate: parseDate(cycle.start_date),
                cycleEndDate: parseDate(cycle.end_date),
              };
              // Only update if cycle data changed
              if (
                JSON.stringify(prev.cycleData) !== JSON.stringify(newCycleData)
              ) {
                return { ...prev, cycleData: newCycleData };
              }
              return prev;
            });
          }
        } catch (err) {
          console.error("Error fetching data:", err);
        }
      };

      // Initial fetch
      fetchData();
      // Silent refresh every 15 seconds for real-time updates (skip when tab is hidden)
      const interval = setInterval(() => {
        if (document.hidden) return;
        fetchData();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [userRole, hasCurrentUser, currentUserPhone]); // Use phone as dependency to avoid infinite loops

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { label: "Home", href: "#home" },
    { label: "About", href: "#about" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "Cycles", href: "#cycles" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  const handleLogin = (role: string, userData: UserData) => {
    console.log("handleLogin called with:", { role, userData });

    // Normalize role: treat several roles as admin for UI access
    const adminRoles = new Set([
      "admin",
      "treasurer",
      "secretary",
      "auditor",
      "superadmin",
      "viewer",
    ]);
    const normalizedRole: "admin" | "member" = adminRoles.has(role)
      ? "admin"
      : "member";
    setUserRole(normalizedRole);

    // Save authentication data to localStorage
    const userToSave = { ...userData, role };
    authService.saveAuth(
      userData.token || authService.getToken() || "",
      userToSave
    );

    // Add cycle data for admin users - will be updated by useEffect
    if (normalizedRole === "admin") {
      const enhancedUserData = {
        ...userData,
        cycleData: {
          currentCycle: 0,
          daysLeft: 0,
          paidMembers: 0,
          totalMembers: 0,
          collectedAmount: 0,
          totalAmount: 0,
          nextRecipient: "No Active Cycle",
          cycleStartDate: "Not Started",
          cycleEndDate: "Not Set",
        },
      };
      console.log("Setting admin user data:", enhancedUserData);
      setCurrentUser(enhancedUserData);
    } else {
      // Ensure member data has all required fields
      const memberUserData = {
        ...userData,
        _id: userData._id || userData.id,
        memberId: userData.memberId || userData.member_id,
        phoneNumber: userData.phoneNumber || userData.phone,
        total_contributed: userData.total_contributed || 0,
        total_received: userData.total_received || 0,
        position: userData.position || 0,
        payment_status: userData.payment_status || "pending",
      };
      console.log("Setting member user data:", memberUserData);
      setCurrentUser(memberUserData);
    }

    setShowAuth(false);
    console.log("Login process completed");
  };

  const handleLogout = () => {
    // Clear authentication from localStorage
    authService.clearAuth();
    setUserRole(null);
    setCurrentUser(null);
    setMembers([]);
    setAnnouncements([]);
  };

  // Silent refresh members without UI flicker
  const refreshMembers = async () => {
    try {
      const membersRes = await fetch(`${API_BASE}/api/members?lean=true`, {
        headers: getAuthHeaders(),
      });
      const membersData = await membersRes.json();

      // Only update if length changed - avoid expensive JSON.stringify
      setMembers((prev) => {
        const newData = Array.isArray(membersData) ? membersData : [];
        if (!prev || prev.length !== newData.length) {
          return newData;
        }
        return prev;
      });
    } catch (err) {
      console.error("Error refreshing members:", err);
    }
  };

  if (userRole && currentUser) {
    console.log("Rendering user interface with:", { userRole, currentUser });
    if (userRole === "admin") {
      console.log("Rendering admin dashboard");
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5">
          <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={smcfLogo} alt="SMCF - Smart Moves Cash Flow Admin Dashboard Logo" className="w-10 h-10" />
                <div>
                  <h1 className="text-xl"><StyledSMCF /> Admin</h1>
                  <p className="text-xs text-muted-foreground">
                    Smart Moves Cash Flow
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Welcome, {currentUser.name}
                </span>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  Logout
                </Button>
              </div>
            </div>
          </header>
          <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
            <Suspense fallback={<LoadingScreen />}>
              <AdminDashboard
                userData={currentUser}
                members={members}
                announcements={announcements}
                onLogout={handleLogout}
                refreshMembers={refreshMembers}
              />
            </Suspense>
          </main>
        </div>
      );
    }
    console.log("Rendering member dashboard");
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Dashboard
          userRole={userRole}
          userData={currentUser}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  console.log(
    "Main render - userRole:",
    userRole,
    "currentUser:",
    currentUser,
    "showAuth:",
    showAuth
  );

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#162f2d]">
      <SEO
        title="SMCF - Smart Moves Cash Flow | Digital Table Banking Platform Kenya"
        description="Digital savings and contribution platform for Kenya. Track wallets, cycle contributions, payments and growth in one secure place."
        keywords="table banking Kenya, digital chama, SMCF, savings wallet Kenya, contribution cycles, smart moves cash flow, member dashboard"
        url="https://smcf.app"
      />

      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
          isScrolled
            ? "border-[#e8dec5] bg-[rgba(250,247,242,0.84)] backdrop-blur-xl shadow-[0_18px_45px_rgba(20,36,35,0.08)]"
            : "border-transparent bg-[rgba(250,247,242,0.6)] backdrop-blur-sm"
        }`}
      >
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#home" className="flex items-center gap-3">
            <img src={smcfLogo} alt="SMCF" className="h-11 w-11 rounded-xl object-cover shadow-sm sm:h-12 sm:w-12" />
            <div>
              <div className="text-lg font-bold tracking-tight text-[#123026] sm:text-xl">
                <StyledSMCF />
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#527166]">Smart Moves Cash Flow</div>
            </div>
          </a>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-[#345449] transition-colors hover:text-[#123026]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <a
              href="/sacco/auth"
              className="rounded-full border border-[#d9c4a0] bg-[#fffaf3] px-4 py-2 text-sm font-medium text-[#16352f] transition hover:border-[#b69960] hover:bg-[#f8f1e9]"
            >
              Login
            </a>
            <a
              href="/sacco/auth"
              className="rounded-full bg-[#b8924a] px-4 py-2 text-sm font-semibold text-[#162f2d] shadow-[0_12px_30px_rgba(184,146,74,0.24)] transition hover:-translate-y-0.5 hover:bg-[#c59d54]"
            >
              Join SMCF
            </a>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Open menu"
              className="rounded-full border border-[#dfe9e3] bg-white p-2 text-[#123026]"
              onClick={() => setMobileMenuOpen((value) => !value)}
            >
              <div className="flex h-4 w-5 flex-col justify-between">
                <span className="block h-0.5 w-full rounded-full bg-current" />
                <span className="block h-0.5 w-full rounded-full bg-current" />
                <span className="block h-0.5 w-full rounded-full bg-current" />
              </div>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#e6eee8] bg-white/95 px-4 py-4 shadow-lg md:hidden">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-[#254a3d] hover:bg-[#f3f7f4]"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 flex gap-2 pt-2">
                <a href="/sacco/auth" className="flex-1 rounded-full border border-[#dfe9e3] px-4 py-2 text-center text-sm font-medium text-[#123026]">
                  Login
                </a>
                <a href="/sacco/auth" className="flex-1 rounded-full bg-[#123026] px-4 py-2 text-center text-sm font-semibold text-white">
                  Join SMCF
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="pt-20">
        <section id="home" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(184,146,74,0.15),transparent_24%),radial-gradient(circle_at_center,_rgba(18,45,42,0.08),transparent_40%),linear-gradient(135deg,#f7f3ee_0%,#f5f0e8_42%,#efeae3_100%)]" />
          <div className="container relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div className="animate-fade-in-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e2d2a3] bg-[rgba(255,251,246,0.82)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#85704f] shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-[#b8924a]" />
                global wealth management
              </div>

              <h1 className="max-w-[14ch] text-4xl font-black leading-[0.9] tracking-[-0.08em] text-[#162f2d] sm:text-5xl lg:text-7xl">
                Wealth, managed with global perspective.
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-8 text-[#536c67] sm:text-xl">
                A refined wealth platform for savings, wallets, contribution cycles and long-term capital planning—designed for members who value trust, discretion and a globally informed approach to financial growth.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/sacco/auth"
                  className="inline-flex items-center justify-center rounded-full bg-[#b8924a] px-6 py-3.5 text-base font-semibold text-[#162f2d] shadow-[0_18px_40px_rgba(184,146,74,0.28)] transition hover:-translate-y-0.5 hover:bg-[#c99f51]"
                >
                  Join SMCF
                </a>
                <a
                  href="/sacco/auth"
                  className="inline-flex items-center justify-center rounded-full border border-[#d7c39e] bg-[rgba(255,255,255,0.88)] px-6 py-3.5 text-base font-semibold text-[#16352f] transition hover:border-[#b8924a] hover:bg-[#fffaf3]"
                >
                  Login
                </a>
              </div>

              <div className="mt-5 flex items-center gap-3 text-sm text-[#4d645d]">
                <button
                  type="button"
                  onClick={() => setShowOrganization(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#dfe9e3] bg-white px-3 py-1.5 font-medium text-[#123026] transition hover:bg-[#f3f7f4]"
                >
                  Explore how it works
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-9 grid gap-3 border-t border-[#e6dbc0] pt-6 sm:grid-cols-3">
                {[
                  { label: "Global standards", icon: Shield },
                  { label: "Portfolio visibility", icon: TrendingUp },
                  { label: "Private member access", icon: Users },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#efe7d8] bg-[rgba(255,255,255,0.72)] p-3 shadow-[0_12px_28px_rgba(17,45,42,0.03)]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5ebd4] text-[#112d2a]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-[#31584b]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-slide-in-right">
              <div className="relative mx-auto max-w-xl rounded-[30px] border border-[#eedcb1] bg-white/85 p-4 shadow-[0_30px_80px_rgba(16,45,40,0.12)] backdrop-blur-xl sm:p-5">
                <div className="absolute -left-8 top-10 hidden h-32 w-32 rounded-full bg-[#f3e3b3] blur-3xl lg:block" />
                <div className="absolute -right-10 bottom-0 hidden h-32 w-32 rounded-full bg-[#dfe9e3] blur-3xl lg:block" />

                <div className="relative rounded-[22px] border border-[#ebf0ec] bg-[linear-gradient(135deg,#fffdf9,#f5efe4)] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#648073]">Member dashboard</p>
                      <h2 className="mt-1 text-xl font-bold text-[#123026]">Your account overview</h2>
                    </div>
                    <div className="rounded-full bg-[#ebf7f0] px-2.5 py-1 text-xs font-semibold text-[#1c6c4d]">Active cycle</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#123026] p-4 text-white">
                      <p className="text-xs uppercase tracking-[0.14em] text-white/70">Savings</p>
                      <div className="mt-3 text-2xl font-bold">KES 26,400</div>
                      <p className="mt-1 text-xs text-white/75">+ KES 1,260 this month</p>
                    </div>
                    <div className="rounded-2xl border border-[#dfe9e3] bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#648073]">Wallet</p>
                      <div className="mt-3 text-2xl font-bold text-[#123026]">KES 8,750</div>
                      <p className="mt-1 text-xs text-[#527166]">Available balance</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#dfe9e3] bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-[#648073]">Contribution status</p>
                        <p className="mt-2 text-lg font-bold text-[#123026]">Cycle 14</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#648073]">Paid</p>
                        <p className="font-semibold text-[#123026]">8 / 10</p>
                      </div>
                    </div>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#ebf0ec]">
                      <div className="h-full w-[80%] rounded-full bg-[#1d6d4d]" />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
                    <div className="rounded-2xl border border-[#dfe9e3] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#648073]">Growth</p>
                        <span className="text-xs font-semibold text-[#1c6c4d]">+12.4%</span>
                      </div>
                      <div className="flex h-20 items-end gap-2">
                        {[32, 44, 40, 62, 58, 86, 94].map((height, index) => (
                          <div
                            key={index}
                            className="flex-1 rounded-t-xl bg-gradient-to-t from-[#123026] to-[#4d9d75]"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#dfe9e3] bg-[#edf7f1] p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#648073]">Recent</p>
                      <div className="mt-3 space-y-2 text-sm text-[#123026]">
                        <div className="flex items-center justify-between rounded-xl bg-white px-2 py-1.5">
                          <span>Contribution</span>
                          <span className="font-semibold">KES 224</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-white px-2 py-1.5">
                          <span>Wallet</span>
                          <span className="font-semibold">KES 750</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#eaf0eb] bg-white/70">
          <div className="container mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:px-6">
            {[
              "Secure Digital Records",
              "Transparent Transactions",
              "Member-Focused",
              "Accessible Anywhere",
            ].map((item) => (
              <div key={item} className="flex items-center justify-center gap-3 rounded-2xl border border-[#edf2ee] bg-[#f9fbf9] px-4 py-3 text-center text-sm font-medium text-[#2a5a49]">
                <CheckCircle2 className="h-4 w-4 text-[#1d6d4d]" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a5a49]">About SMCF</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#123026] sm:text-4xl">
                Built for members who want global wealth management with clarity and confidence.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#4d645d]">
                SMCF brings together savings, wallet planning, contribution cycles and capital tracking in one disciplined platform. It replaces fragmented table-banking experience with a thoughtfully designed, globally minded system built around trust, accountability, and long-term financial stewardship.
              </p>
              <ul className="mt-7 space-y-3 text-[#264e43]">
                {[
                  "Track savings and wallet activity in one place",
                  "Stay informed through transparent contribution records",
                  "Access member records without confusion or paperwork",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#edf7f1] text-[#1d6d4d]">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span className="text-base font-medium">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-[30px] bg-[linear-gradient(135deg,rgba(18,48,38,0.08),rgba(206,179,84,0.10))]" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Savings", value: "Track balances", icon: Wallet },
                  { label: "Wallet", value: "Manage funds", icon: Wallet },
                  { label: "Cycles", value: "Join and track", icon: TrendingUp },
                  { label: "Records", value: "See transactions", icon: FileText },
                ].map(({ label, value, icon: Icon }, index) => (
                  <div
                    key={label}
                    className={`rounded-[26px] border border-[#e6eee8] bg-white p-5 shadow-[0_20px_50px_rgba(17,53,39,0.06)] ${
                      index === 0 || index === 3 ? "sm:translate-y-4" : ""
                    }`}
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf7f1] text-[#123026]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#648073]">{label}</p>
                    <p className="mt-3 text-xl font-bold text-[#123026]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-[#f0f4ef] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a5a49]">How it works</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#123026] sm:text-4xl">Simple steps. Clear progress.</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-4">
              {[
                { number: "01", title: "Create your account", text: "Register and set up your secure member profile." },
                { number: "02", title: "Access your tools", text: "Open your wallet, savings and member dashboard." },
                { number: "03", title: "Save and contribute", text: "Join cycles and keep your financial activity organised." },
                { number: "04", title: "Track progress", text: "Review contributions, payouts and records over time." },
              ].map((item) => (
                <div key={item.number} className="rounded-[28px] border border-[#e7efe9] bg-white p-5 shadow-[0_15px_30px_rgba(17,53,39,0.04)]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#123026] text-lg font-black text-white">{item.number}</div>
                  <div className="mb-3 text-2xl font-bold text-[#123026]">{item.title}</div>
                  <p className="text-base leading-7 text-[#4d645d]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#85704f]">Everything you need</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#162f2d] sm:text-4xl">A more elevated standard for financial life.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[
              { icon: Wallet, title: "Savings", text: "Track your savings and growth with clear, consistent visibility." },
              { icon: Smartphone, title: "Digital Wallet", text: "Manage available funds and monitor transaction activity with confidence." },
              { icon: TrendingUp, title: "Contribution Cycles", text: "Join cycles, track your position and stay on top of each contribution." },
              { icon: FileText, title: "Financial Records", text: "View a complete history of member transactions and account activity." },
              { icon: CheckCircle2, title: "Digital Receipts", text: "Keep a clear record of successful payments and confirmations." },
              { icon: Shield, title: "Secure Account", text: "Access your information through a personal, protected member account." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="group rounded-[30px] border border-[#e7dbc0] bg-[linear-gradient(180deg,#ffffff,#faf5ee)] p-6 shadow-[0_18px_38px_rgba(17,45,42,0.04)] transition hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(17,45,42,0.09)]">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7ebd4] text-[#162f2d] transition group-hover:bg-[#b8924a] group-hover:text-[#162f2d]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-[#123026]">{title}</h3>
                <p className="mt-3 text-base leading-7 text-[#4d645d]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="cycles" className="bg-[linear-gradient(135deg,#162f2d,#183f39_35%,#122b2b)] py-16 text-white sm:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e7dcc0]">Contribution cycles</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">A clear path from contribution to payout.</h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#d7e5df]">
                Members can see available positions, select a contribution slot, make payment and monitor cycle progress through a simple, transparent flow.
              </p>
              <a
                href="/sacco/auth"
                className="mt-8 inline-flex items-center rounded-full bg-[#b8924a] px-5 py-3 text-base font-semibold text-[#162f2d] shadow-[0_18px_40px_rgba(184,146,74,0.28)] transition hover:-translate-y-0.5 hover:bg-[#c99f51]"
              >
                Explore Cycles
              </a>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/5 p-4 shadow-[0_25px_70px_rgba(0,0,0,0.18)] backdrop-blur-sm sm:p-5">
              <div className="rounded-[22px] bg-[#f5f7f2] p-4 text-[#123026] sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#648073]">Available positions</p>
                    <h3 className="mt-1 text-2xl font-black">Cycle 14</h3>
                  </div>
                  <div className="rounded-full bg-[#edf7f1] px-2.5 py-1 text-xs font-semibold text-[#1c6c4d]">Next payout</div>
                </div>

                <div className="space-y-3">
                  {[
                    ["Position 1", "KES 224", "Paid"],
                    ["Position 2", "KES 224", "Pending"],
                    ["Position 3", "KES 224", "Pending"],
                    ["Position 4", "KES 224", "Pending"],
                  ].map(([name, amount, status]) => (
                    <div key={name} className="flex items-center justify-between rounded-2xl border border-[#e6eee8] bg-white px-3 py-3">
                      <div>
                        <div className="text-sm font-semibold text-[#123026]">{name}</div>
                        <div className="text-xs text-[#648073]">{amount}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${status === "Paid" ? "bg-[#edf7f1] text-[#1c6c4d]" : "bg-[#f8f3df] text-[#825f00]"}`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a5a49]">Member experience</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#123026] sm:text-4xl">Your finances. One simple view.</h2>
          </div>

          <div className="rounded-[32px] border border-[#e7efe9] bg-white p-4 shadow-[0_30px_80px_rgba(17,53,39,0.06)] sm:p-6 lg:p-7">
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[28px] bg-[#f5f7f2] p-4 sm:p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#648073]">Member dashboard</p>
                    <h3 className="mt-1 text-2xl font-black text-[#123026]">Overview</h3>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#1c6c4d]">This month</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Total savings", "KES 26,400"],
                    ["Wallet", "KES 8,750"],
                    ["Active cycle", "Cycle 14"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-[#e6eee8] bg-white p-3 shadow-sm">
                      <div className="text-xs uppercase tracking-[0.12em] text-[#648073]">{label}</div>
                      <div className="mt-2 text-lg font-bold text-[#123026]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#e6eee8] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#123026]">Financial activity</p>
                    <span className="text-xs font-medium text-[#1c6c4d]">+12.4%</span>
                  </div>
                  <div className="flex h-28 items-end gap-2">
                    {[22, 38, 28, 52, 62, 74, 92].map((height, index) => (
                      <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-[#123026] to-[#4d9d75]" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] bg-[#123026] p-5 text-white">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#dfe9e3]">Next contribution</p>
                  <span className="rounded-full bg-[#1f6d4d] px-2.5 py-1 text-[10px] font-semibold">Due in 3 days</span>
                </div>

                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-sm text-[#dfe9e3]">Member contribution</div>
                  <div className="mt-2 text-3xl font-black">KES 224</div>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    ["Contribution", "KES 224"],
                    ["Wallet deposit", "KES 750"],
                    ["Loan payment", "KES 1,200"],
                  ].map(([label, amount]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2.5">
                      <span className="text-sm text-[#dfe9e3]">{label}</span>
                      <span className="font-semibold">{amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="bg-[#f0f4ef] py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a5a49]">Built around transparency</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#123026] sm:text-4xl">Members can access the information they need, when they need it.</h2>
              <p className="mt-5 max-w-lg text-lg leading-8 text-[#4d645d]">
                From transactions and contributions to payment records and account details, the platform is designed to give members clear visibility into their activity and progress.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  "Transactions",
                  "Contributions",
                  "Payment records",
                  "Member account info",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#dfe9e3] bg-white p-3 text-sm font-medium text-[#264e43] shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#e7efe9] bg-white p-5 shadow-[0_25px_70px_rgba(17,53,39,0.06)] sm:p-6">
              <div className="rounded-[24px] bg-[#edf7f1] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123026] text-white">
                    <Shield className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1d6d4d]">Secure access</span>
                </div>

                <div className="space-y-4">
                  {[
                    ["Transactions", "Visible & organised"],
                    ["Account access", "Protected member login"],
                    ["Records", "Readable and reviewable"],
                  ].map(([title, value]) => (
                    <div key={title} className="rounded-2xl bg-white p-3 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#648073]">{title}</p>
                      <p className="mt-2 text-lg font-bold text-[#123026]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a5a49]">Community</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#123026] sm:text-4xl">Financial progress works better together.</h2>
          </div>

          <div className="rounded-[30px] border border-[#e7efe9] bg-white p-6 shadow-[0_20px_50px_rgba(17,53,39,0.05)]">
            <div className="grid gap-6 md:grid-cols-4 lg:grid-cols-7">
              {[
                "Valinyala A.I",
                "Excel Baraka",
                "Joy Okello",
                "Rosemary Njeri",
                "Stephen Oduor",
                "Joshua Oduor",
                "Dyvine Eshiuma",
              ].map((name, index) => (
                <div key={name} className="flex flex-col items-center justify-center rounded-[24px] border border-[#e7efe9] bg-[#f8faf8] p-4 text-center">
                  <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full font-bold text-white ${index % 2 === 0 ? "bg-[#123026]" : "bg-[#1a6d4f]"}`}>
                    {name.slice(0, 1)}
                  </div>
                  <div className="text-sm font-semibold text-[#123026]">{name}</div>
                  <div className="text-xs text-[#648073]">Member</div>
                </div>
              ))}
            </div>
            <div className="mt-6 h-20 rounded-[24px] bg-[radial-gradient(circle_at_center,_rgba(29,109,77,0.12),transparent_55%)]" />
          </div>
        </section>

        <section id="faq" className="bg-[#f0f4ef] py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a5a49]">FAQ</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#123026] sm:text-4xl">Frequently asked questions</h2>
            </div>

            <div className="space-y-3">
              {[
                ["What is SMCF?", "SMCF is a digital community finance platform built to help members save, contribute and monitor their financial activity in one place."],
                ["How do I become a member?", "You can join through the SMCF member portal and complete the registration process for your account."],
                ["How do contribution cycles work?", "Members contribute on a planned schedule and track their cycle position and contribution status through the member dashboard."],
                ["How do I make payments?", "Payments are made through the platform flow and the supported mobile money payment process used by the application."],
                ["Can I view my transactions?", "Yes. The platform provides member access to transaction history and account information."],
                ["Can I access my wallet?", "Yes. The wallet is available through the member account and can be reviewed alongside your savings and activity."],
                ["How do I contact SMCF?", "You can use the contact details shown at the footer or send a message through the member portal."],
              ].map(([question, answer]) => (
                <details key={question} className="group rounded-[22px] border border-[#dfe9e3] bg-white p-4 shadow-sm open:shadow-md" open={question === "What is SMCF?"}>
                  <summary className="cursor-pointer list-none text-left text-lg font-semibold text-[#123026]">
                    {question}
                  </summary>
                  <p className="mt-3 text-base leading-7 text-[#4d645d]">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-6xl rounded-[34px] bg-[linear-gradient(135deg,#162f2d,#183f39_55%,#122b2b)] px-6 py-10 text-center text-white shadow-[0_25px_70px_rgba(22,47,45,0.22)] sm:px-8 lg:px-12 lg:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e7dcc0]">Start today</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Ready to take control of your financial journey?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#d7e5df]">
              Join a growing community using digital tools to save, contribute and manage their financial activities.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="/sacco/auth" className="inline-flex items-center justify-center rounded-full bg-[#b8924a] px-6 py-3.5 text-base font-semibold text-[#162f2d] shadow-[0_18px_40px_rgba(184,146,74,0.28)] transition hover:-translate-y-0.5 hover:bg-[#c99f51]">
                Join SMCF
              </a>
              <a href="/sacco/auth" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-6 py-3.5 text-base font-semibold text-white transition hover:bg-white/5">
                Login to your account
              </a>
            </div>
          </div>
        </section>

        <section className="border-y border-[#e7eee9] bg-[#fbfcfa] px-4 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#85704f]">Featured Organizations &amp; Brands</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#123026] sm:text-4xl">Built alongside trusted names.</h2>
              <p className="mt-4 text-base leading-7 text-[#536c67] sm:text-lg">
                Working with trusted organizations and brands to strengthen financial inclusion, technology and community empowerment.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
              {["Safaricom", "Co-operative Bank of Kenya", "Jubilee Insurance", "SM Digital Solutions", "SmartMoves Books"].map((brand, index) => (
                <div
                  key={brand}
                  className="group flex min-h-[132px] animate-fade-in-up flex-col items-center justify-center rounded-[22px] border border-[#e5ece7] bg-white px-4 py-5 text-center shadow-[0_12px_28px_rgba(17,53,39,0.04)] transition duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(17,53,39,0.09)]"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-[#cbd9d0] bg-[#f7faf7] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6d8278] transition group-hover:border-[#b8924a]">
                    Official logo asset pending
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-5 text-[#123026]">{brand}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-center text-xs tracking-[0.08em] text-[#789087]">Building stronger communities through finance, technology and opportunity.</p>
          </div>
        </section>
      </main>

      <footer id="contact" className="bg-[#0d261f] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src={smcfLogo} alt="SMCF" className="h-11 w-11 rounded-xl object-cover" />
              <div>
                <div className="text-xl font-bold"><StyledSMCF /></div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#dfe9e3]">Smart Moves Development Agency</div>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-base leading-7 text-[#d7e5df]">Powering Grassroots Financial Freedom</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#dfe9e3]">Navigation</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#d7e5df]">
              {navItems.map((item) => (
                <li key={item.label}><a href={item.href} className="transition hover:text-white">{item.label}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#dfe9e3]">Member</h3>
            <ul className="mt-4 space-y-3 text-sm text-[#d7e5df]">
              <li><a href="/sacco/auth" className="transition hover:text-white">Login</a></li>
              <li><a href="/sacco/auth" className="transition hover:text-white">Join SMCF</a></li>
              <li><a href="/sacco/auth" className="transition hover:text-white">Member Account</a></li>
            </ul>

            <div className="mt-6 text-sm text-[#d7e5df]">
              <div>Email: <a href="mailto:administrator@smcf.app" className="hover:text-white">administrator@smcf.app</a></div>
              <div className="mt-2">Phone: <a href="tel:+254759097157" className="hover:text-white">+254 759 097 157</a></div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-5 text-sm text-[#d7e5df]">
            © {new Date().getFullYear()} SMART MOVES DEVELOPMENT AGENCY
          </div>
        </div>
      </footer>

      <OrganizationDialog open={showOrganization} onOpenChange={setShowOrganization} />
    </div>
  );
};

export default Index;
