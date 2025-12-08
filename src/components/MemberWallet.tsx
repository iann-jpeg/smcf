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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  Loader2,
  PiggyBank,
  Shield,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import smcfLogo from '@/assets/smcf-logo.png';

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
  const [paymentStep, setPaymentStep] = useState<
    "confirm" | "processing" | "waiting"
  >("confirm");
  const [pollCount, setPollCount] = useState(0);
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

    // Set up Socket.IO listeners for real-time updates
    const setupSocketListeners = async () => {
      try {
        const io = (await import("socket.io-client")).default;
        const socket = io(API_BASE, {
          transports: ["websocket", "polling"],
          reconnection: true,
        });

        // Listen for wallet deposit completions
        socket.on("payment:completed", (data: any) => {
          console.log("💰 Wallet payment completed event:", data);
          if (
            data.memberId === userData?._id &&
            data.type === "wallet_deposit"
          ) {
            console.log("✅ My wallet deposit completed!");

            // Clear poll interval
            if ((window as any).walletPollInterval) {
              clearInterval((window as any).walletPollInterval);
            }

            // Close the dialog and reset state
            setShowDepositDialog(false);
            setDepositAmount("");
            setIsProcessing(false);
            setPaymentStep("confirm");
            setPollCount(0);

            // Fetch updated wallet data
            fetchWalletData();

            // Show success notification
            toast({
              title: "Payment Successful! 🎉",
              description: `KES ${data.amount.toLocaleString()} has been added to your wallet`,
              duration: 5000,
            });
          }
        });

        // Listen for failed payments
        socket.on("payment:failed", (data: any) => {
          console.log("❌ Payment failed event:", data);
          if (data.memberId === userData?._id) {
            console.log("❌ My payment failed!");

            // Clear poll interval
            if ((window as any).walletPollInterval) {
              clearInterval((window as any).walletPollInterval);
            }

            setShowDepositDialog(false);
            setDepositAmount("");
            setIsProcessing(false);
            setPaymentStep("confirm");
            setPollCount(0);

            toast({
              title: "Payment Failed",
              description:
                data.message || "Payment was not completed. Please try again.",
              variant: "destructive",
              duration: 5000,
            });
          }
        });

        // Listen for new savings records
        socket.on("saving:new", (data: any) => {
          console.log("💾 New saving record event:", data);
          if (data.memberId === userData?._id) {
            console.log("✅ My saving record created!");
            fetchWalletData();
          }
        });

        return () => {
          socket.disconnect();
        };
      } catch (error) {
        console.error("Socket.IO setup error:", error);
      }
    };

    setupSocketListeners();

    // Refresh every 30 seconds as backup
    const interval = setInterval(fetchWalletData, 30000);
    return () => clearInterval(interval);
  }, [userData?._id]);

  const resetDepositDialog = () => {
    setPaymentStep("confirm");
    setIsProcessing(false);
    setDepositAmount("");
    setPollCount(0);
    if ((window as any).walletPollInterval) {
      clearInterval((window as any).walletPollInterval);
    }
  };

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

    setPaymentStep("processing");
    setIsProcessing(true);

    try {
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
        setPaymentStep("waiting");
        setIsProcessing(false);
        setPollCount(0);

        toast({
          title: "STK Push Sent! 📱",
          description: `Check your phone (${phoneNumber}) and enter your M-Pesa PIN`,
          duration: 5000,
        });

        // Start poll counter animation (visual only, backend handles actual polling)
        const pollInterval = setInterval(() => {
          setPollCount((prev) => {
            if (prev >= 60) {
              clearInterval(pollInterval);
              return 60;
            }
            return prev + 1;
          });
        }, 1000);

        // Store interval for cleanup
        (window as any).walletPollInterval = pollInterval;
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

    if (amount > (summary.currentBalance || 0)) {
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

  const generateWalletPDF = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Wallet Statement</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
    .logo { max-width: 120px; height: auto; margin: 0 auto 15px; display: block; }
    .header h1 { color: #2563eb; margin: 0; font-size: 28px; }
    .header p { color: #666; margin: 5px 0; }
    .section { margin: 30px 0; }
    .section h2 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 20px; font-weight: bold; color: #2563eb; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    .type-deposit { color: #16a34a; font-weight: bold; }
    .type-withdrawal { color: #dc2626; font-weight: bold; }
    .type-interest { color: #2563eb; font-weight: bold; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${smcfLogo}" alt="SMCF Logo" class="logo" />
    <h1>SMCF - Smart Moves Cash Flow</h1>
    <p>Wallet Statement</p>
    <p>Member: ${userData?.name || 'Member'} (${userData?.member_id || '-'})</p>
    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>

  <div class="section">
    <h2>Account Summary</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Current Balance</div>
        <div class="stat-value">KES ${(summary.currentBalance || 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Deposits</div>
        <div class="stat-value">KES ${(summary.totalDeposits || 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Withdrawals</div>
        <div class="stat-value">KES ${(summary.totalWithdrawals || 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Interest Earned</div>
        <div class="stat-value">KES ${(summary.totalInterestEarned || 0).toLocaleString()}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Recent Transactions</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Balance After</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.slice(0, 20).map(txn => `
          <tr>
            <td>${new Date(txn.date || txn.created_at).toLocaleDateString()}</td>
            <td class="type-${txn.type}">${(txn.type || 'transaction').toUpperCase()}</td>
            <td>KES ${(txn.amount || 0).toLocaleString()}</td>
            <td>KES ${(txn.balance_after || 0).toLocaleString()}</td>
            <td>${(txn.status || 'completed').toUpperCase()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p><strong>SMCF - Smart Moves Cash Flow</strong></p>
    <p>Digital Table Banking Platform | Automated Contributions | Secure Transactions</p>
    <p>This statement is confidential and intended for the account holder only.</p>
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        toast({
          title: 'PDF Ready',
          description: 'Print dialog opened. Choose "Save as PDF" to download.',
        });
      }, 500);
    } else {
      toast({
        title: 'Pop-up Blocked',
        description: 'Please allow pop-ups for this site.',
        variant: 'destructive',
      });
    }
  };

  const exportWalletCSV = () => {
    try {
      const csvData = [
        ['SMCF - Smart Moves Cash Flow', 'Wallet Statement', `Generated: ${new Date().toLocaleString()}`],
        ['Member', userData?.name || 'Member', 'ID:', userData?.member_id || '-'],
        [],
        ['Account Summary'],
        ['Current Balance', `KES ${(summary.currentBalance || 0).toLocaleString()}`],
        ['Total Deposits', `KES ${(summary.totalDeposits || 0).toLocaleString()}`],
        ['Total Withdrawals', `KES ${(summary.totalWithdrawals || 0).toLocaleString()}`],
        ['Interest Earned', `KES ${(summary.totalInterestEarned || 0).toLocaleString()}`],
        [],
        ['Date', 'Type', 'Amount', 'Balance After', 'Status'],
        ...transactions.slice(0, 20).map(txn => [
          new Date(txn.date || txn.created_at).toLocaleDateString(),
          txn.type || 'transaction',
          txn.amount || 0,
          txn.balance_after || 0,
          txn.status || 'completed',
        ]),
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smcf-wallet-statement-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'CSV Export Complete',
        description: 'Wallet statement has been downloaded as CSV',
      });
    } catch (err) {
      toast({
        title: 'CSV Export Failed',
        description: 'Could not export CSV report',
        variant: 'destructive',
      });
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
              KES {(summary.currentBalance || 0).toLocaleString()}
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
            <div className="text-2xl font-bold">
              KES {(summary.totalDeposits || 0).toLocaleString()}
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
              KES {(summary.totalInterestEarned || 0).toLocaleString()}
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
              KES {(summary.totalWithdrawals || 0).toLocaleString()}
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
            disabled={(summary.currentBalance || 0) === 0}>
            <ArrowUpRight className="w-4 h-4" />
            Request Withdrawal
          </Button>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Transaction History
              </CardTitle>
              <CardDescription>
                Your recent savings transactions and interest earnings
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={exportWalletCSV}
                variant="outline"
                size="sm"
                disabled={transactions.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={generateWalletPDF}
                variant="default"
                size="sm"
                disabled={transactions.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
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
                      KES {(transaction.amount || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Balance: KES {(transaction.balance_after || 0).toLocaleString()}
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
      <Dialog
        open={showDepositDialog}
        onOpenChange={(open) => {
          setShowDepositDialog(open);
          if (!open) {
            setTimeout(resetDepositDialog, 300);
          }
        }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-financial-success" />
              Wallet Deposit
            </DialogTitle>
            <DialogDescription>
              {paymentStep === "confirm" &&
                "Add money to your savings wallet via M-Pesa"}
              {paymentStep === "processing" &&
                "Sending STK Push to your phone..."}
              {paymentStep === "waiting" && "Complete payment on your phone"}
            </DialogDescription>
          </DialogHeader>

          {/* Confirm Step */}
          {paymentStep === "confirm" && (
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

              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone Number:</span>
                    <span className="font-semibold">{userData?.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">
                      Deposit Amount:
                    </span>
                    <span className="text-lg font-bold text-financial-success">
                      KES {depositAmount || "0"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
                <p className="text-blue-800">
                  💡 <strong>Earn 3% monthly interest</strong> on your savings!
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium">Secure Payment</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Processed securely through Lipia Online's encrypted gateway
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDepositDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDeposit}
                  disabled={isProcessing}
                  variant="mpesa">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay via M-Pesa
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Processing Step */}
          {paymentStep === "processing" && (
            <div className="space-y-6 text-center py-4">
              <div className="animate-financial-pulse">
                <Smartphone className="w-16 h-16 text-financial-success mx-auto mb-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Initiating Payment
                </h3>
                <p className="text-muted-foreground mb-4">
                  Sending STK Push to {userData?.phone}...
                </p>
                <Progress value={50} className="h-2" />
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Please wait while we send the payment request to your phone
                </p>
              </div>
            </div>
          )}

          {/* Waiting Step */}
          {paymentStep === "waiting" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="animate-bounce">
                  <div className="w-16 h-16 bg-financial-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-8 h-8 text-financial-success animate-pulse" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Waiting for M-Pesa PIN
                </h3>
                <p className="text-muted-foreground mb-4">
                  Check your phone ({userData?.phone}) and enter your M-Pesa PIN
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                  <Clock className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    Polling... ({pollCount}/60)
                  </span>
                </div>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Progress value={(pollCount / 60) * 100} className="h-2" />

                    <div className="bg-financial-success/10 p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-financial-success" />
                        <span className="text-sm font-medium">
                          STK Push Sent Successfully
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A payment prompt has been sent to your phone. Enter your
                        M-Pesa PIN to complete the deposit.
                      </p>
                    </div>

                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Steps to complete:</strong>
                        <br />
                        1. Check your phone for M-Pesa notification
                        <br />
                        2. Enter your M-Pesa PIN
                        <br />
                        3. Wait for confirmation
                      </p>
                    </div>

                    <div className="bg-financial-warning/10 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-financial-warning" />
                        <span className="text-sm font-medium">
                          Security Reminder
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Never share your M-Pesa PIN with anyone. SMCF will never
                        ask for your PIN directly.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
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
                max={summary.currentBalance || 0}
              />
              <div className="text-sm text-muted-foreground mt-1">
                Available: KES {(summary.currentBalance || 0).toLocaleString()}
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
