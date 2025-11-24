import LoanRequestDialog from "@/components/LoanRequestDialog";
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
  Phone,
  Receipt,
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
  const [currentCycleData, setCurrentCycleData] = useState(
    cycleData || {
      currentCycle: 0,
      daysLeft: 0,
      paidMembers: 0,
      totalMembers: 0,
      collectedAmount: 0,
      totalAmount: 0,
      cycleStartDate: new Date().toLocaleDateString(),
    }
  );
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
        // Fetch all data in parallel
        const [cycleRes, paymentsRes] = await Promise.all([
          fetch(`${API_BASE}/api/cycles/current`, {
            headers: { ...authService.getAuthHeaders() },
          }),
          fetch(`${API_BASE}/api/payments`, {
            headers: { ...authService.getAuthHeaders() },
          }),
        ]);

        const cycleData = await cycleRes.json();
        const payments = await paymentsRes.json();

        // Update cycle data silently only if changed
        if (cycleData.success) {
          setCurrentCycleData((prev) => {
            const newData = {
              currentCycle: cycleData.data.cycle_number,
              daysLeft: cycleData.data.days_left,
              paidMembers: cycleData.data.paid_members_count,
              totalMembers: cycleData.data.total_members,
              collectedAmount: cycleData.data.total_amount_collected,
              totalAmount: cycleData.data.expected_amount,
              cycleStartDate: new Date(
                cycleData.data.start_date
              ).toLocaleDateString(),
            };
            if (JSON.stringify(prev) !== JSON.stringify(newData)) {
              return newData;
            }
            return prev;
          });
        }

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

        // Check if paid this cycle
        const hasPaid = memberPayments.some(
          (p) =>
            p.cycle_number === cycleData.data?.cycle_number &&
            p.status === "completed"
        );

        // Update stats silently only if changed
        setMemberStats((prev) => {
          const newStats = {
            ...prev,
            hasPaidThisCycle: hasPaid,
            totalContributed: memberPayments.reduce(
              (sum, p) => sum + p.amount,
              0
            ),
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
    const interval = setInterval(fetchData, 20000);

    // Socket.IO real-time event listeners
    const socket = (window as any).socket;
    if (socket && userData) {
      console.log("👂 Member Dashboard listening for real-time updates");

      // Listen for payment completion for this member
      socket.on("paymentCompleted", (data: any) => {
        if (data.memberId === userData._id || data.memberId === userData.id) {
          console.log("💰 Your payment was confirmed:", data);
          toast({
            title: "Payment Confirmed!",
            description: `Your payment of KES ${data.amount} has been confirmed`,
          });
          fetchData(); // Refresh data immediately
        }
      });

      // Listen for member updates for this member
      socket.on("memberUpdated", (data: any) => {
        if (data.memberId === userData._id || data.memberId === userData.id) {
          console.log("👤 Your profile was updated:", data);
          fetchData(); // Refresh data immediately
        }
      });

      // Listen for cycle updates
      socket.on("cycleUpdated", (data: any) => {
        console.log("🔄 Cycle updated:", data);
        fetchData(); // Refresh data immediately
      });

      // Listen for loan status updates
      socket.on("loanStatusUpdated", (data: any) => {
        if (data.memberId === userData._id || data.memberId === userData.id) {
          console.log("💰 Your loan status was updated:", data);
          const statusMessages: Record<string, string> = {
            approved: `Your loan of KES ${data.amount.toLocaleString()} has been approved!`,
            rejected: `Your loan request for KES ${data.amount.toLocaleString()} was rejected`,
            disbursed: `Your loan of KES ${data.amount.toLocaleString()} has been disbursed`,
            repaid: `Your loan of KES ${data.amount.toLocaleString()} is marked as repaid`,
          };

          toast({
            title: `Loan ${
              data.status.charAt(0).toUpperCase() + data.status.slice(1)
            }`,
            description:
              statusMessages[data.status] || `Loan status: ${data.status}`,
            variant: data.status === "rejected" ? "destructive" : "default",
          });
          fetchData(); // Refresh data immediately
        }
      });
    }

    return () => {
      clearInterval(interval);

      // Cleanup Socket.IO listeners
      if (socket) {
        socket.off("paymentCompleted");
        socket.off("memberUpdated");
        socket.off("cycleUpdated");
        socket.off("loanStatusUpdated");
      }
    };
  }, [userData]);

  const handleMakePayment = () => {
    if (memberStats.hasPaidThisCycle) {
      toast({
        title: "Already Paid",
        description: "You have already contributed for this cycle",
        variant: "destructive",
      });
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    // Refresh data after payment
    setMemberStats((prev) => ({ ...prev, hasPaidThisCycle: true }));
    toast({
      title: "Payment Successful",
      description: "Your KES 204 contribution has been received",
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
                    ? `You've contributed KES 204 for cycle #${currentCycleData?.currentCycle}`
                    : `KES 204 payment due in ${
                        currentCycleData?.daysLeft || 0
                      } days`}
                </p>
              </div>
            </div>
            <Button
              onClick={handleMakePayment}
              variant="mpesa"
              size="sm"
              className="w-full sm:w-auto text-xs md:text-sm">
              <Phone className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              {memberStats.hasPaidThisCycle ? "Paid" : "Pay via M-Pesa"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* M-Pesa Payment Section - Always visible */}
      <Card className="border-mpesa-green bg-gradient-to-br from-mpesa-green/5 to-mpesa-green/10">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-mpesa-green">
            <Phone className="w-6 h-6" />
            Make Your KES 204 Contribution
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
                KES 204
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
              className="w-full text-lg font-semibold"
              disabled={memberStats.hasPaidThisCycle}>
              <Phone className="w-5 h-5 mr-2" />
              {memberStats.hasPaidThisCycle
                ? "Paid for This Cycle"
                : "Send M-Pesa Payment"}
            </Button>
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {currentCycleData?.paidMembers || 0}/
                    {currentCycleData?.totalMembers || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Members Paid
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-financial-success mb-1">
                    KES{" "}
                    {currentCycleData?.collectedAmount?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Amount Collected
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-financial-warning mb-1">
                    {currentCycleData?.daysLeft || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Days Remaining
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Payment History
              </CardTitle>
              <CardDescription>
                Your contribution history for all cycles
              </CardDescription>
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
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h4 className="font-semibold text-accent mb-2">
                    Next Payout
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    You will receive the group payout in cycle #
                    {memberStats.nextPayoutCycle}
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
