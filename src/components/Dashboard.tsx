import AdminDashboard from "@/components/AdminDashboard";

import MemberDashboard from "@/components/MemberDashboard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { NotificationCenter } from "@/components/notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNotification } from "@/hooks/use-notification";
import { useToast } from "@/hooks/use-toast";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { initializeMobileNotifications, isNativePlatformAsync, showMobileNotification } from "@/lib/mobileNotifications";
import { Clock, LogOut } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";

// Initialize socket with Render-optimized settings
const socket = io(API_BASE, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  timeout: 20000,
  autoConnect: true,
});

// Attach to window for debugging and access from other components
(window as any).socket = socket;

// Log socket connection status
socket.on("connect", () => {
  console.log("✅ Socket.IO connected to backend:", API_BASE);
  console.log("🔌 Socket ID:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.warn("⚠️ Socket.IO disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("❌ Socket.IO connection error:", error.message);
});

interface DashboardProps {
  userRole: "admin" | "member";
  userData: any;
  onLogout: () => void;
}

const Dashboard = ({ userRole, userData, onLogout }: DashboardProps) => {
  const { toast } = useToast();
  const { notifyPayment, notifyAnnouncement, notifySavings, notifyLoan, notifySuccess } = useNotification();
  const isNativeRef = useRef(false);

  // Auto-logout after 3 minutes of inactivity
  useInactivityLogout({
    timeout: 3 * 60 * 1000, // 3 minutes
    onLogout: () => {
      toast({
        title: "Session Expired",
        description: "You have been logged out due to inactivity.",
        variant: "destructive",
      });
      onLogout();
    },
    enabled: true,
  });

  // Initialize mobile notifications on mount
  useEffect(() => {
        // Listen for member deletion and cycle update events for real-time refresh
        socket.on("member:deleted", (data) => {
          console.log("👤 Dashboard received: member:deleted", data);
          fetchData();
        });
        socket.on("cycle:updated", (data) => {
          console.log("🔄 Dashboard received: cycle:updated (member:deleted)", data);
          fetchData();
        });
    const initMobile = async () => {
      const isNative = await isNativePlatformAsync();
      isNativeRef.current = isNative;
      if (isNative) {
        await initializeMobileNotifications();
      }
    };
    initMobile();
  }, []);

  // Cycle data from real API - will be fetched and updated (don't use userData prop - it might be stale)
  const [cycleData, setCycleData] = useState({
    currentCycle: null as number | null,
    daysLeft: 0,
    totalMembers: 0,
    paidMembers: 0,
    nextRecipient: "Loading...",
    totalAmount: 0,
    collectedAmount: 0,
    cycleStartDate: "Loading...",
    paymentDeadline: "Loading...",
  });

  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch fresh cycle data and members count
  const fetchData = async () => {
    try {
      console.log("🔄 Starting data fetch for userRole:", userRole);

      // Fetch cycle data and payments (members endpoint requires admin auth)
      const requests = [
        fetch(`${API_BASE}/api/cycles/current`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/payments`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ];

      const responses = await Promise.all(requests);

      if (!responses[0].ok || !responses[1].ok) {
        console.error("❌ API request failed:", {
          cycleStatus: responses[0].status,
          paymentsStatus: responses[1].status,
        });
        setIsLoadingData(false);
        return;
      }

      const cycleData = await responses[0].json();
      const paymentsResponse = await responses[1].json();

      console.log("📊 Dashboard raw responses:", {
        userRole,
        cycleSuccess: cycleData?.success,
        cycleDataExists: !!cycleData?.data,
        paymentsCount: Array.isArray(paymentsResponse)
          ? paymentsResponse.length
          : 0,
      });

      // Extract payments array
      const paymentsData = Array.isArray(paymentsResponse)
        ? paymentsResponse
        : [];

      // Get current cycle number
      const currentCycleNumber = cycleData?.data?.cycle_number || null;

      // Filter payments for CURRENT CYCLE ONLY (same as AdminDashboard & MemberDashboard)
      const currentCyclePayments = currentCycleNumber
        ? paymentsData.filter((p: any) => p.cycle_number === currentCycleNumber)
        : paymentsData;

      console.log("👥 Extracted data:", {
        totalPayments: paymentsData.length,
        currentCycleNumber,
        currentCyclePayments: currentCyclePayments.length,
      });

      // Calculate paid members from CURRENT CYCLE PAYMENTS ONLY
      // Count unique members who have paid (completed payments only)
      const completedPayments = currentCyclePayments.filter(
        (p: any) => p.status === "completed"
      );
      const uniquePaidMembers = new Set(
        completedPayments.map((p: any) => p.member_id?._id || p.member_id)
      ).size;

      // Calculate total collected from current cycle completed payments
      const totalCollected = completedPayments.reduce(
        (sum: number, p: any) => sum + (p.amount || 0),
        0
      );

      console.log("💰 Payment calculation (CURRENT CYCLE ONLY):", {
        currentCycleNumber,
        totalPayments: paymentsData.length,
        currentCyclePayments: currentCyclePayments.length,
        completedPayments: completedPayments.length,
        uniquePaidMembers,
        totalCollected,
      });

      // Get total members count from cycle data (includes ALL members)
      const totalMembersCount = cycleData?.data?.total_members || 14;
      const paidMembersCount = uniquePaidMembers; // Use payment-based count
      const expectedAmount = totalMembersCount * 224;

      console.log("📈 Calculated stats from PAYMENTS data:", {
        totalMembersCount,
        paidMembersCount,
        percentage:
          totalMembersCount > 0
            ? Math.round((paidMembersCount / totalMembersCount) * 100)
            : 0,
        totalCollected,
        expectedAmount,
      });

      if (cycleData.success && cycleData.data) {
        const cycle = cycleData.data;
        const newCycleData = {
          currentCycle: cycle.cycle_number || 1,
          daysLeft: cycle.days_left || 0,
          totalMembers: totalMembersCount, // From cycle data
          paidMembers: paidMembersCount, // From payments count
          nextRecipient:
            cycle.next_recipient?.name ||
            cycle.next_recipient_name ||
            "No Active Cycle",
          totalAmount: expectedAmount,
          collectedAmount: totalCollected,
          cycleStartDate: cycle.start_date
            ? new Date(cycle.start_date).toLocaleDateString()
            : new Date().toLocaleDateString(),
          paymentDeadline: cycle.end_date
            ? new Date(cycle.end_date).toLocaleDateString()
            : "Not Set",
        };
        console.log(
          "✅ Setting cycle data with real member counts:",
          newCycleData
        );
        setCycleData(newCycleData);
      } else {
        // No active cycle - still use real member data
        console.log("⚠️ No active cycle found in database");
        console.log("📊 Using fallback with real member/payment data:", {
          totalMembers: totalMembersCount,
          paidMembers: paidMembersCount,
          totalCollected,
        });

        const newCycleData = {
          currentCycle: 1, // Default to cycle 1 if no active cycle
          daysLeft: 0,
          totalMembers: totalMembersCount, // Use actual member count
          paidMembers: paidMembersCount, // Use actual paid count
          nextRecipient: "No Active Cycle",
          totalAmount: expectedAmount,
          collectedAmount: totalCollected,
          cycleStartDate: new Date().toLocaleDateString(),
          paymentDeadline: "Not Set",
        };
        console.log(
          "✅ Setting fallback cycle data with real counts:",
          newCycleData
        );
        setCycleData(newCycleData);
      }

      setIsLoadingData(false);
    } catch (err) {
      console.error("❌ Failed to fetch data:", err);
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 10 seconds for faster updates
    const interval = setInterval(fetchData, 10000);

    // Fallback timeout - if data doesn't load within 5 seconds, stop showing loading state
    const timeout = setTimeout(() => {
      if (isLoadingData) {
        console.warn("⚠️ Data fetch timeout - stopping loading state");
        setIsLoadingData(false);
      }
    }, 5000);

    return () => {
        socket.off("member:deleted");
        socket.off("cycle:updated");
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleLogout = () => {
    toast({
      title: "Logged out successfully",
      description: "You have been safely logged out",
    });
    onLogout();
  };

  useEffect(() => {
    console.log("🎧 Dashboard: Setting up Socket.IO listeners");

    // Notify server that user is online
    if (userData) {
      socket.emit("user:online", {
        userId: userData._id || userData.id,
        username: userData.username || userData.name,
        role: userData.role,
      });
      console.log(
        "👤 Notified server: user is online",
        userData.username || userData.name
      );
    }

    // Handler for announcement notifications
    const handleNewAnnouncement = (announcement: any) => {
      console.log("📢 Dashboard received: announcement", announcement);
      setAnnouncements((prev: any) => [announcement, ...prev]);
      // Show notification with sound
      notifyAnnouncement(
        "New Announcement",
        announcement.title || announcement.message || "New announcement posted",
        { announcementId: announcement._id }
      );
      // Mobile notification
      if (isNativeRef.current) {
        showMobileNotification({
          title: "📢 New Announcement",
          body: announcement.title || announcement.message || "New announcement posted",
          extra: { type: "announcement", id: announcement._id }
        });
      }
    };

    // Listen for both event names (different parts of the system may use different names)
    socket.on("announcement:new", handleNewAnnouncement);
    socket.on("announcementCreated", handleNewAnnouncement);
    
    socket.on("member:new", (member) => {
      console.log("👤 Dashboard received: member:new", member);
      setMembers((prev) => [member, ...prev]);
      // Show notification for new member (admin only)
      if (userRole === "admin") {
        notifySuccess(
          "New Member Joined",
          `${member.name || "A new member"} has joined the platform`,
          { memberId: member._id }
        );
        if (isNativeRef.current) {
          showMobileNotification({
            title: "👤 New Member",
            body: `${member.name || "A new member"} has joined the platform`,
            extra: { type: "member", id: member._id }
          });
        }
      }
    });
    socket.on("payment:completed", (data) => {
      console.log("💰 Dashboard received: payment:completed", data);
      fetchData(); // Refresh cycle stats
      // Show notification for payment
      const memberName = data.member?.name || data.memberName || "A member";
      const amount = data.amount ? `KES ${data.amount.toLocaleString()}` : "";
      notifyPayment(
        "Payment Received",
        `${memberName} made a contribution${amount ? ` of ${amount}` : ""}`,
        { paymentId: data._id, memberId: data.member_id }
      );
      if (isNativeRef.current) {
        showMobileNotification({
          title: "💰 Payment Received",
          body: `${memberName} made a contribution${amount ? ` of ${amount}` : ""}`,
          extra: { type: "payment", id: data._id }
        });
      }
    });
    socket.on("payment:new", (data) => {
      console.log("💰 Dashboard received: payment:new", data);
      fetchData(); // Refresh cycle stats
    });
    socket.on("cycle:updated", (data) => {
      console.log("🔄 Dashboard received: cycle:updated", data);
      fetchData(); // Refresh cycle stats
      notifySuccess(
        "Cycle Updated",
        `Cycle ${data.cycle_number || ""} has been updated`,
        { cycleId: data._id }
      );
    });
    
    // Savings events
    socket.on("savingDeposit", (data) => {
      console.log("💵 Dashboard received: savingDeposit", data);
      const memberName = data.member?.name || data.memberName || "A member";
      const amount = data.amount ? `KES ${data.amount.toLocaleString()}` : "";
      notifySavings(
        "Savings Deposit",
        `${memberName} deposited${amount ? ` ${amount}` : ""} to savings`,
        data
      );
      if (isNativeRef.current) {
        showMobileNotification({
          title: "💵 Savings Deposit",
          body: `${memberName} deposited${amount ? ` ${amount}` : ""} to savings`,
          extra: { type: "savings", action: "deposit" }
        });
      }
    });
    
    socket.on("withdrawalRequest", (data) => {
      console.log("📤 Dashboard received: withdrawalRequest", data);
      if (userRole === "admin") {
        const memberName = data.member?.name || data.memberName || "A member";
        const amount = data.amount ? `KES ${data.amount.toLocaleString()}` : "";
        notifySavings(
          "Withdrawal Request",
          `${memberName} requested${amount ? ` ${amount}` : ""} withdrawal`,
          data
        );
        if (isNativeRef.current) {
          showMobileNotification({
            title: "📤 Withdrawal Request",
            body: `${memberName} requested${amount ? ` ${amount}` : ""} withdrawal`,
            extra: { type: "savings", action: "withdrawal" }
          });
        }
      }
    });
    
    socket.on("withdrawalStatusUpdated", (data) => {
      console.log("✅ Dashboard received: withdrawalStatusUpdated", data);
      const status = data.status || "updated";
      notifySavings(
        "Withdrawal " + (status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Updated"),
        `Your withdrawal request has been ${status}`,
        data
      );
      if (isNativeRef.current) {
        showMobileNotification({
          title: status === "approved" ? "✅ Withdrawal Approved" : status === "rejected" ? "❌ Withdrawal Rejected" : "📋 Withdrawal Updated",
          body: `Your withdrawal request has been ${status}`,
          extra: { type: "savings", action: "withdrawal", status }
        });
      }
    });
    
    // Loan events
    socket.on("loanRequest", (data) => {
      console.log("💳 Dashboard received: loanRequest", data);
      if (userRole === "admin") {
        const memberName = data.member?.name || data.memberName || "A member";
        const amount = data.amount ? `KES ${data.amount.toLocaleString()}` : "";
        notifyLoan(
          "Loan Request",
          `${memberName} requested a loan${amount ? ` of ${amount}` : ""}`,
          data
        );
        if (isNativeRef.current) {
          showMobileNotification({
            title: "💳 Loan Request",
            body: `${memberName} requested a loan${amount ? ` of ${amount}` : ""}`,
            extra: { type: "loan", action: "request" }
          });
        }
      }
    });
    
    socket.on("loanStatusUpdated", (data) => {
      console.log("📋 Dashboard received: loanStatusUpdated", data);
      const status = data.status || "updated";
      notifyLoan(
        "Loan " + (status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Updated"),
        `Your loan application has been ${status}`,
        data
      );
      if (isNativeRef.current) {
        showMobileNotification({
          title: status === "approved" ? "✅ Loan Approved" : status === "rejected" ? "❌ Loan Rejected" : "📋 Loan Updated",
          body: `Your loan application has been ${status}`,
          extra: { type: "loan", action: "status", status }
        });
      }
    });
    
    socket.on("loanLateFeeApplied", (data) => {
      console.log("⚠️ Dashboard received: loanLateFeeApplied", data);
      notifyLoan(
        "Late Fee Applied",
        `A late fee has been applied to your loan`,
        data
      );
      if (isNativeRef.current) {
        showMobileNotification({
          title: "⚠️ Late Fee Applied",
          body: "A late fee has been applied to your loan",
          extra: { type: "loan", action: "lateFee" }
        });
      }
    });
    
    socket.on("interestApplied", (data) => {
      console.log("📈 Dashboard received: interestApplied", data);
      notifySavings(
        "Interest Applied",
        `Interest has been applied to your savings`,
        data
      );
    });

    // Listen for profile picture updates (for real-time updates across tabs/sessions)
    socket.on("member:updated", (data) => {
      console.log("👤 Dashboard received: member:updated", data);
      // If the updated member is the current user and profile_picture was updated
      if (userData && data.memberId === userData._id && data.profile_picture !== undefined) {
        // Update localStorage to ensure consistency
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            user.profile_picture = data.profile_picture;
            localStorage.setItem("user", JSON.stringify(user));
            console.log("✅ Profile picture updated in localStorage via Socket.IO");
          } catch (error) {
            console.error("Error updating localStorage:", error);
          }
        }
        
        // Trigger page reload to reflect changes (will happen automatically via ProfilePictureUpload component)
        // This handler mainly ensures other tabs/windows also get updated
      }
    });

    return () => {
      console.log("🧹 Dashboard: Cleaning up Socket.IO listeners");
      socket.off("announcement:new");
      socket.off("announcementCreated");
      socket.off("member:new");
      socket.off("member:updated");
      socket.off("payment:completed");
      socket.off("payment:new");
      socket.off("cycle:updated");
      socket.off("savingDeposit");
      socket.off("withdrawalRequest");
      socket.off("withdrawalStatusUpdated");
      socket.off("loanRequest");
      socket.off("loanStatusUpdated");
      socket.off("loanLateFeeApplied");
      socket.off("interestApplied");
    };
  }, [userData, userRole, notifyPayment, notifyAnnouncement, notifySavings, notifyLoan, notifySuccess]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5">

      
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
              <AvatarImage src={userData?.profile_picture} alt={userData?.name} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">
                {userRole === "admin" ? "A" : (userData?.name || "M").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-primary">
                {userRole === "admin" ? "Admin Dashboard" : "Member Dashboard"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Welcome, {userData?.name || "User"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Badge variant={userRole === "admin" ? "default" : "secondary"}>
              {userRole === "admin"
                ? "Administrator"
                : `Member ${userData?.memberId || userData?.member_id || ""}`}
            </Badge>            <NotificationCenter />            <ThemeToggle />
            <Button
              onClick={() => {
                console.log("504 Manual refresh triggered");
                setIsLoadingData(true);
                window.location.reload();
              }}
              variant="outline"
              size="sm">
              Refresh Data
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="hover:shadow-financial transition-all duration-300 min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Current Cycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="space-y-2">
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-primary mb-2">
                    #{cycleData.currentCycle || 1}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {cycleData.daysLeft} days left
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300 min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Collection Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="space-y-3">
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-financial-success mb-2">
                    {cycleData.totalMembers > 0
                      ? Math.round(
                          (cycleData.paidMembers / cycleData.totalMembers) * 100
                        )
                      : 0}
                    %
                  </div>
                  <Progress
                    value={
                      cycleData.totalMembers > 0
                        ? (cycleData.paidMembers / cycleData.totalMembers) * 100
                        : 0
                    }
                    className="h-2"
                  />
                  <div className="text-xs sm:text-sm text-muted-foreground mt-2">
                    {cycleData.paidMembers}/{cycleData.totalMembers} members
                    paid
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300 min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Amount Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="space-y-2">
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-accent mb-2">
                    KES {cycleData.collectedAmount.toLocaleString()}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    of KES {cycleData.totalAmount.toLocaleString()}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300 min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Next Recipient
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="space-y-2">
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-primary mb-2">
                    {cycleData.nextRecipient}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Awaiting full collection
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Role-specific Dashboard */}
        {userRole === "member" ? (
          <MemberDashboard userData={userData} cycleData={cycleData} />
        ) : (
          <AdminDashboard
            userData={userData}
            cycleData={cycleData}
            members={members}
            announcements={announcements}
            onLogout={onLogout}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
