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

interface DashboardProps {
  userRole: "admin" | "member";
  userData: any;
  onLogout: () => void;
}

const Dashboard = ({ userRole, userData, onLogout }: DashboardProps) => {
  const { toast } = useToast();

  // Cycle data from real API - will be fetched and updated
  const [cycleData, setCycleData] = useState({
    currentCycle: userData?.cycleData?.currentCycle || 0,
    daysLeft: userData?.cycleData?.daysLeft || 0,
    totalMembers: userData?.cycleData?.totalMembers || 0,
    paidMembers: userData?.cycleData?.paidMembers || 0,
    nextRecipient: userData?.cycleData?.nextRecipient || "No Active Cycle",
    totalAmount: userData?.cycleData?.totalAmount || 0,
    collectedAmount: userData?.cycleData?.collectedAmount || 0,
    cycleStartDate:
      userData?.cycleData?.cycleStartDate || new Date().toLocaleDateString(),
    paymentDeadline:
      userData?.cycleData?.cycleEndDate || new Date().toLocaleDateString(),
  });

  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch fresh cycle data and members count
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("🔄 Starting data fetch for userRole:", userRole);

        // Fetch cycle data, members, AND payments for everyone to ensure progress bars match
        const requests = [
          fetch(`${API_BASE}/api/cycles/current`, {
            headers: { ...authService.getAuthHeaders() },
          }),
          fetch(`${API_BASE}/api/members`, {
            headers: { ...authService.getAuthHeaders() },
          }),
          fetch(`${API_BASE}/api/payments`, {
            headers: { ...authService.getAuthHeaders() },
          }),
        ];

        const responses = await Promise.all(requests);

        if (!responses[0].ok || !responses[1].ok || !responses[2].ok) {
          console.error("❌ API request failed:", {
            cycleStatus: responses[0].status,
            membersStatus: responses[1].status,
            paymentsStatus: responses[2].status,
          });
          setIsLoadingData(false);
          return;
        }

        const cycleData = await responses[0].json();
        const membersResponse = await responses[1].json();
        const paymentsResponse = await responses[2].json();

        console.log("📊 Dashboard raw responses:", {
          userRole,
          cycleSuccess: cycleData?.success,
          cycleDataExists: !!cycleData?.data,
          membersResponseType: Array.isArray(membersResponse)
            ? "array"
            : typeof membersResponse,
          membersCount: Array.isArray(membersResponse)
            ? membersResponse.length
            : membersResponse?.data?.length || 0,
          paymentsCount: Array.isArray(paymentsResponse)
            ? paymentsResponse.length
            : 0,
        });

        // Extract members array from response (handle both array and object with data property)
        let membersData = [];
        if (Array.isArray(membersResponse)) {
          membersData = membersResponse;
        } else if (
          membersResponse?.data &&
          Array.isArray(membersResponse.data)
        ) {
          membersData = membersResponse.data;
        } else if (
          membersResponse?.success &&
          Array.isArray(membersResponse.members)
        ) {
          membersData = membersResponse.members;
        }

        // Extract payments array
        const paymentsData = Array.isArray(paymentsResponse)
          ? paymentsResponse
          : [];

        console.log("👥 Extracted data:", {
          membersCount: membersData.length,
          paymentsCount: paymentsData.length,
        });

        // Always update members array for accurate progress calculation
        setMembers(membersData);

        // IMPORTANT: Calculate paid members from PAYMENTS (same as MemberDashboard bottom bar)
        // This is more accurate than member.payment_status field
        const uniquePaidMembers = Array.isArray(paymentsData)
          ? new Set(
              paymentsData
                .filter((p: any) => p.status === "completed")
                .map((p: any) => p.member_id?._id || p.member_id)
            ).size
          : 0;

        // Calculate total collected from payments
        const totalCollected = Array.isArray(paymentsData)
          ? paymentsData
              .filter((p: any) => p.status === "completed")
              .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
          : cycleData?.data?.total_amount_collected || 0;

        // Use real-time data for accurate progress
        const totalMembersCount = membersData.length;
        const paidMembersCount = uniquePaidMembers; // Use payment-based count (86%)
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
            totalMembers: totalMembersCount,
            paidMembers: paidMembersCount, // Use calculated from actual member data
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
          const newCycleData = {
            currentCycle: 1,
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
            "🔄 No active cycle, using real member data:",
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

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    toast({
      title: "Logged out successfully",
      description: "You have been safely logged out of SMCF",
    });
    onLogout();
  };

  useEffect(() => {
    socket.on("announcement:new", (announcement) => {
      setAnnouncements((prev) => [announcement, ...prev]);
    });
    socket.on("member:new", (member) => {
      setMembers((prev) => [member, ...prev]);
    });
    return () => {
      socket.off("announcement:new");
      socket.off("member:new");
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
              <div className="text-2xl font-bold text-primary mb-2">
                #{cycleData.currentCycle}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {cycleData.daysLeft} days left
              </div>
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
              <div className="text-2xl font-bold text-accent mb-2">
                KES {cycleData.collectedAmount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                of KES {cycleData.totalAmount.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Next Recipient
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary mb-2">
                {cycleData.nextRecipient}
              </div>
              <div className="text-sm text-muted-foreground">
                Awaiting full collection
              </div>
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
