import AdminDashboard from "@/components/AdminDashboard";
import MemberDashboard from "@/components/MemberDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { Clock, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io(API_BASE); // Uses VITE_API_URL or fallback

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

  // Fetch fresh cycle data
  useEffect(() => {
    const fetchCycleData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/cycles/current`);
        const data = await res.json();
        
        if (data.success && data.data) {
          const cycle = data.data;
          setCycleData({
            currentCycle: cycle.cycle_number || 0,
            daysLeft: cycle.days_left || 0,
            totalMembers: cycle.total_members || 0,
            paidMembers: cycle.paid_members_count || 0,
            nextRecipient: cycle.next_recipient?.name || cycle.next_recipient_name || "No Active Cycle",
            totalAmount: cycle.expected_amount || 0,
            collectedAmount: cycle.total_amount_collected || 0,
            cycleStartDate: cycle.start_date ? new Date(cycle.start_date).toLocaleDateString() : "Not Started",
            paymentDeadline: cycle.end_date ? new Date(cycle.end_date).toLocaleDateString() : "Not Set",
          });
        }
      } catch (err) {
        console.error("Failed to fetch cycle data:", err);
      }
    };

    fetchCycleData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchCycleData, 30000);

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
              <div className="text-2xl font-bold text-financial-success mb-2">
                {cycleData.totalMembers > 0
                  ? Math.round((cycleData.paidMembers / cycleData.totalMembers) * 100)
                  : 0}
                %
              </div>
              <Progress
                value={cycleData.totalMembers > 0 ? (cycleData.paidMembers / cycleData.totalMembers) * 100 : 0}
                className="h-2"
              />
              <div className="text-sm text-muted-foreground mt-2">
                {cycleData.paidMembers}/{cycleData.totalMembers} members paid
              </div>
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
