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
  ArrowRightLeft,
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
import { useEffect, useState, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import smcfLogo from '@/assets/newsmcflogo.png';
import TopSaverBadge from "@/components/analytics/TopSaverBadge";
import MemberQRCode from "@/components/MemberQRCode";
import QRScanner from "@/components/QRScanner";
import { StyledSMCF } from "@/components/StyledSMCF";

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
  const [transactionFees, setTransactionFees] = useState<any[]>([]);
  const [totalFeesPaid, setTotalFeesPaid] = useState(0);
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
  const [isTopSaver, setIsTopSaver] = useState(false);
  const { toast } = useToast();

  const fetchWalletData = useCallback(async () => {
    try {
      const [summaryRes, transactionsRes, allSavingsRes, feesRes] = await Promise.all([
        fetch(`${API_BASE}/api/savings/summary`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/savings/transactions?limit=20`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/savings/all-members`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/savings/fees?limit=50`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ]);

      const summaryData = await summaryRes.json();
      const transactionsData = await transactionsRes.json();
      const allSavingsData = await allSavingsRes.json();
      const feesData = await feesRes.json();

      if (summaryData.success) {
        setSummary(summaryData.data);
        // Use totalTransactionFees from summary if available
        if (summaryData.data.totalTransactionFees !== undefined) {
          setTotalFeesPaid(summaryData.data.totalTransactionFees);
        }
      }

      if (transactionsData.success) {
        setTransactions(transactionsData.data);
      }

      // Get member's own fees from the dedicated endpoint
      if (feesData.success && feesData.data) {
        const memberFees = feesData.data.fees || [];
        setTransactionFees(memberFees);
        
        // Use the totalFees from backend response
        if (feesData.data.totalFees !== undefined) {
          setTotalFeesPaid(feesData.data.totalFees);
        }
      }

      // Determine if this member is the top saver based on total deposits
      if (allSavingsData.success && allSavingsData.data && summaryData.success) {
        const members = allSavingsData.data.filter((m: any) => (m.totalDeposits || 0) > 0);
        
        if (members.length > 0) {
          const topSaver = members.reduce((top: any, member: any) => 
            (member.totalDeposits || 0) > (top.totalDeposits || 0) ? member : top
          );
          
          // Try multiple ID comparisons
          const userIdStr = String(userData._id || userData.id);
          const userMemberId = userData.member_id || userData.memberId;
          const topSaverIdStr = String(topSaver._id || topSaver.id);
          const topSaverMemberId = topSaver.member_id || topSaver.memberId;
          
          // Show top 5 savers for debugging
          const topFive = members
            .sort((a: any, b: any) => (b.totalDeposits || 0) - (a.totalDeposits || 0))
            .slice(0, 5)
            .map((m: any) => `${m.name} (${m.member_id}): KES ${(m.totalDeposits || 0).toLocaleString()}`);
          
          console.log("🏆 Top Saver Check:", {
            topSaverId: topSaverIdStr,
            topSaverMemberId: topSaverMemberId,
            topSaverName: topSaver.name,
            topSaverDeposits: topSaver.totalDeposits,
            currentUserId: userIdStr,
            currentUserMemberId: userMemberId,
            currentUserName: userData.name,
            currentUserDeposits: summaryData.data.totalDeposits,
            isMatchById: topSaverIdStr === userIdStr,
            isMatchByMemberId: topSaverMemberId === userMemberId,
            totalMembersWithDeposits: members.length,
            topFive
          });
          
          // Check both _id and member_id
          const isTop = ((topSaverIdStr === userIdStr) || (topSaverMemberId && topSaverMemberId === userMemberId)) 
                        && summaryData.data.totalDeposits > 0;
          setIsTopSaver(isTop);
          
          if (isTop) {
            console.log("✅ YOU ARE THE TOP SAVER!");
          } else {
            console.log("❌ Not the top saver");
          }
        } else {
          console.log("ℹ️ No members with deposits found");
          setIsTopSaver(false);
        }
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    }
  }, [userData]);

  // Auto-refresh when user opens the app, switches back to tab, or device comes online
  useAutoRefresh({
    onRefresh: fetchWalletData,
    refreshOnVisible: true,
    refreshOnFocus: true,
    refreshOnOnline: true,
    debounceMs: 3000,
  });

  useEffect(() => {

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

            // Stop polling immediately
            if ((window as any).walletPollInterval) {
              clearInterval((window as any).walletPollInterval);
            }
            if ((window as any).walletPollingActive) {
              (window as any).walletPollingActive = false;
            }

            // Close the dialog and reset state
            setShowDepositDialog(false);
            setDepositAmount("");
            setIsProcessing(false);
            setPaymentStep("confirm");
            setPollCount(0);

            // Show success notification with fee info if applicable
            const feeMessage = data.fee && data.fee > 0
              ? `(Fee: KES ${data.fee.toLocaleString()}, Net: KES ${data.amount.toLocaleString()})`
              : '';
            
            toast({
              title: "Payment Successful! 🎉",
              description: `KES ${data.grossAmount?.toLocaleString() || data.amount.toLocaleString()} deposited ${feeMessage}`,
              duration: 5000,
            });

            // Fetch updated wallet data immediately and again after 1 second
            fetchWalletData();
            setTimeout(() => {
              fetchWalletData();
            }, 1000);
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

        // Listen for savings deposits
        socket.on("savingDeposit", (data: any) => {
          console.log("💰 Saving deposit event:", data);
          if (data.memberId === userData?._id) {
            console.log("✅ My deposit received!");
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
      const res = await fetch(`${API_BASE}/api/lipia/stk-push`, {
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

        const checkoutRequestID = data.CheckoutRequestID || data.TransactionReference;

        toast({
          title: "STK Push Sent! 📱",
          description: `Check your phone (${phoneNumber}) and enter your M-Pesa PIN`,
          duration: 5000,
        });

        // Start actual polling for payment status
        let pollAttempts = 0;
        let pollingActive = true;
        
        const pollPaymentStatus = async () => {
          if (!pollingActive) return;
          
          pollAttempts++;
          setPollCount(pollAttempts);

          // Stop after 60 attempts (60 seconds)
          if (pollAttempts >= 60) {
            pollingActive = false;
            clearInterval((window as any).walletPollInterval);
            toast({
              title: "Payment Verification Timeout",
              description: "Please check your transaction history",
              variant: "destructive",
            });
            setPaymentStep("confirm");
            setIsProcessing(false);
            return;
          }

          try {
            const statusRes = await fetch(`${API_BASE}/api/lipia/query-status`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...authService.getAuthHeaders(),
              },
              body: JSON.stringify({
                checkoutRequestID,
                transactionReference: checkoutRequestID,
              }),
            });

            const statusData = await statusRes.json();

            if (statusData.success && (statusData.ResultCode === "0" || statusData.ResultCode === 0 || statusData.status === "completed")) {
              // Payment successful!
              pollingActive = false;
              clearInterval((window as any).walletPollInterval);
              
              setShowDepositDialog(false);
              setDepositAmount("");
              setIsProcessing(false);
              setPaymentStep("confirm");
              setPollCount(0);

              toast({
                title: "Payment Successful! 🎉",
                description: `KES ${amount.toLocaleString()} deposited to your wallet`,
                duration: 5000,
              });

              // Refresh wallet data immediately and again after 1 second to ensure backend has processed
              fetchWalletData();
              setTimeout(() => {
                fetchWalletData();
              }, 1000);
            }
          } catch (error) {
            console.error("Polling error:", error);
          }
        };

        // Start polling immediately, then every second
        pollPaymentStatus();
        const pollInterval = setInterval(pollPaymentStatus, 1000);
        
        // Store interval for cleanup
        (window as any).walletPollInterval = pollInterval;
        (window as any).walletPollingActive = () => pollingActive;
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

  const generateTransactionStatement = (transaction: any) => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Transaction Statement</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
    .logo { max-width: 120px; height: auto; margin: 0 auto 15px; display: block; }
    .header h1 { color: #2563eb; margin: 0; font-size: 28px; }
    .header p { color: #666; margin: 5px 0; }
    .receipt-box { background: #f9fafb; border: 2px solid #2563eb; border-radius: 12px; padding: 30px; margin: 30px 0; }
    .receipt-title { text-align: center; color: #2563eb; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .receipt-row { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-label { font-weight: 600; color: #666; }
    .receipt-value { font-weight: bold; color: #333; }
    .amount-highlight { font-size: 32px; color: #16a34a; text-align: center; margin: 20px 0; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; }
    .status-completed { background: #dcfce7; color: #16a34a; }
    .status-pending { background: #fef3c7; color: #d97706; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(37, 99, 235, 0.05); font-weight: bold; z-index: -1; }
  </style>
</head>
<body>
  <div class="watermark">SMCF</div>
  <div class="header">
    <img src="${smcfLogo}" alt="SMCF Logo" class="logo" />
    <h1>SMCF - Smart Moves Cash Flow</h1>
    <p>Transaction Statement</p>
    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>

  <div class="receipt-box">
    <div class="receipt-title">Transaction Receipt</div>
    
    <div class="amount-highlight">
      ${transaction.transaction_type === "withdrawal" ? "-" : "+"}KES ${(transaction.amount || 0).toLocaleString()}
    </div>

    <div class="receipt-row">
      <span class="receipt-label">Transaction ID</span>
      <span class="receipt-value">${transaction._id}</span>
    </div>
    
    <div class="receipt-row">
      <span class="receipt-label">Member Name</span>
      <span class="receipt-value">${userData?.name || 'Member'}</span>
    </div>
    
    <div class="receipt-row">
      <span class="receipt-label">Member ID</span>
      <span class="receipt-value">${userData?.member_id || '-'}</span>
    </div>
    
    <div class="receipt-row">
      <span class="receipt-label">Transaction Type</span>
      <span class="receipt-value">${(transaction.transaction_type || 'transaction').toUpperCase()}</span>
    </div>
    
    <div class="receipt-row">
      <span class="receipt-label">Date & Time</span>
      <span class="receipt-value">${new Date(transaction.created_at).toLocaleString()}</span>
    </div>
    
    <div class="receipt-row">
      <span class="receipt-label">Amount</span>
      <span class="receipt-value">KES ${(transaction.amount || 0).toLocaleString()}</span>
    </div>
    
    <div class="receipt-row">
      <span class="receipt-label">Balance After</span>
      <span class="receipt-value">KES ${(transaction.balance_after || 0).toLocaleString()}</span>
    </div>
    
    ${transaction.mpesa_receipt ? `
    <div class="receipt-row">
      <span class="receipt-label">M-Pesa Receipt</span>
      <span class="receipt-value">${transaction.mpesa_receipt}</span>
    </div>
    ` : ''}
    
    ${transaction.notes ? `
    <div class="receipt-row">
      <span class="receipt-label">Notes</span>
      <span class="receipt-value">${transaction.notes}</span>
    </div>
    ` : ''}
    
    <div class="receipt-row">
      <span class="receipt-label">Status</span>
      <span class="receipt-value">
        <span class="status-badge status-${transaction.status}">${(transaction.status || 'completed').toUpperCase()}</span>
      </span>
    </div>
  </div>

  <div class="footer">
    <p><strong>SMCF - Smart Moves Cash Flow</strong></p>
    <p>Digital Table Banking Platform | Automated Contributions | Secure Transactions</p>
    <p>This is an official transaction statement. For queries, contact SMCF support.</p>
    <p style="margin-top: 15px; font-size: 10px;">Statement ID: ${transaction._id} | Printed: ${new Date().toLocaleString()}</p>
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
          title: 'Statement Ready',
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

  console.log("🎨 Rendering MemberWallet, isTopSaver:", isTopSaver);

  return (
    <div className="space-y-6">
      {/* Top Saver Badge */}
      {isTopSaver && (
        <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TopSaverBadge 
                isTopSaver={true} 
                currentBalance={summary.totalDeposits}
                className="text-base"
              />
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                  🎉 Congratulations! You're the Top Saver!
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  You have the highest total deposits: KES {(summary.totalDeposits || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Transaction Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              KES {totalFeesPaid.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {transactionFees.length} fee charges
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
        <CardContent className="flex flex-wrap gap-3">
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
          <QRScanner onScanSuccess={fetchWalletData} />
        </CardContent>
      </Card>

      {/* Member QR Code */}
      <MemberQRCode userData={userData} />

      {/* Transaction Fees Breakdown */}
      {transactionFees.length > 0 && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  Transaction Fees Breakdown
                </CardTitle>
                <CardDescription>
                  Fees charged on your wallet transactions
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                Total: KES {totalFeesPaid.toLocaleString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactionFees.map((fee) => (
                <div
                  key={fee._id}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100">
                      {fee.transaction_type === "transfer" && <ArrowRightLeft className="w-4 h-4 text-amber-700" />}
                      {fee.transaction_type === "top_up" && <ArrowDownLeft className="w-4 h-4 text-amber-700" />}
                      {fee.transaction_type === "withdrawal" && <ArrowUpRight className="w-4 h-4 text-amber-700" />}
                    </div>
                    <div>
                      <div className="font-medium capitalize text-amber-900">
                        {fee.transaction_type.replace("_", " ")} Fee
                      </div>
                      <div className="text-sm text-amber-700">
                        {fee.fee_description}
                      </div>
                      <div className="text-xs text-amber-600 mt-1">
                        {new Date(fee.created_at).toLocaleString()}
                        {fee.recipient_id && (
                          <span className="ml-2">
                            • To: {fee.recipient_id.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-amber-700">
                      KES {fee.fee_amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-amber-600">
                      on KES {fee.transaction_amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">💡 Fee Information:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Transfers under KES 100 are free</li>
                  <li>• Direct deposits are free (no fee)</li>
                  <li>• STK Push deposits: KES 5 per transaction</li>
                  <li>• Withdrawal fees range from KES 10 to KES 80</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                      {transaction.status === "failed" && transaction.rejection_reason && (
                        <div className="text-xs text-destructive mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
                          <span className="font-medium">Rejection Reason: </span>
                          {transaction.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
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
                    <Button
                      onClick={() => generateTransactionStatement(transaction)}
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      title="Download Statement">
                      <Download className="w-4 h-4" />
                    </Button>
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
                        Never share your M-Pesa PIN with anyone. We will never
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
