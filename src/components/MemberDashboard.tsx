import LoanRequestDialog from "@/components/LoanRequestDialog";
import MemberWallet from "@/components/MemberWallet";
import PaymentDialog from "@/components/PaymentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Megaphone,
  Phone,
  Receipt,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

interface MemberDashboardProps {
  userData: any;
  cycleData: any;
}

const MemberDashboard = ({ userData, cycleData }: MemberDashboardProps) => {
  const [showPayment, setShowPayment] = useState(false);
  const [showLoanRequest, setShowLoanRequest] = useState(false);
  const { toast } = useToast();
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [memberLoans, setMemberLoans] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentCycleData, setCurrentCycleData] = useState({
    currentCycle: 0,
    daysLeft: 0,
    paidMembers: 0,
    totalMembers: 0,
    collectedAmount: 0,
    totalAmount: 0,
    cycleStartDate: new Date().toLocaleDateString(),
    nextRecipient: "Loading...",
  });
  const [memberStats, setMemberStats] = useState({
    hasPaidThisCycle: false,
    nextPayoutCycle: 0,
    totalContributed: userData?.total_contributed || 0,
    totalReceived: userData?.total_received || 0,
    memberPosition: userData?.position || 0,
  });

  // Silent background data fetch without UI flicker
  useEffect(() => {
    // Safety check - ensure userData exists
    if (!userData || !userData._id) {
      console.warn("MemberDashboard: userData is undefined or missing _id");
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch all data in parallel including fresh member data
        const [cycleRes, paymentsRes, loansRes, announcementsRes, memberRes] =
          await Promise.all([
            fetch(`${API_BASE}/api/cycles/current`, {
              headers: { ...authService.getAuthHeaders() },
            }),
            fetch(`${API_BASE}/api/payments`, {
              headers: { ...authService.getAuthHeaders() },
            }),
            fetch(`${API_BASE}/api/loans`, {
              headers: { ...authService.getAuthHeaders() },
            }),
            fetch(`${API_BASE}/api/announcements`, {
              headers: { ...authService.getAuthHeaders() },
            }),
            fetch(`${API_BASE}/api/members/${userData._id}`, {
              headers: { ...authService.getAuthHeaders() },
            }),
          ]);

        const cycleData = await cycleRes.json();
        const payments = await paymentsRes.json();
        const loansData = await loansRes.json();

        let announcementsData: any = [];
        try {
          if (announcementsRes.ok) {
            announcementsData = await announcementsRes.json();
            console.log("📢 Announcements response:", announcementsData);
          } else {
            console.error(
              "❌ Announcements fetch failed:",
              announcementsRes.status
            );
          }
        } catch (err) {
          console.error("❌ Error parsing announcements:", err);
        }

        const freshMemberData = await memberRes.json();

        // Filter member's loans
        const memberLoansList = Array.isArray(loansData)
          ? loansData.filter(
              (loan) =>
                loan.member_id?._id === userData._id ||
                loan.member_id?._id === userData.id ||
                loan.member_id === userData._id ||
                loan.member_id === userData.id
            )
          : [];

        setMemberLoans(memberLoansList);

        // Update announcements
        if (Array.isArray(announcementsData)) {
          console.log("📢 Fetched announcements:", announcementsData.length);
          setAnnouncements(announcementsData);
        } else if (
          announcementsData?.success &&
          Array.isArray(announcementsData.data)
        ) {
          console.log(
            "📢 Fetched announcements:",
            announcementsData.data.length
          );
          setAnnouncements(announcementsData.data);
        } else {
          console.log(
            "📢 No announcements or unexpected format:",
            announcementsData
          );
        }

        // Get total members count from cycle data or calculate from payments
        const totalMembersCount =
          cycleData.success && cycleData.data?.total_members
            ? cycleData.data.total_members
            : 14; // Default to 14 members if not available

        console.log("👥 Total members count:", totalMembersCount);
        console.log("💰 Payments data:", payments);

        // Calculate total collected from all payments
        const totalCollected = Array.isArray(payments)
          ? payments
              .filter((p) => p.status === "completed")
              .reduce((sum, p) => sum + (p.amount || 0), 0)
          : 0;

        console.log("💵 Total collected:", totalCollected);

        // Count unique members who have paid
        const uniquePaidMembers = Array.isArray(payments)
          ? new Set(
              payments
                .filter((p) => p.status === "completed")
                .map((p) => p.member_id?._id || p.member_id)
            ).size
          : 0;

        console.log("✅ Unique paid members:", uniquePaidMembers);

        // Update cycle data - always use fresh data from system
        const newData = {
          currentCycle:
            cycleData.success && cycleData.data
              ? cycleData.data.cycle_number || 1
              : 1,
          daysLeft:
            cycleData.success && cycleData.data
              ? cycleData.data.days_left || 0
              : 0,
          paidMembers: uniquePaidMembers, // Always use calculated count from actual payments
          totalMembers: totalMembersCount || 0,
          collectedAmount:
            cycleData.success && cycleData.data
              ? cycleData.data.total_amount_collected || totalCollected
              : totalCollected,
          totalAmount:
            cycleData.success && cycleData.data
              ? cycleData.data.expected_amount || totalMembersCount * 224
              : totalMembersCount * 224,
          cycleStartDate:
            cycleData.success && cycleData.data && cycleData.data.start_date
              ? new Date(cycleData.data.start_date).toLocaleDateString()
              : new Date().toLocaleDateString(),
          nextRecipient:
            cycleData.success && cycleData.data
              ? cycleData.data.next_recipient?.name ||
                cycleData.data.next_recipient_name ||
                "No recipient assigned"
              : "No Active Cycle",
        };

        console.log("📊 Updated cycle data:", newData);
        setCurrentCycleData(newData);

        // Filter for this member's payments
        const memberPayments = Array.isArray(payments)
          ? payments.filter(
              (p) =>
                p.member_id?._id === userData._id ||
                p.member_id?._id === userData.id ||
                p.member_id === userData._id ||
                p.member_id === userData.id
            )
          : [];

        // Update payment history silently only if changed
        setPaymentHistory((prev) => {
          const newHistory = memberPayments.map((p) => ({
            cycle: p.cycle_number,
            amount: p.amount,
            date: new Date(p.date).toLocaleDateString(),
            status: p.status,
          }));
          if (JSON.stringify(prev) !== JSON.stringify(newHistory)) {
            return newHistory;
          }
          return prev;
        });

        // Check if paid this cycle using payment_status from fresh member data
        const hasPaid = freshMemberData.success
          ? freshMemberData.data.payment_status === "paid"
          : memberPayments.some(
              (p) =>
                p.cycle_number === cycleData.data?.cycle_number &&
                p.status === "completed"
            );

        // Update stats using fresh member data
        setMemberStats((prev) => {
          const newStats = {
            hasPaidThisCycle: hasPaid,
            nextPayoutCycle: freshMemberData.success
              ? freshMemberData.data.next_payout_cycle || 0
              : prev.nextPayoutCycle,
            totalContributed: freshMemberData.success
              ? freshMemberData.data.total_contributed || 0
              : prev.totalContributed,
            totalReceived: freshMemberData.success
              ? freshMemberData.data.total_received || 0
              : prev.totalReceived,
            memberPosition: freshMemberData.success
              ? freshMemberData.data.position || 0
              : prev.memberPosition,
          };
          if (JSON.stringify(prev) !== JSON.stringify(newStats)) {
            return newStats;
          }
          return prev;
        });
      } catch (error) {
        console.error("Error fetching member data:", error);
      }
    };

    // Initial fetch
    fetchData();

    // Silent background refresh every 20 seconds
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds for faster updates

    // Socket.IO real-time event listeners
    const socket = (window as any).socket;
    if (socket && userData) {
      console.log("👂 Member Dashboard listening for real-time updates");
      console.log("🔌 Socket connected:", socket.connected);
      console.log("🆔 Socket ID:", socket.id);

      // Listen for payment completion (new event name)
      socket.on("payment:completed", (data: any) => {
        console.log("💰 MemberDashboard received: payment:completed", data);
        toast({
          title: "Payment Confirmed!",
          description: `Payment of KES ${data.amount} has been confirmed`,
        });
        fetchData(); // Refresh data immediately
      });

      // Listen for any new payment
      socket.on("payment:new", (data: any) => {
        console.log("💰 MemberDashboard received: payment:new", data);
        fetchData(); // Refresh cycle stats
      });

      // Listen for cycle updates (new event name)
      socket.on("cycle:updated", (data: any) => {
        console.log("🔄 MemberDashboard received: cycle:updated", data);
        fetchData(); // Refresh data immediately
      });

      // Listen for member additions/removals
      socket.on("member:new", (data: any) => {
        console.log("👤 MemberDashboard received: member:new", data);
        fetchData(); // Refresh to update total members count
      });

      // Listen for loan status updates
      socket.on("loanStatusUpdated", (data: any) => {
        if (data.memberId === userData._id || data.memberId === userData.id) {
          console.log("💰 Your loan status was updated:", data);
          const statusMessages: Record<string, string> = {
            approved: `Your loan of KES ${data.amount.toLocaleString()} has been approved!`,
            rejected: data.rejectionReason
              ? `Your loan request was rejected. Reason: ${data.rejectionReason}`
              : `Your loan request for KES ${data.amount.toLocaleString()} was rejected`,
            disbursed: `Your loan of KES ${data.amount.toLocaleString()} has been disbursed to your M-Pesa!`,
            repaid: `Your loan of KES ${data.amount.toLocaleString()} is marked as repaid. Thank you!`,
          };

          toast({
            title: `Loan ${
              data.status.charAt(0).toUpperCase() + data.status.slice(1)
            }`,
            description:
              statusMessages[data.status] || `Loan status: ${data.status}`,
            variant: data.status === "rejected" ? "destructive" : "default",
            duration: data.status === "rejected" ? 8000 : 5000, // Show rejection longer
          });
          fetchData(); // Refresh data immediately
        }
      });

      // Listen for new announcements
      socket.on("announcementCreated", (announcement: any) => {
        console.log("📢 New announcement received:", announcement);

        // Add the new announcement to the list
        setAnnouncements((prev) => [announcement, ...prev]);

        // Show toast notification based on priority
        const priorityEmojis = {
          high: "🔴",
          medium: "🟡",
          low: "🟢",
        };

        toast({
          title: `${
            priorityEmojis[
              announcement.priority as keyof typeof priorityEmojis
            ] || "📢"
          } New Announcement`,
          description:
            announcement.message.substring(0, 100) +
            (announcement.message.length > 100 ? "..." : ""),
          variant: announcement.priority === "high" ? "destructive" : "default",
          duration: announcement.priority === "high" ? 10000 : 6000,
        });
      });
    }

    return () => {
      clearInterval(interval);

      // Cleanup Socket.IO listeners
      if (socket) {
        socket.off("payment:completed");
        socket.off("payment:new");
        socket.off("cycle:updated");
        socket.off("loanStatusUpdated");
        socket.off("announcementCreated");
        socket.off("member:new");
      }
    };
  }, [userData]);

  const handleMakePayment = () => {
    // Allow payment even if already paid - will be recorded for next cycle
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    // Refresh data after payment
    setMemberStats((prev) => ({ ...prev, hasPaidThisCycle: true }));
    toast({
      title: "Payment Successful",
      description: "Your KES 224 contribution has been received",
    });
    setShowPayment(false);

    // Trigger immediate refresh
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-0">
      {/* Payment Status Alert */}
      <Card
        className={`border-l-4 ${
          memberStats.hasPaidThisCycle
            ? "border-l-financial-success bg-financial-success/5"
            : "border-l-financial-warning bg-financial-warning/5"
        }`}>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              {memberStats.hasPaidThisCycle ? (
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-financial-success flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-financial-warning flex-shrink-0" />
              )}
              <div>
                <h3 className="text-sm md:text-base font-semibold">
                  {memberStats.hasPaidThisCycle
                    ? "Payment Complete"
                    : "Payment Required"}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {memberStats.hasPaidThisCycle
                    ? `You've contributed KES 224 for cycle #${currentCycleData?.currentCycle}`
                    : `KES 224 payment due in ${
                        currentCycleData?.daysLeft || 0
                      } days`}
                </p>
              </div>
            </div>
            <Button
              onClick={handleMakePayment}
              variant={memberStats.hasPaidThisCycle ? "default" : "mpesa"}
              size="sm"
              className="w-full sm:w-auto text-xs md:text-sm">
              <Phone className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              {memberStats.hasPaidThisCycle
                ? "Pay for Next Cycle"
                : "Pay via M-Pesa"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* M-Pesa Payment Section - Always visible */}
      <Card className="border-mpesa-green bg-gradient-to-br from-mpesa-green/5 to-mpesa-green/10">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-mpesa-green">
            <Phone className="w-6 h-6" />
            Make Your KES 224 Contribution
          </CardTitle>
          <CardDescription className="text-lg">
            Pay securely via M-Pesa STK Push directly to the organization Till
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white/50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount:</span>
              <span className="text-2xl font-bold text-mpesa-green">
                KES 224
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Destination:</span>
              <span className="font-medium">
                SMCF Group Till: <span className="font-bold">6938069</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your Number:</span>
              <span className="font-medium">
                {userData?.phoneNumber || userData?.phone || "N/A"}
              </span>
            </div>
          </div>

          <div className="text-center space-y-4">
            <Button
              onClick={handleMakePayment}
              variant="mpesa"
              size="lg"
              className="w-full text-lg font-semibold">
              <Phone className="w-5 h-5 mr-2" />
              {memberStats.hasPaidThisCycle
                ? "Paid for This Cycle"
                : "Send M-Pesa Payment"}
            </Button>
            {memberStats.hasPaidThisCycle && (
              <p className="text-xs text-center text-muted-foreground">
                ✓ Already paid for Cycle #{currentCycleData?.currentCycle}.
                Click to pay for future cycles.
              </p>
            )}
            <div className="mt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowLoanRequest(true)}>
                Request a Loan
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Direct STK Push:</strong> You will receive an M-Pesa
                prompt to enter your PIN and pay to Till{" "}
                <strong>6938069</strong>.
              </p>
              <p>
                <strong>Multiple Payment Options:</strong>
              </p>
              <p>
                • <strong>M-Pesa Paybill:</strong> 6938069 (Recommended)
              </p>
              <p>
                • <strong>Lipa na M-Pesa:</strong> Buy Goods & Services
              </p>
              <p>
                • <strong>M-Pesa App:</strong> Business &gt; Lipa na M-Pesa &gt;
                Till 6938069
              </p>
              <p>
                • <strong>USSD:</strong> *334# &gt; Lipa na M-Pesa &gt; Enter
                Till 6938069
              </p>
              <p>• You'll receive confirmation SMS and receipt</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-6 min-w-max">
            <TabsTrigger
              value="overview"
              className="text-xs sm:text-sm whitespace-nowrap">
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="announcements"
              className="text-xs sm:text-sm whitespace-nowrap">
              Announcements
            </TabsTrigger>
            <TabsTrigger
              value="wallet"
              className="text-xs sm:text-sm whitespace-nowrap">
              Wallet
            </TabsTrigger>
            <TabsTrigger
              value="loans"
              className="text-xs sm:text-sm whitespace-nowrap">
              My Loans
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-xs sm:text-sm whitespace-nowrap">
              <span className="hidden sm:inline">Payment History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
            <TabsTrigger
              value="payouts"
              className="text-xs sm:text-sm whitespace-nowrap">
              Payouts
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Member Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Member Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member ID:</span>
                  <Badge variant="secondary">
                    {userData?.memberId || userData?.member_id || "N/A"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Position in Queue:
                  </span>
                  <span className="font-semibold">
                    #{memberStats.memberPosition || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total Contributed:
                  </span>
                  <span className="font-semibold text-financial-success">
                    KES {memberStats.totalContributed.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Received:</span>
                  <span className="font-semibold text-accent">
                    KES {memberStats.totalReceived.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Next Payout */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Next Payout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent mb-2">
                    Position #{memberStats.memberPosition}
                  </div>
                  <p className="text-muted-foreground">
                    Your position in the payout queue
                  </p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Expected Amount:
                    </span>
                    <span className="font-semibold">
                      KES {currentCycleData?.totalAmount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Current Cycle:
                    </span>
                    <span className="font-semibold">
                      #{currentCycleData?.currentCycle || 1}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Cycle Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Current Cycle Status
              </CardTitle>
              <CardDescription>
                Cycle #{currentCycleData?.currentCycle || 1} - Started{" "}
                {currentCycleData?.cycleStartDate || "N/A"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Collection Progress Bar */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">
                      Collection Progress
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      {currentCycleData?.totalMembers > 0
                        ? Math.round(
                            (currentCycleData.paidMembers /
                              currentCycleData.totalMembers) *
                              100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-financial-success to-financial-primary h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          currentCycleData?.totalMembers > 0
                            ? (currentCycleData.paidMembers /
                                currentCycleData.totalMembers) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {currentCycleData?.paidMembers || 0} of{" "}
                      {currentCycleData?.totalMembers || 0} members paid
                    </span>
                    <span className="text-xs text-muted-foreground">
                      KES{" "}
                      {currentCycleData?.collectedAmount?.toLocaleString() || 0}{" "}
                      / {currentCycleData?.totalAmount?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {currentCycleData?.paidMembers || 0}/
                      {currentCycleData?.totalMembers || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Members Paid
                    </div>
                  </div>
                  <div className="text-center p-4 bg-financial-success/5 rounded-lg">
                    <div className="text-2xl font-bold text-financial-success mb-1">
                      KES{" "}
                      {currentCycleData?.collectedAmount?.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Amount Collected
                    </div>
                  </div>
                  <div className="text-center p-4 bg-financial-warning/5 rounded-lg">
                    <div className="text-2xl font-bold text-financial-warning mb-1">
                      {currentCycleData?.daysLeft || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Days Remaining
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5" />
                    Announcements & Reminders
                  </CardTitle>
                  <CardDescription>
                    Important updates and messages from the admin
                  </CardDescription>
                </div>
                {announcements.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to clear all announcements? This will only clear them from your view."
                        )
                      ) {
                        setAnnouncements([]);
                        toast({
                          title: "Announcements Cleared",
                          description:
                            "All announcements have been cleared from your view",
                        });
                      }
                    }}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No announcements at this time</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((announcement) => (
                    <Card
                      key={announcement._id}
                      className={`border-l-4 ${
                        announcement.priority === "high"
                          ? "border-l-red-500 bg-red-50/50"
                          : announcement.priority === "medium"
                          ? "border-l-amber-500 bg-amber-50/50"
                          : "border-l-blue-500 bg-blue-50/50"
                      }`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              announcement.priority === "high"
                                ? "bg-red-100"
                                : announcement.priority === "medium"
                                ? "bg-amber-100"
                                : "bg-blue-100"
                            }`}>
                            <Megaphone
                              className={`w-4 h-4 ${
                                announcement.priority === "high"
                                  ? "text-red-600"
                                  : announcement.priority === "medium"
                                  ? "text-amber-600"
                                  : "text-blue-600"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={
                                  announcement.priority === "high"
                                    ? "destructive"
                                    : announcement.priority === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs">
                                {announcement.priority === "high"
                                  ? "🔴 Urgent"
                                  : announcement.priority === "medium"
                                  ? "🟡 Important"
                                  : "🟢 Info"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  announcement.created_at
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap">
                              {announcement.message}
                            </p>
                            {(announcement.created_by ||
                              announcement.sent_by) && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Sent by:{" "}
                                {announcement.created_by?.name ||
                                  announcement.sent_by?.name ||
                                  "Admin"}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <MemberWallet userData={userData} />
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                My Loan Applications
              </CardTitle>
              <CardDescription>
                Track your loan requests and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {memberLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>You haven't requested any loans yet</p>
                  <Button
                    onClick={() => setShowLoanRequest(true)}
                    variant="outline"
                    className="mt-4">
                    Request Your First Loan
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberLoans.map((loan) => (
                    <Card
                      key={loan._id}
                      className="border-l-4"
                      style={{
                        borderLeftColor:
                          loan.status === "approved"
                            ? "#10b981"
                            : loan.status === "rejected"
                            ? "#ef4444"
                            : loan.status === "disbursed"
                            ? "#3b82f6"
                            : loan.status === "repaid"
                            ? "#8b5cf6"
                            : "#f59e0b",
                      }}>
                      <CardContent className="pt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-base sm:text-lg">
                                KES {loan.amount.toLocaleString()}
                              </h4>
                              <Badge
                                variant={
                                  loan.status === "approved" ||
                                  loan.status === "disbursed"
                                    ? "default"
                                    : loan.status === "rejected"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-xs">
                                {loan.status.charAt(0).toUpperCase() +
                                  loan.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                <span className="font-medium">Purpose:</span>{" "}
                                {loan.purpose}
                              </p>
                              <p>
                                <span className="font-medium">
                                  Interest Rate:
                                </span>{" "}
                                {loan.interest_rate}%
                              </p>
                              <p>
                                <span className="font-medium">
                                  Requested on:
                                </span>{" "}
                                {loan.created_at
                                  ? new Date(
                                      loan.created_at
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </p>
                              {loan.approval_date && (
                                <p>
                                  <span className="font-medium">
                                    {loan.status === "rejected"
                                      ? "Rejected on"
                                      : "Approved on"}
                                    :
                                  </span>{" "}
                                  {loan.approval_date
                                    ? new Date(
                                        loan.approval_date
                                      ).toLocaleDateString()
                                    : "N/A"}
                                </p>
                              )}
                              {loan.disbursement_date && (
                                <p>
                                  <span className="font-medium">
                                    Disbursed on:
                                  </span>{" "}
                                  {loan.disbursement_date
                                    ? new Date(
                                        loan.disbursement_date
                                      ).toLocaleDateString()
                                    : "N/A"}
                                </p>
                              )}
                              {loan.rejection_reason && (
                                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
                                  <p className="text-destructive font-medium text-xs">
                                    Rejection Reason:
                                  </p>
                                  <p className="text-destructive text-xs">
                                    {loan.rejection_reason}
                                  </p>
                                </div>
                              )}
                              {loan.notes && (
                                <div className="mt-2 p-2 bg-muted rounded">
                                  <p className="font-medium text-xs">Notes:</p>
                                  <p className="text-xs">{loan.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Payment History
                  </CardTitle>
                  <CardDescription>
                    Your contribution history for all cycles
                  </CardDescription>
                </div>
                {paymentHistory.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to clear your payment history view? This will only clear it from your view."
                        )
                      ) {
                        setPaymentHistory([]);
                        toast({
                          title: "Payment History Cleared",
                          description:
                            "Payment history has been cleared from your view",
                        });
                      }
                    }}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentHistory.map((payment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div>
                        <div className="font-medium">
                          Cycle #{payment.cycle}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.date}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-financial-success">
                        KES {payment.amount}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Payout Information
              </CardTitle>
              <CardDescription>When you receive group payouts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <h4 className="font-semibold text-primary mb-2">
                    Next Person to Receive Payout
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {currentCycleData.nextRecipient}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Will receive when cycle is fully collected
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-accent/10 p-4 rounded-lg">
                  <h4 className="font-semibold text-accent mb-2">
                    Your Next Payout
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    You will receive the group payout in cycle #
                    {memberStats.nextPayoutCycle || "Not assigned"}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span>Expected Amount:</span>
                    <span className="font-semibold">
                      KES {currentCycleData?.totalAmount?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">How Payouts Work</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Payouts are distributed based on member hierarchy</li>
                    <li>
                      • You receive the full collected amount when it's your
                      turn
                    </li>
                    <li>• Payouts are sent directly to your M-Pesa number</li>
                    <li>
                      • You'll receive SMS confirmation when funds are sent
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        onPaymentSuccess={handlePaymentSuccess}
        amount={204}
        memberData={userData}
        cycle={currentCycleData?.currentCycle || 1}
      />

      <LoanRequestDialog
        open={showLoanRequest}
        onOpenChange={setShowLoanRequest}
        memberId={userData?.memberId || userData?.member_id || userData?._id}
        memberPhone={userData?.phoneNumber || userData?.phone}
        onSubmitted={() => {
          toast({
            title: "Request Sent",
            description: "Your loan request has been sent to admin.",
          });
        }}
      />
    </div>
  );
};

export default MemberDashboard;
// ...end of file...
