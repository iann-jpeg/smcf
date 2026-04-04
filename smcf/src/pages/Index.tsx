import smcfLogo from "@/assets/newsmcflogo.png";
import landingBackground from "@/assets/landingbackground.jpg";
import AdminDashboard from "@/components/AdminDashboard";
import AdminSetup from "@/components/AdminSetup";
import AuthDialog from "@/components/AuthDialog";
import Dashboard from "@/components/Dashboard";
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
import { useEffect, useState } from "react";
// Test components removed; render the real AdminDashboard
import OrganizationDialog from "@/components/OrganizationDialog";
import MemberMessageComposer from "@/components/MemberMessageComposer";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

const Index = () => {
  const [setupComplete, setSetupComplete] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showOrganization, setShowOrganization] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // userRole is simplified for UI: 'admin' means any administrative role (treasurer, secretary, etc.)
  const [userRole, setUserRole] = useState<"admin" | "member" | null>(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

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
    if (userRole === "admin" && currentUser) {
      // Silent background data fetch without UI flicker
      const fetchData = async () => {
        try {
          // Fetch all data in parallel for better performance
          // Use lean query for members to exclude large profile pictures
          const [cycleRes, membersRes, announcementsRes] = await Promise.all([
            fetch(`${API_BASE}/api/cycles/current`, {
              headers: { ...authService.getAuthHeaders() },
            }),
            fetch(`${API_BASE}/api/members?lean=true`, {
              headers: { ...authService.getAuthHeaders() },
            }),
            fetch(`${API_BASE}/api/announcements`, {
              headers: { ...authService.getAuthHeaders() },
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
              const parseDate = (dateStr: any) => {
                if (!dateStr) return "Not Set";
                const date = new Date(dateStr);
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
      // Silent refresh every 15 seconds for real-time updates
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [userRole, currentUser?.phone]); // Use phone as dependency to avoid infinite loops

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show admin setup if needed - MUST be after all hooks
  if (!setupComplete) {
    return <AdminSetup onSetupComplete={() => setSetupComplete(true)} />;
  }

  const handleLogin = (role: string, userData: any) => {
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
        headers: { ...authService.getAuthHeaders() },
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
            <AdminDashboard
              userData={currentUser}
              members={members}
              announcements={announcements}
              onLogout={handleLogout}
              refreshMembers={refreshMembers}
            />
          </main>
        </div>
      );
    }
    console.log("Rendering member dashboard");
    return (
      <Dashboard
        userRole={userRole}
        userData={currentUser}
        onLogout={handleLogout}
      />
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
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5">
      {/* SEO Component for dynamic meta tags */}
      <SEO 
        title="SMCF - Smart Moves Cash Flow | Digital Table Banking Platform Kenya"
        description="Best digital table banking platform in Kenya. Automated KES 224 contributions, M-Pesa integration, personal savings wallet with 3% interest, member loans. Join SMCF chama today!"
        keywords="table banking Kenya, digital chama, SMCF, chama management, group savings Kenya, M-Pesa table banking, automated contributions, savings wallet, member loans, financial empowerment Kenya, digital banking platform, table banking app"
        url="https://smcf.app"
      />

      {/* Breadcrumb Schema */}
      <nav aria-label="Breadcrumb" className="sr-only" itemScope itemType="https://schema.org/BreadcrumbList">
        <ol>
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <a itemProp="item" href="https://smcf.app">
              <span itemProp="name">Home</span>
            </a>
            <meta itemProp="position" content="1" />
          </li>
        </ol>
      </nav>

      
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/90 backdrop-blur-md animate-fade-in">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 hover:scale-105 transition-transform duration-300 cursor-pointer">
            <img
              src={smcfLogo}
              alt="SMCF - Smart Moves Cash Flow Logo - Digital Table Banking Platform"
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 hover:rotate-12 transition-transform duration-300"
            />
            <div>
              <h1 className="text-base sm:text-xl">
                <StyledSMCF />
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Smart Moves Cash Flow
              </p>
              <p className="text-[9px] sm:text-[10px] text-primary/70 font-medium italic">
                Digital Table Banking Made Simple
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="flex items-center gap-1">
              <a
                href="#sacco-portal"
                className="text-[10px] sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-primary border border-primary/30 hover:bg-primary/10 transition-colors duration-200 whitespace-nowrap">
                SACCO
              </a>
              <a
                href="#non-member-loans"
                className="text-[10px] sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-200 whitespace-nowrap">
                <span className="sm:hidden">Loan</span>
                <span className="hidden sm:inline">Non-Member Loan</span>
              </a>
            </nav>
            <ThemeToggle />
            <Button
              onClick={() => setShowAuth(true)}
              variant="default"
              size="sm"
              className="text-xs sm:text-sm px-3 sm:px-4 hover-glow hover-shine">
              Login / Register
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-28 md:pt-32 pb-10 sm:pb-16 md:pb-20 px-3 sm:px-4 overflow-hidden relative">
        {/* Background Image */}
        <img
          src={landingBackground}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 z-0 h-full w-full object-cover opacity-15 pointer-events-none"
        />
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left side - Text content */}
            <div className="animate-slide-in-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-primary bg-clip-text text-transparent">
                Digital Table Banking Platform for Kenya
              </h1>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-4 animate-fade-in-left animation-delay-200">
                <StyledSMCF /> - Smart Moves Cash Flow
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 animate-fade-in-left animation-delay-300">
                Kenya's #1 automated chama management system.{" "}
                <br className="hidden sm:block" />
                Contribute every 5 days • 3% monthly interest • Instant M-Pesa payments
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-10 animate-fade-in-left animation-delay-400">
                <Button
                  size="lg"
                  onClick={() => setShowAuth(true)}
                  className="text-sm sm:text-base md:text-lg py-4 sm:py-5 md:py-6 px-6 sm:px-8 hover-glow hover-shine">
                  Join <StyledSMCF className="inline" /> Today - Start Saving
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-sm sm:text-base md:text-lg py-4 sm:py-5 md:py-6 px-6 sm:px-8 hover-lift"
                  onClick={() => setShowOrganization(true)}>
                  Learn How It Works
                </Button>
              </div>
              
              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground animate-fade-in-left animation-delay-500">
                <div className="flex items-center gap-2 hover:text-financial-success transition-colors">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-financial-success" />
                  <span>Bank-Level Security</span>
                </div>
                <div className="flex items-center gap-2 hover:text-financial-success transition-colors">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-financial-success" />
                  <span>1000+ Active Members</span>
                </div>
                <div className="flex items-center gap-2 hover:text-financial-success transition-colors">
                  <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-financial-success" />
                  <span>M-Pesa Verified Partner</span>
                </div>
              </div>
            </div>

            {/* Right side - Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6 animate-slide-in-right">
              <Card className="text-center hover-lift hover-glow animate-scale-in animation-delay-200">
                <CardContent className="pt-6 pb-6">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-financial-success mb-3 animate-float">
                    Contribute
                  </div>
                  <div className="text-sm sm:text-base text-muted-foreground">
                    Every 5 Days
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Consistent & Affordable Contributions
                  </div>
                </CardContent>
              </Card>
              <Card className="text-center hover-lift hover-glow animate-scale-in animation-delay-300">
                <CardContent className="pt-6 pb-6">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-3">
                    100%
                  </div>
                  <div className="text-sm sm:text-base text-muted-foreground">
                    Automated
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    No Manual Tracking Required
                  </div>
                </CardContent>
              </Card>
              <Card className="text-center hover-lift hover-glow animate-scale-in animation-delay-400 sm:col-span-2 lg:col-span-1">
                <CardContent className="pt-6 pb-6">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-accent mb-3">
                    Secure
                  </div>
                  <div className="text-sm sm:text-base text-muted-foreground">
                    M-Pesa Integration
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Protected & Verified Payments
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-10 sm:py-16 md:py-20 px-3 sm:px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 animate-fade-in-up">
            Why Choose <StyledSMCF className="inline" />?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                icon: Wallet,
                title: "Personal Savings Wallet",
                description:
                  "Save any amount in your personal wallet and earn 3% interest every month with zero maintenance fees.",
                delay: "100",
              },
              {
                icon: TrendingUp,
                title: "Member Loans",
                description:
                  "Access loans when you need them. Quick approval process with flexible repayment terms for active members.",
                delay: "200",
              },
              {
                icon: Smartphone,
                title: "M-Pesa Integration",
                description:
                  "Seamless payments via M-Pesa STK Push. Direct payouts to your mobile money account.",
                delay: "300",
              },
              {
                icon: Users,
                title: "Group Management",
                description:
                  "Hierarchical member system with automated disbursements based on contribution order.",
                delay: "400",
              },
              {
                icon: Shield,
                title: "Secure & Transparent",
                description:
                  "OTP authentication, encrypted transactions, and complete audit trails for all activities.",
                delay: "500",
              },
              {
                icon: Clock,
                title: "Automated Reminders",
                description:
                  "SMS and web notifications for payment deadlines and payout confirmations.",
                delay: "600",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className={`hover-lift hover-glow group cursor-pointer animate-scale-in animation-delay-${feature.delay}`}>
                <CardHeader>
                  <feature.icon className="w-12 h-12 sm:w-14 sm:h-14 text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
                  <CardTitle className="group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="group-hover:text-foreground transition-colors duration-300">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Loans & Savings Section */}
      <section className="py-10 sm:py-16 md:py-20 px-3 sm:px-4">
        <div className="container mx-auto max-w-6xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 animate-fade-in-up">
            More Benefits for Members
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Savings Wallet Card */}
            <Card className="overflow-hidden hover-lift hover-glow group animate-fade-in-left">
              <div className="bg-gradient-to-br from-financial-success/10 to-financial-success/5 p-6 group-hover:from-financial-success/20 group-hover:to-financial-success/10 transition-all duration-300">
                <Wallet className="w-12 h-12 sm:w-16 sm:h-16 text-financial-success mb-4 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="text-xl sm:text-2xl mb-3 group-hover:text-financial-success transition-colors duration-300">Personal Savings Wallet</CardTitle>
                <CardDescription className="text-base sm:text-lg mb-6">
                  Save for your future with our personal wallet feature
                </CardDescription>
              </div>
              <CardContent className="pt-6">
                <ul className="space-y-3 sm:space-y-4">
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-financial-success/40 transition-colors">
                      <span className="text-financial-success text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Save Any Amount</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">No minimum deposit required</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-financial-success/40 transition-colors">
                      <span className="text-financial-success text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Earn 3% Interest Monthly</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Interest calculated and paid every month</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-financial-success/40 transition-colors">
                      <span className="text-financial-success text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Zero Maintenance Fees</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Keep 100% of your interest earnings</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-financial-success/40 transition-colors">
                      <span className="text-financial-success text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Withdraw Anytime</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Direct to M-Pesa, no restrictions</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Loans Card */}
            <Card className="overflow-hidden hover-lift hover-glow group animate-fade-in-right animation-delay-200">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
                <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="text-xl sm:text-2xl mb-3 group-hover:text-primary transition-colors duration-300">Member Loans</CardTitle>
                <CardDescription className="text-base sm:text-lg mb-6">
                  Access financial support when you need it most
                </CardDescription>
              </div>
              <CardContent className="pt-6">
                <ul className="space-y-3 sm:space-y-4">
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-primary/40 transition-colors">
                      <span className="text-primary text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Quick Approval</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Get approved within 24 hours</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-primary/40 transition-colors">
                      <span className="text-primary text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Flexible Repayment</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Choose terms that work for you</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-primary/40 transition-colors">
                      <span className="text-primary text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Competitive Rates</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Fair interest rates for members</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 group/item hover:translate-x-2 transition-transform duration-300">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-primary/40 transition-colors">
                      <span className="text-primary text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Build Credit History</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Increase your loan limit over time</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Non-Member Loan Section */}
      <section id="non-member-loans" className="py-10 sm:py-16 md:py-20 px-3 sm:px-4 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        
        <div className="container mx-auto max-w-5xl relative z-10">
          <Card className="overflow-hidden hover-lift hover-glow border-2 border-primary/20 shadow-2xl animate-fade-in-up">
            <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 p-6 sm:p-8 md:p-10">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-primary rounded-full mb-4 sm:mb-6 animate-pulse-glow">
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 bg-gradient-primary bg-clip-text text-transparent">
                  Get a Loan Without Being a Member
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                  Not yet part of SMART MONEY CASH FLOW? You can still request a loan instantly.
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-all duration-300 hover:scale-105">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-financial-success flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1">Quick Online Application</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Simple form, fast process</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-all duration-300 hover:scale-105">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-financial-success flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1">Fast Approval Process</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Get feedback quickly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-all duration-300 hover:scale-105">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-financial-success flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1">Secure and Confidential</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Your data is protected</p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="text-center">
                <a 
                  href="https://smcfloans.page" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <Button
                    size="lg"
                    className="text-base sm:text-lg px-8 sm:px-12 py-4 sm:py-6 h-auto hover-lift hover-shine bg-gradient-primary text-primary-foreground font-bold shadow-lg hover:shadow-2xl transition-all duration-300 group"
                  >
                    Apply for Non-Member Loan
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </a>
                <p className="text-xs sm:text-sm text-muted-foreground mt-4 italic">
                  Terms and eligibility criteria apply.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-10 sm:py-16 md:py-20 px-3 sm:px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 animate-fade-in-up">
            How <StyledSMCF className="inline" /> Works
          </h3>
          <div className="space-y-6 sm:space-y-8">
            {[
              {
                step: 1,
                title: "Register & Join",
                description:
                  "Sign up with your M-Pesa number and receive your unique member ID.",
                delay: "100",
              },
              {
                step: 2,
                title: "Contribute KES 224",
                description:
                  "Every 5 days, contribute KES 224 via secure M-Pesa paybill 6938069 or STK Push payment.",
                delay: "200",
              },
              {
                step: 3,
                title: "Automated Payout",
                description:
                  "When all members contribute, the total amount is sent to the next member in line.",
                delay: "300",
              },
              {
                step: 4,
                title: "Track Progress",
                description:
                  "Monitor your payment history, upcoming payouts, and group status in real-time.",
                delay: "400",
              },
            ].map((step, index) => (
              <Card key={index} className={`overflow-hidden hover-lift group cursor-pointer animate-fade-in-left animation-delay-${step.delay}`}>
                <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-primary-foreground flex-shrink-0 group-hover:scale-110 transition-transform duration-300 animate-pulse-glow">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg sm:text-xl font-semibold mb-2 group-hover:text-primary transition-colors duration-300">{step.title}</h4>
                    <p className="text-sm sm:text-base text-muted-foreground group-hover:text-foreground transition-colors duration-300">{step.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - Enhanced for SEO and Rich Snippets */}
      <section className="py-10 sm:py-16 md:py-20 px-3 sm:px-4">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 animate-fade-in-up">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            {[
              {
                question: "What is table banking?",
                answer: "Smart Moves Cash Flow is a digital table banking platform that automates group savings with KES 224 contributions every 5 days. Members save together and take turns receiving the pooled funds, with integrated M-Pesa payments for convenience and security."
              },
              {
                question: "How does the contribution cycle work?",
                answer: "Every member contributes KES 224 every 5 days. The total collected amount is disbursed to members in a hierarchical order based on their position. Each member gets their turn to receive the pooled funds, creating a rotating savings and credit system that benefits everyone."
              },
              {
                question: "Can I save additional money beyond contributions?",
                answer: "Yes! We offer a personal savings wallet where you can save any amount beyond your regular contributions. Your savings earn 3% interest every month with zero maintenance fees. You can deposit or withdraw anytime through M-Pesa, giving you complete financial flexibility."
              },
              {
                question: "How do member loans work?",
                answer: "Active members can apply for loans directly through the platform. Loans are approved quickly based on your contribution history and savings balance. Repayment terms are flexible with competitive interest rates designed to support members' financial needs without burden."
              },
              {
                question: "Is M-Pesa integration safe and secure?",
                answer: "Absolutely! SMCF uses Safaricom's official M-Pesa API with STK Push for secure payments. All transactions are encrypted end-to-end, and we use OTP authentication for added security. Your financial data is protected with industry-standard encryption and secure cloud storage."
              },
              {
                question: "How do I join SMCF?",
                answer: "Contact your group administrator to get registered in the system. Once added, you'll receive login credentials via SMS to your registered phone number. You can then access the platform via web browser or download our mobile app to start managing your contributions, savings, and loans."
              },
              {
                question: "What makes SMCF better than traditional chamas?",
                answer: "SMCF automates everything - from contribution reminders to M-Pesa payments and disbursements. You get real-time tracking, transparent records, instant notifications, personal savings with interest, and quick loan access. No more manual record-keeping, delayed payments, or cash handling risks."
              },
              {
                question: "Are there any hidden fees?",
                answer: "No hidden fees! We believe in complete transparency. Standard M-Pesa transaction charges apply for payments and withdrawals. Your personal savings wallet has zero maintenance fees, and you earn 3% interest monthly on your balance. All fees are clearly disclosed upfront."
              }
            ].map((faq, index) => (
              <Card key={index} className="hover-lift hover-glow group cursor-pointer animate-scale-in" style={{animationDelay: `${index * 50}ms`}} itemScope itemType="https://schema.org/Question">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg group-hover:text-primary transition-colors duration-300" itemProp="name">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent itemScope itemType="https://schema.org/Answer" itemProp="acceptedAnswer">
                  <p className="text-sm sm:text-base text-muted-foreground group-hover:text-foreground transition-colors duration-300" itemProp="text">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SMCF SACCO Section */}
      <section id="sacco-portal" className="py-10 sm:py-16 md:py-20 px-3 sm:px-4 bg-accent/10">
        <div className="container mx-auto max-w-4xl">
          <Card className="overflow-hidden hover-lift hover-glow border-2 border-accent/30 shadow-xl animate-fade-in-up">
            <div className="bg-gradient-to-br from-accent/10 via-primary/5 to-accent/5 p-6 sm:p-8 md:p-10">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-accent rounded-full mb-4 sm:mb-6 animate-pulse-glow">
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-accent-foreground" />
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 bg-gradient-accent bg-clip-text text-transparent">
                  SMCF SACCO – Official Member Portal
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                  SMCF SACCO is our dedicated platform for registered members to access exclusive SACCO services, manage their savings, apply for loans, and view statements securely online.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 sm:mb-8">
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-all duration-300 hover:scale-105">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1">Member Dashboard</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Track savings, loans, and payouts</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-all duration-300 hover:scale-105">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1">Online Statements</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Download and view your SACCO statements</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-all duration-300 hover:scale-105">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1">Loan Applications</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Apply for SACCO loans directly online</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-all duration-300 hover:scale-105">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1">Secure Access</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Protected with OTP and encrypted login</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <button
                  onClick={() => { window.location.href = '/sacco'; }}
                  className="inline-block"
                >
                  <Button
                    size="lg"
                    className="text-base sm:text-lg px-8 sm:px-12 py-4 sm:py-6 h-auto hover-lift hover-shine bg-gradient-accent text-accent-foreground font-bold shadow-lg hover:shadow-2xl transition-all duration-300 group"
                  >
                    Go to SMCF SACCO Portal
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </button>
                <p className="text-xs sm:text-sm text-muted-foreground mt-4 italic">
                  For registered members only. Use your SACCO credentials to log in.
                </p>
              </div>

              <div className="mt-8">
                <MemberMessageComposer mode="public" source="landing-page" title="Send a Message to Main SMCF Admin" compact />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-10 sm:py-16 md:py-20 px-3 sm:px-4 bg-gradient-primary overflow-hidden">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-white animate-fade-in-up">
            Ready to Transform Your Group Savings?
          </h3>
          <p className="text-base sm:text-xl md:text-2xl text-white/90 mb-6 sm:mb-8 animate-fade-in-up animation-delay-100">
            Join thousands of Kenyan members already using SMCF for secure, automated table banking
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setShowAuth(true)}
            className="text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto hover-lift hover-shine animate-scale-in animation-delay-200">
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-10 sm:py-12 px-3 sm:px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4 animate-fade-in-up">
            <img 
              src={smcfLogo} 
              alt="SMCF - Smart Moves Cash Flow Footer Logo" 
              className="w-8 h-8 hover:rotate-12 transition-transform duration-300" 
            />
            <span className="text-xl"><StyledSMCF /></span>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 animate-fade-in-up animation-delay-100">
            Smart Moves Cash Flow - Digital Table Banking Platform
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mb-2 animate-fade-in-up animation-delay-200">
            Secure • Automated • Transparent • Kenyan-Made
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mb-2 animate-fade-in-up animation-delay-300">
            Contact: <a href="tel:+254759097157" className="hover:text-primary transition-colors duration-300 hover:underline">+254 759 097 157</a>
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground animate-fade-in-up animation-delay-400">
            Email: <a href="mailto:administrator@smcf.app" className="hover:text-primary transition-colors duration-300 hover:underline">administrator@smcf.app</a> | <a href="mailto:info@smcf.app" className="hover:text-primary transition-colors duration-300 hover:underline">info@smcf.app</a>
          </p>
        </div>
      </footer>

      {/* Auth Dialog */}
      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        onLogin={handleLogin}
      />

      {/* Organization Dialog */}
      <OrganizationDialog
        open={showOrganization}
        onOpenChange={setShowOrganization}
      />
    </div>
  );
};

export default Index;
