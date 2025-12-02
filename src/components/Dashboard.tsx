import AdminDashboard from "@/components/AdminDashboard";
import MemberDashboard from "@/components/MemberDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { Clock, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import io from "socket.io-client";

// Initialize socket with proper config
const socket = io(API_BASE, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
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
        const completedPayments = currentCyclePayments.filter((p: any) => p.status === "completed");
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
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleLogout = () => {
    toast({
      title: "Logged out successfully",
      description: "You have been safely logged out of SMCF",
    });
    onLogout();
  };

  useEffect(() => {
    console.log("🎧 Dashboard: Setting up Socket.IO listeners");
    
    socket.on("announcement:new", (announcement) => {
      console.log("📢 Dashboard received: announcement:new", announcement);
      setAnnouncements((prev) => [announcement, ...prev]);
    });
    socket.on("member:new", (member) => {
      console.log("👤 Dashboard received: member:new", member);
      setMembers((prev) => [member, ...prev]);
    });
    socket.on("payment:completed", (data) => {
      console.log("💰 Dashboard received: payment:completed", data);
      fetchData(); // Refresh cycle stats
    });
    socket.on("payment:new", (data) => {
      console.log("💰 Dashboard received: payment:new", data);
      fetchData(); // Refresh cycle stats
    });
    socket.on("cycle:updated", (data) => {
      console.log("🔄 Dashboard received: cycle:updated", data);
      fetchData(); // Refresh cycle stats
    });
    return () => {
      console.log("🧹 Dashboard: Cleaning up Socket.IO listeners");
      socket.off("announcement:new");
      socket.off("member:new");
      socket.off("payment:completed");
      socket.off("payment:new");
      socket.off("cycle:updated");
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              {userRole === "admin" ? "A" : "M"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">
                {userRole === "admin" ? "Admin Dashboard" : "Member Dashboard"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {userData?.name || "User"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={userRole === "admin" ? "default" : "secondary"}>
              {userRole === "admin"
                ? "Administrator"
                : `Member ${userData?.memberId || userData?.member_id || ""}`}
            </Badge>
            <Button
              onClick={() => {
                console.log("🔄 Manual refresh triggered");
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
      <div className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Cycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-primary mb-2">
                    #{cycleData.currentCycle || 1}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {cycleData.daysLeft} days left
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Collection Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-financial-success mb-2">
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
                  <div className="text-sm text-muted-foreground mt-2">
                    {cycleData.paidMembers}/{cycleData.totalMembers} members
                    paid
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Amount Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-accent mb-2">
                    KES {cycleData.collectedAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    of KES {cycleData.totalAmount.toLocaleString()}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Next Recipient
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-primary mb-2">
                    {cycleData.nextRecipient}
                  </div>
                  <div className="text-sm text-muted-foreground">
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
