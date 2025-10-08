import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wallet, 
  Calendar, 
  CheckCircle, 
  Clock,
  AlertCircle,
  TrendingUp,
  Phone,
  Receipt
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentDialog from '@/components/PaymentDialog';
import LoanRequestDialog from '@/components/LoanRequestDialog';

interface MemberDashboardProps {
  userData: any;
  cycleData: any;
}

const MemberDashboard = ({ userData, cycleData }: MemberDashboardProps) => {
  const [showPayment, setShowPayment] = useState(false);
  const [showLoanRequest, setShowLoanRequest] = useState(false);
  const { toast } = useToast();
  const [paymentHistory, setPaymentHistory] = useState([
    { cycle: 14, amount: 204, date: '2024-01-10', status: 'paid' },
    { cycle: 13, amount: 204, date: '2024-01-05', status: 'paid' },
    { cycle: 12, amount: 204, date: '2023-12-31', status: 'paid' },
    { cycle: 11, amount: 204, date: '2023-12-26', status: 'paid' },
    { cycle: 10, amount: 204, date: '2023-12-21', status: 'paid' },
  ]);
  const [currentCycle, setCurrentCycle] = useState(cycleData.currentCycle);
  const [hasPaidThisCycle, setHasPaidThisCycle] = useState(false);

  // Mock member-specific data
  const memberData = {
    hasPaidThisCycle,
    paymentHistory,
    nextPayoutCycle: 18,
    totalContributed: 2800,
    totalReceived: 2400,
    memberPosition: 5
  };

  const handleMakePayment = () => {
    if (hasPaidThisCycle) {
      toast({
        title: "Already Paid",
        description: "You have already contributed for this cycle",
        variant: "destructive"
      });
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setHasPaidThisCycle(true);
    setPaymentHistory([
      { cycle: currentCycle, amount: 204, date: new Date().toISOString().slice(0, 10), status: 'paid' },
      ...paymentHistory,
    ]);
    toast({
      title: "Payment Successful",
      description: "Your KES 204 contribution has been received",
    });
    setShowPayment(false);
  };

  // Allow member to pay again for the next cycle
  const handleNextCycle = () => {
    setHasPaidThisCycle(false);
    setCurrentCycle(currentCycle + 1);
    setShowPayment(false);
  };

  return (
    <div className="space-y-6">
      {/* Payment Status Alert */}
      <Card className={`border-l-4 ${hasPaidThisCycle ? 'border-l-financial-success bg-financial-success/5' : 'border-l-financial-warning bg-financial-warning/5'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasPaidThisCycle ? (
                <CheckCircle className="w-6 h-6 text-financial-success" />
              ) : (
                <AlertCircle className="w-6 h-6 text-financial-warning" />
              )}
              <div>
                <h3 className="font-semibold">
                  {hasPaidThisCycle ? 'Payment Complete' : 'Payment Required'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {hasPaidThisCycle 
                    ? `You've contributed KES 204 for cycle #${currentCycle}`
                    : `KES 204 payment due in ${cycleData.daysLeft} days`
                  }
                </p>
              </div>
            </div>
            <Button onClick={handleMakePayment} variant="mpesa" size="sm">
              <Phone className="w-4 h-4 mr-2" />
              {hasPaidThisCycle ? "Pay Next Cycle" : "Pay via M-Pesa"}
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
              <span className="text-2xl font-bold text-mpesa-green">KES 204</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Destination:</span>
              <span className="font-medium">SMCF Group Till: <span className="font-bold">6938069</span></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your Number:</span>
              <span className="font-medium">{userData.phoneNumber}</span>
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <Button 
              onClick={handleMakePayment} 
              variant="mpesa" 
              size="lg"
              className="w-full text-lg font-semibold"
            >
              <Phone className="w-5 h-5 mr-2" />
              {hasPaidThisCycle ? "Pay Next Cycle" : "Send M-Pesa Payment"}
            </Button>
              <div className="mt-3">
                <Button variant="outline" className="w-full" onClick={() => setShowLoanRequest(true)}>
                  Request a Loan
                </Button>
              </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Direct STK Push:</strong> You will receive an M-Pesa prompt to enter your PIN and pay to Till <strong>6938069</strong>.</p>
              <p><strong>Multiple Payment Options:</strong></p>
              <p>• <strong>M-Pesa Paybill:</strong> 6938069 (Recommended)</p>
              <p>• <strong>Lipa na M-Pesa:</strong> Buy Goods & Services</p>
              <p>• <strong>M-Pesa App:</strong> Business &gt; Lipa na M-Pesa &gt; Till 6938069</p>
              <p>• <strong>USSD:</strong> *334# &gt; Lipa na M-Pesa &gt; Enter Till 6938069</p>
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
                  <Badge variant="secondary">{userData.memberId}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position in Queue:</span>
                  <span className="font-semibold">#{memberData.memberPosition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Contributed:</span>
                  <span className="font-semibold text-financial-success">
                    KES {memberData.totalContributed.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Received:</span>
                  <span className="font-semibold text-accent">
                    KES {memberData.totalReceived.toLocaleString()}
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
                    Cycle #{memberData.nextPayoutCycle}
                  </div>
                  <p className="text-muted-foreground">
                    Your turn to receive the group payout
                  </p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Expected Amount:</span>
                    <span className="font-semibold">KES {cycleData.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cycles to Wait:</span>
                    <span className="font-semibold">{memberData.nextPayoutCycle - currentCycle}</span>
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
                Cycle #{currentCycle} - Started {cycleData.cycleStartDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {cycleData.paidMembers}/{cycleData.totalMembers}
                  </div>
                  <div className="text-sm text-muted-foreground">Members Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-financial-success mb-1">
                    KES {cycleData.collectedAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Amount Collected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-financial-warning mb-1">
                    {cycleData.daysLeft}
                  </div>
                  <div className="text-sm text-muted-foreground">Days Remaining</div>
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
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div>
                        <div className="font-medium">Cycle #{payment.cycle}</div>
                        <div className="text-sm text-muted-foreground">{payment.date}</div>
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
              <CardDescription>
                When you receive group payouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h4 className="font-semibold text-accent mb-2">Next Payout</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    You will receive the group payout in cycle #{memberData.nextPayoutCycle}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span>Expected Amount:</span>
                    <span className="font-semibold">KES {cycleData.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">How Payouts Work</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Payouts are distributed based on member hierarchy</li>
                    <li>• You receive the full collected amount when it's your turn</li>
                    <li>• Payouts are sent directly to your M-Pesa number</li>
                    <li>• You'll receive SMS confirmation when funds are sent</li>
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
        cycle={currentCycle}
      />

      <LoanRequestDialog
        open={showLoanRequest}
        onOpenChange={setShowLoanRequest}
        memberId={userData.memberId}
        memberPhone={userData.phoneNumber}
        onSubmitted={() => {
          toast({ title: 'Request Sent', description: 'Your loan request has been sent to admin.' });
        }}
      />

      {/* Button to allow payment for next cycle after successful payment */}
      {hasPaidThisCycle && (
        <div className="text-center mt-4">
          <Button variant="mpesa" size="lg" onClick={handleNextCycle}>
            Pay for Next Cycle
          </Button>
        </div>
      )}
    </div>
  );
};

export default MemberDashboard;
// ...end of file...