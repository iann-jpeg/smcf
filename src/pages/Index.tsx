import smcfLogo from "@/assets/newsmcflogo.png";
import landingBackground from "@/assets/landingbackground.jpg";
import AdminDashboard from "@/components/AdminDashboard";
import AdminSetup from "@/components/AdminSetup";
import AuthDialog from "@/components/AuthDialog";
import Dashboard from "@/components/Dashboard";
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
} from "lucide-react";
import { useEffect, useState } from "react";
// Test components removed; render the real AdminDashboard
import DebugInfo from "@/components/DebugInfo";
import OrganizationDialog from "@/components/OrganizationDialog";
import { useInactivityLogoutWithWarning } from "@/hooks/useInactivityLogoutWithWarning";
import { sessionConfig, getTimeoutForRole } from "@/config/session";
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
          const [cycleRes, membersRes, announcementsRes] = await Promise.all([
            fetch(`${API_BASE}/api/cycles/current`, {
              headers: { ...authService.getAuthHeaders() },
            }),
            fetch(`${API_BASE}/api/members`, {
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
          // Update members silently
          setMembers((prev) => {
            const newData = Array.isArray(membersData) ? membersData : [];
            // Only update if data actually changed to prevent flicker
            if (JSON.stringify(prev) !== JSON.stringify(newData)) {
              return newData;
            }
            return prev;
          });

          // Update announcements silently
          setAnnouncements((prev) => {
            const newData = Array.isArray(announcementsData)
              ? announcementsData
              : [];
            if (JSON.stringify(prev) !== JSON.stringify(newData)) {
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
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

  // Auto-logout after configured timeout of inactivity (only when user is logged in)
  // Shows warning notification before logout
  useInactivityLogoutWithWarning({
    timeout: getTimeoutForRole(userRole),
    warningTime: sessionConfig.warningBeforeLogout,
    onLogout: handleLogout,
    enabled: sessionConfig.enabled && userRole !== null,
    events: sessionConfig.activityEvents,
  });

  // Silent refresh members without UI flicker
  const refreshMembers = async () => {
    try {
      const membersRes = await fetch(`${API_BASE}/api/members`, {
        headers: { ...authService.getAuthHeaders() },
      });
      const membersData = await membersRes.json();

      // Only update if data changed to prevent unnecessary re-renders
      setMembers((prev) => {
        const newData = Array.isArray(membersData) ? membersData : [];
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
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

      
      <DebugInfo
        userRole={userRole}
        currentUser={currentUser}
        showAuth={showAuth}
      />
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50 transition-all duration-300 hover:shadow-lg">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
            <img
              src={smcfLogo}
              alt="SMCF - Smart Moves Cash Flow Logo - Digital Table Banking Platform"
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
            />
            <div>
              <h1 className="text-base sm:text-xl group-hover:text-primary transition-colors duration-300">
                <StyledSMCF />
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                Smart Moves Cash Flow
              </p>
              <p className="text-[9px] sm:text-[10px] text-primary/70 font-medium italic group-hover:text-primary transition-colors duration-300">
                Digital Table Banking Made Simple
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              onClick={() => setShowAuth(true)}
              variant="default"
              size="sm"
              className="text-xs sm:text-sm px-3 sm:px-4 transition-all duration-300 hover:scale-105 hover:shadow-lg">
              Login / Register
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 sm:py-28 md:py-36 px-3 sm:px-4 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${landingBackground})`,
              filter: 'brightness(0.3)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="max-w-2xl animate-fade-in-up">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-6 sm:mb-8 text-white leading-tight animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
              Digital Table Banking
              <span className="block mt-2 bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent animate-glow">
                Platform for Kenya
              </span>
            </h1>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-semibold mb-6 text-white/90 animate-slide-in-left" style={{ animationDelay: '0.2s' }}>
              <StyledSMCF /> - <span className="text-yellow-400">Smart Moves Cash Flow</span>
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-8 sm:mb-10 leading-relaxed animate-slide-in-left" style={{ animationDelay: '0.3s' }}>
              Kenya's #1 automated chama management system.
              <br />
              <span className="text-green-400 font-semibold">KES 224 every 5 days</span> • 
              <span className="text-yellow-400 font-semibold"> 3% monthly interest</span> • 
              <span className="text-blue-400 font-semibold"> Instant M-Pesa payments</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-10 sm:mb-14 animate-slide-in-left" style={{ animationDelay: '0.4s' }}>
              <Button
                size="lg"
                onClick={() => setShowAuth(true)}
                className="group text-base sm:text-lg md:text-xl py-6 sm:py-7 md:py-8 px-8 sm:px-10 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-green-500/50 animate-pulse-subtle">
                <span className="flex items-center gap-2">
                  Join <StyledSMCF className="inline" /> Today - Start Saving
                  <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                </span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base sm:text-lg md:text-xl py-6 sm:py-7 md:py-8 px-8 sm:px-10 border-2 border-white/80 text-white hover:bg-white hover:text-black transition-all duration-300 hover:scale-105 hover:shadow-2xl backdrop-blur-sm"
                onClick={() => setShowOrganization(true)}>
                Learn How It Works
              </Button>
            </div>
            
            {/* Trust Indicators */}
            <div className="flex flex-wrap gap-6 sm:gap-10 text-sm sm:text-base animate-slide-in-left" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-3 text-white/90 hover:text-white transition-colors duration-300 group">
                <div className="p-2 bg-green-500/20 rounded-full group-hover:bg-green-500/30 transition-all duration-300">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <span className="font-medium">Bank-Level Security</span>
              </div>
              <div className="flex items-center gap-3 text-white/90 hover:text-white transition-colors duration-300 group">
                <div className="p-2 bg-blue-500/20 rounded-full group-hover:bg-blue-500/30 transition-all duration-300">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <span className="font-medium">1000+ Active Members</span>
              </div>
              <div className="flex items-center gap-3 text-white/90 hover:text-white transition-colors duration-300 group">
                <div className="p-2 bg-yellow-500/20 rounded-full group-hover:bg-yellow-500/30 transition-all duration-300">
                  <Smartphone className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="font-medium">M-Pesa Verified Partner</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-16 sm:mt-20 relative z-10">
            <Card className="text-center hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-500 hover:-translate-y-2 bg-gradient-to-br from-card to-card/80 backdrop-blur-lg border-2 border-transparent hover:border-green-500/50 group animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <CardContent className="pt-6 sm:pt-8">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-green-600 dark:text-green-400 mb-3 group-hover:scale-110 transition-transform duration-300">
                  KES 224
                </div>
                <div className="text-sm sm:text-base text-muted-foreground font-medium">
                  Every 5 Days
                </div>
              </CardContent>
            </Card>
            <Card className="text-center hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 hover:-translate-y-2 bg-gradient-to-br from-card to-card/80 backdrop-blur-lg border-2 border-transparent hover:border-blue-500/50 group animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
              <CardContent className="pt-6 sm:pt-8">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform duration-300">
                  100%
                </div>
                <div className="text-sm sm:text-base text-muted-foreground font-medium">
                  Automated
                </div>
              </CardContent>
            </Card>
            <Card className="text-center hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-500 hover:-translate-y-2 bg-gradient-to-br from-card to-card/80 backdrop-blur-lg border-2 border-transparent hover:border-yellow-500/50 group animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
              <CardContent className="pt-6 sm:pt-8">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-yellow-600 dark:text-yellow-400 mb-3 group-hover:scale-110 transition-transform duration-300">
                  Secure
                </div>
                <div className="text-sm sm:text-base text-muted-foreground font-medium">
                  M-Pesa Integration
                </div>
              </CardContent>
            </Card>
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
              },
              {
                icon: TrendingUp,
                title: "Member Loans",
                description:
                  "Access loans when you need them. Quick approval process with flexible repayment terms for active members.",
              },
              {
                icon: Smartphone,
                title: "M-Pesa Integration",
                description:
                  "Seamless payments via M-Pesa STK Push. Direct payouts to your mobile money account.",
              },
              {
                icon: Users,
                title: "Group Management",
                description:
                  "Hierarchical member system with automated disbursements based on contribution order.",
              },
              {
                icon: Shield,
                title: "Secure & Transparent",
                description:
                  "OTP authentication, encrypted transactions, and complete audit trails for all activities.",
              },
              {
                icon: Clock,
                title: "Automated Reminders",
                description:
                  "SMS and web notifications for payment deadlines and payout confirmations.",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:-translate-y-3 hover:scale-105 group cursor-pointer bg-gradient-to-br from-card to-card/50 border-2 border-transparent hover:border-primary/30 animate-fade-in-up"
                style={{ animationDelay: `${0.1 * index}s` }}>
                <CardHeader>
                  <div className="p-3 bg-primary/10 rounded-full w-fit mb-4 group-hover:bg-primary/20 transition-all duration-300 group-hover:rotate-6 group-hover:scale-110">
                    <feature.icon className="w-12 h-12 text-primary" />
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="group-hover:text-foreground/80 transition-colors duration-300">{feature.description}</CardDescription>
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
            <Card className="overflow-hidden hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-500 hover:-translate-y-2 hover:scale-105 group border-2 border-transparent hover:border-green-500/30">
              <div className="bg-gradient-to-br from-financial-success/10 to-financial-success/5 p-6 group-hover:from-financial-success/20 group-hover:to-financial-success/10 transition-all duration-500">
                <div className="p-3 bg-financial-success/20 rounded-full w-fit mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <Wallet className="w-12 h-12 sm:w-16 sm:h-16 text-financial-success" />
                </div>
                <CardTitle className="text-xl sm:text-2xl mb-3">Personal Savings Wallet</CardTitle>
                <CardDescription className="text-base sm:text-lg mb-6">
                  Save for your future with our personal wallet feature
                </CardDescription>
              </div>
              <CardContent className="pt-6">
                <ul className="space-y-3 sm:space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-financial-success text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Save Any Amount</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">No minimum deposit required</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-financial-success text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Earn 3% Interest Monthly</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Interest calculated and paid every month</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-financial-success text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Zero Maintenance Fees</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Keep 100% of your interest earnings</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-financial-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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
            <Card className="overflow-hidden hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 hover:-translate-y-2 hover:scale-105 group border-2 border-transparent hover:border-primary/30">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-500">
                <div className="p-3 bg-primary/20 rounded-full w-fit mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
                </div>
                <CardTitle className="text-xl sm:text-2xl mb-3">Member Loans</CardTitle>
                <CardDescription className="text-base sm:text-lg mb-6">
                  Access financial support when you need it most
                </CardDescription>
              </div>
              <CardContent className="pt-6">
                <ul className="space-y-3 sm:space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Quick Approval</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Get approved within 24 hours</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Flexible Repayment</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Choose terms that work for you</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-sm sm:text-base">✓</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Competitive Rates</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Fair interest rates for members</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-3xl text-center mb-12">
            How <StyledSMCF className="inline" /> Works
          </h3>
          <div className="space-y-8">
            {[
              {
                step: 1,
                title: "Register & Join",
                description:
                  "Sign up with your M-Pesa number and receive your unique member ID.",
              },
              {
                step: 2,
                title: "Contribute KES 224",
                description:
                  "Every 5 days, contribute KES 224 via secure M-Pesa paybill 6938069 or STK Push payment.",
              },
              {
                step: 3,
                title: "Automated Payout",
                description:
                  "When all members contribute, the total amount is sent to the next member in line.",
              },
              {
                step: 4,
                title: "Track Progress",
                description:
                  "Monitor your payment history, upcoming payouts, and group status in real-time.",
              },
            ].map((step, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="flex items-center gap-6 p-6">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground flex-shrink-0">
                    {step.step}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold mb-2">{step.title}</h4>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - Enhanced for SEO and Rich Snippets */}
      <section className="py-10 sm:py-16 md:py-20 px-3 sm:px-4 bg-muted/30">
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
              <Card 
                key={index} 
                className="hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 border-2 border-transparent group cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${0.05 * index}s` }}
                itemScope 
                itemType="https://schema.org/Question"
              >
                <CardHeader>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors duration-300" itemProp="name">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent itemScope itemType="https://schema.org/Answer" itemProp="acceptedAnswer">
                  <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-300" itemProp="text">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="relative py-16 sm:py-24 md:py-32 px-3 sm:px-4 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-glow to-financial-success opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <div className="animate-fade-in-up">
            <h3 className="text-3xl sm:text-5xl font-bold mb-6 sm:mb-8 text-white drop-shadow-lg">
              Ready to Transform Your Group Savings?
            </h3>
            <p className="text-lg sm:text-2xl text-white/95 mb-8 sm:mb-12 leading-relaxed">
              Join thousands of Kenyan members already using SMCF for secure, automated table banking
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setShowAuth(true)}
              className="group text-lg sm:text-xl px-8 sm:px-12 py-6 sm:py-8 h-auto bg-white text-primary hover:bg-white/90 transition-all duration-300 hover:scale-110 hover:shadow-2xl shadow-xl">
              <span className="flex items-center gap-3">
                Get Started Today
                <span className="group-hover:translate-x-2 transition-transform duration-300">→</span>
              </span>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-12 px-4 border-t border-white/10">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4 group cursor-pointer">
            <img 
              src={smcfLogo} 
              alt="SMCF - Smart Moves Cash Flow Footer Logo" 
              className="w-8 h-8 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" 
            />
            <span className="text-xl group-hover:text-primary transition-colors duration-300"><StyledSMCF /></span>
          </div>
          <p className="text-muted-foreground mb-4 hover:text-foreground transition-colors duration-300">
            Smart Moves Cash Flow - Digital Table Banking Platform
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            Secure • Automated • Transparent • Kenyan-Made
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            Contact: <a href="tel:+254759097157" className="hover:text-primary transition-all duration-300 hover:underline">+254 759 097 157</a>
          </p>
          <p className="text-sm text-muted-foreground">
            Email: <a href="mailto:administrator@smcf.app" className="hover:text-primary transition-all duration-300 hover:underline">administrator@smcf.app</a> | <a href="mailto:info@smcf.app" className="hover:text-primary transition-all duration-300 hover:underline">info@smcf.app</a>
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
