import smcfLogo from "@/assets/smcf-logo.png";
import AdminDashboard from "@/components/AdminDashboard";
import AdminSetup from "@/components/AdminSetup";
import AuthDialog from "@/components/AuthDialog";
import Dashboard from "@/components/Dashboard";
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
              const newCycleData = {
                currentCycle: cycle.cycle_number,
                daysLeft: cycle.days_left,
                paidMembers: cycle.paid_members_count,
                totalMembers: cycle.total_members,
                collectedAmount: cycle.total_amount_collected,
                totalAmount: cycle.expected_amount,
                nextRecipient: cycle.next_recipient?.name || "TBD",
                cycleStartDate: new Date(cycle.start_date).toLocaleDateString(),
                cycleEndDate: new Date(cycle.end_date).toLocaleDateString(),
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
                <img src={smcfLogo} alt="SMCF Logo" className="w-10 h-10" />
                <div>
                  <h1 className="text-xl font-bold text-primary">SMCF Admin</h1>
                  <p className="text-xs text-muted-foreground">
                    Smart Money Cash Flow
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
      <DebugInfo
        userRole={userRole}
        currentUser={currentUser}
        showAuth={showAuth}
      />
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={smcfLogo}
              alt="SMCF Logo"
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
            <div>
              <h1 className="text-base sm:text-xl font-bold text-primary">
                SMCF
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Smart Money Cash Flow
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAuth(true)}
            variant="default"
            size="sm"
            className="text-xs sm:text-sm px-3 sm:px-4">
            Login / Register
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-10 sm:py-16 md:py-20 px-3 sm:px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="animate-fade-in-up">
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Digital Table Banking
            </h2>
            <p className="text-base sm:text-xl md:text-2xl text-muted-foreground mb-6 sm:mb-8">
              Automated KES 204 contributions every 5 days.{" "}
              <br className="hidden sm:block" />
              Secure M-Pesa integration. Real-time tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12">
              <Button
                size="lg"
                onClick={() => setShowAuth(true)}
                className="text-sm sm:text-base md:text-lg py-4 sm:py-5 md:py-6 px-6 sm:px-8">
                Join SMCF Today
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-sm sm:text-base md:text-lg py-4 sm:py-5 md:py-6 px-6 sm:px-8"
                onClick={() => setShowOrganization(true)}>
                Learn More
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-16">
            <Card className="text-center hover:shadow-financial transition-all duration-300">
              <CardContent className="pt-4 sm:pt-6">
                <div className="text-2xl sm:text-3xl font-bold text-financial-success mb-2">
                  KES 204
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Every 5 Days
                </div>
              </CardContent>
            </Card>
            <Card className="text-center hover:shadow-financial transition-all duration-300">
              <CardContent className="pt-4 sm:pt-6">
                <div className="text-2xl sm:text-3xl font-bold text-primary mb-2">
                  100%
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Automated
                </div>
              </CardContent>
            </Card>
            <Card className="text-center hover:shadow-financial transition-all duration-300">
              <CardContent className="pt-4 sm:pt-6">
                <div className="text-2xl sm:text-3xl font-bold text-accent mb-2">
                  Secure
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
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
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
            Why Choose SMCF?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                icon: Wallet,
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
                icon: TrendingUp,
                title: "Real-time Tracking",
                description:
                  "Live payment status, contribution history, and upcoming payout notifications.",
              },
              {
                icon: Smartphone,
                title: "Mobile Responsive",
                description:
                  "Works perfectly on any device - desktop, tablet, or smartphone.",
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
                className="hover:shadow-financial transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <feature.icon className="w-12 h-12 text-primary mb-4" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-3xl font-bold text-center mb-12">
            How SMCF Works
          </h3>
          <div className="space-y-8">
            {[
              {
                step: 1,
                title: "Register & Join",
                description:
                  "Sign up with your M-Pesa number and receive your unique SMCF member ID.",
              },
              {
                step: 2,
                title: "Contribute KES 204",
                description:
                  "Every 5 days, contribute KES 204 via secure M-Pesa paybill 6938069 or STK Push payment.",
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

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={smcfLogo} alt="SMCF Logo" className="w-8 h-8" />
            <span className="text-xl font-bold">SMCF</span>
          </div>
          <p className="text-muted-foreground mb-4">
            Smart Money Cash Flow - Digital Table Banking Platform
          </p>
          <p className="text-sm text-muted-foreground">
            Secure • Automated • Transparent • Kenyan-Made
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
