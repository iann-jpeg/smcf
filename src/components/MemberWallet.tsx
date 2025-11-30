import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  DollarSign,
  Loader2,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

interface MemberWalletProps {
  userData: any;
}

const MemberWallet = ({ userData }: MemberWalletProps) => {
  const [summary, setSummary] = useState({
    currentBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalInterestEarned: 0,
    transactionCount: 0,
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const { toast } = useToast();

  const fetchWalletData = async () => {
    try {
      const [summaryRes, transactionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/savings/summary`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/savings/transactions?limit=20`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ]);

      const summaryData = await summaryRes.json();
      const transactionsData = await transactionsRes.json();

      if (summaryData.success) {
        setSummary(summaryData.data);
      }

      if (transactionsData.success) {
        setTransactions(transactionsData.data);
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    }
  };

  useEffect(() => {
    fetchWalletData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchWalletData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Get phone number from userData or authService
    const phoneNumber = userData?.phone || authService.getUser()?.phone;

    if (!phoneNumber) {
      toast({
        title: "Phone Number Missing",
        description: "Please update your profile with a phone number",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Initiate STK Push payment
      toast({
        title: "Initiating Payment",
        description: "Please check your phone for M-Pesa prompt...",
      });

      const res = await fetch(`${API_BASE}/api/payments/stk-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          amount,
          phone: phoneNumber,
          type: "wallet_deposit",
          notes: `Wallet deposit - KES ${amount}`,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Payment Request Sent",
          description: "Please enter your M-Pesa PIN on your phone",
        });

        // Poll for payment status
        const checkoutRequestId = data.CheckoutRequestID;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        const pollPayment = setInterval(async () => {
          attempts++;

          try {
            const statusRes = await fetch(
              `${API_BASE}/api/payments/check-status/${checkoutRequestId}`,
              {
                headers: { ...authService.getAuthHeaders() },
              }
            );

            const statusData = await statusRes.json();

            if (statusData.status === "completed") {
              clearInterval(pollPayment);
              toast({
                title: "Deposit Successful!",
                description: `KES ${amount} has been added to your wallet`,
              });
              setShowDepositDialog(false);
              setDepositAmount("");
              setIsProcessing(false);
              fetchWalletData();
            } else if (
              statusData.status === "failed" ||
              attempts >= maxAttempts
            ) {
              clearInterval(pollPayment);
              toast({
                title: "Payment Failed",
                description:
                  statusData.message || "Payment was cancelled or timed out",
                variant: "destructive",
              });
              setIsProcessing(false);
            }
          } catch (error) {
            console.error("Error checking payment status:", error);
          }
        }, 1000);
      } else {
        throw new Error(data.error || "Failed to initiate payment");
      }
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > summary.currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough balance for this withdrawal",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/savings/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          amount,
          notes: withdrawNotes,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Withdrawal Requested",
          description: data.message,
        });
        setShowWithdrawDialog(false);
        setWithdrawAmount("");
        setWithdrawNotes("");
        fetchWalletData();
      } else {
        throw new Error(data.error || "Withdrawal failed");
      }
    } catch (error: any) {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case "withdrawal":
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case "interest":
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: { variant: "default", className: "bg-green-600" },
      pending: { variant: "secondary", className: "bg-yellow-600" },
      failed: { variant: "destructive" },
    };

    const config = variants[status] || variants.completed;

    return (
      <Badge variant={config.variant} className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Wallet Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              KES {summary.currentBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4" />
              Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              KES {summary.totalDeposits.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Interest Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              KES {summary.totalInterestEarned.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              3% monthly rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" />
              Total Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              KES {summary.totalWithdrawals.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet Actions</CardTitle>
          <CardDescription>
            Deposit money to your savings wallet or request withdrawals
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            onClick={() => setShowDepositDialog(true)}
            className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4" />
            Deposit Money
          </Button>
          <Button
            onClick={() => setShowWithdrawDialog(true)}
            variant="outline"
            className="flex items-center gap-2"
            disabled={summary.currentBalance === 0}>
            <ArrowUpRight className="w-4 h-4" />
            Request Withdrawal
          </Button>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            Your recent savings transactions and interest earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PiggyBank className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm">Start saving today!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-muted">
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div>
                      <div className="font-medium capitalize">
                        {transaction.transaction_type}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString()}
                      </div>
                      {transaction.notes && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {transaction.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        transaction.transaction_type === "deposit" ||
                        transaction.transaction_type === "interest"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                      {transaction.transaction_type === "withdrawal"
                        ? "-"
                        : "+"}
                      KES {transaction.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Balance: KES {transaction.balance_after.toLocaleString()}
                    </div>
                    <div className="mt-1">
                      {getStatusBadge(transaction.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit to Wallet</DialogTitle>
            <DialogDescription>
              Add money to your savings wallet. Earn 3% monthly interest!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="depositAmount">Amount (KES)</Label>
              <Input
                id="depositAmount"
                type="number"
                placeholder="Enter amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="1"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
              <p className="text-blue-800">
                💡 <strong>Earn 3% monthly interest</strong> on your savings!
              </p>
              <p className="text-blue-700 mt-1">
                Payment Method: M-Pesa Paybill 6938069
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDepositDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeposit} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Request to withdraw money from your savings wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdrawAmount">Amount (KES)</Label>
              <Input
                id="withdrawAmount"
                type="number"
                placeholder="Enter amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="1"
                max={summary.currentBalance}
              />
              <div className="text-sm text-muted-foreground mt-1">
                Available: KES {summary.currentBalance.toLocaleString()}
              </div>
            </div>
            <div>
              <Label htmlFor="withdrawNotes">Reason (Optional)</Label>
              <Textarea
                id="withdrawNotes"
                placeholder="Enter reason for withdrawal..."
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
              <p className="text-amber-800">
                ⚠️ Withdrawal requests require admin approval
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleWithdrawal} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberWallet;
