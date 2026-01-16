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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Loader2,
  PiggyBank,
  TrendingUp,
  XCircle,
} from "lucide-react";
import smcfLogo from '@/assets/newsmcflogo.png';
import { useEffect, useState } from "react";
import SavingsChart from "@/components/analytics/SavingsChart";
import TopSaverBadge from "@/components/analytics/TopSaverBadge";

interface AdminSavingsTabProps {
  isReadOnly?: boolean;
}

const AdminSavingsTab = ({ isReadOnly = false }: AdminSavingsTabProps) => {
  const [membersWithSavings, setMembersWithSavings] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplyingInterest, setIsApplyingInterest] = useState(false);
  const { toast } = useToast();

  const fetchSavingsData = async () => {
    try {
      const [membersRes, withdrawalsRes] = await Promise.all([
        fetch(`${API_BASE}/api/savings/admin/all`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/savings/admin/pending-withdrawals`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ]);

      const membersData = await membersRes.json();
      const withdrawalsData = await withdrawalsRes.json();

      console.log("📊 Admin savings data received:", membersData);
      console.log("📊 Members with savings count:", membersData.data?.length);
      
      if (membersData.success) {
        console.log("✅ Setting members with savings:", membersData.data);
        setMembersWithSavings(membersData.data);
        
        // Log totals for debugging
        const totalBalance = membersData.data.reduce((sum: number, m: any) => sum + (m.currentBalance || 0), 0);
        const totalDeps = membersData.data.reduce((sum: number, m: any) => sum + (m.totalDeposits || 0), 0);
        const totalInt = membersData.data.reduce((sum: number, m: any) => sum + (m.totalInterestEarned || 0), 0);
        console.log("💰 Calculated totals - Balance:", totalBalance, "Deposits:", totalDeps, "Interest:", totalInt);
      }

      if (withdrawalsData.success) {
        setPendingWithdrawals(withdrawalsData.data);
      }
    } catch (error) {
      console.error("Error fetching savings data:", error);
    }
  };

  useEffect(() => {
    fetchSavingsData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchSavingsData, 30000);

    // Listen for real-time withdrawal requests and status updates
    const socket = (window as any).socket;
    if (socket) {
      socket.on("withdrawalRequest", () => {
        console.log("💰 New withdrawal request received");
        fetchSavingsData();
      });

      socket.on("withdrawalStatusUpdated", () => {
        console.log("💰 Withdrawal status updated");
        fetchSavingsData();
      });

      socket.on("savingDeposit", () => {
        console.log("💰 New deposit received");
        fetchSavingsData();
        // Refetch after 1 second to ensure backend has processed
        setTimeout(() => {
          fetchSavingsData();
        }, 1000);
      });

      socket.on("saving:new", () => {
        console.log("💰 New saving transaction");
        fetchSavingsData();
        // Refetch after 1 second to ensure backend has processed
        setTimeout(() => {
          fetchSavingsData();
        }, 1000);
      });

      socket.on("payment:completed", (data: any) => {
        if (data.type === "wallet_deposit") {
          console.log("💰 Wallet deposit completed in admin view");
          fetchSavingsData();
          // Refetch after 1 second to ensure backend has processed
          setTimeout(() => {
            fetchSavingsData();
          }, 1000);
        }
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off("withdrawalRequest");
        socket.off("withdrawalStatusUpdated");
        socket.off("savingDeposit");
        socket.off("saving:new");
        socket.off("payment:completed");
      }
    };
  }, []);

  const handleWithdrawalAction = async (
    withdrawalId: string,
    status: "completed" | "failed"
  ) => {
    setIsProcessing(true);
    try {
      // Use the new dedicated endpoints for approval/rejection
      const endpoint = status === "completed" 
        ? `${API_BASE}/api/savings/admin/approve-withdrawal/${withdrawalId}`
        : `${API_BASE}/api/savings/admin/reject-withdrawal/${withdrawalId}`;
      
      const requestBody = status === "failed" 
        ? { rejection_reason: "Rejected by admin from Savings Management tab" }
        : undefined;
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        ...(requestBody && { body: JSON.stringify(requestBody) }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: status === "completed" ? "Withdrawal Approved" : "Withdrawal Rejected",
          description: data.message,
        });
        fetchSavingsData();
      } else {
        throw new Error(data.error || "Action failed");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyInterest = async () => {
    if (
      !confirm(
        "Are you sure you want to apply 3% monthly interest to all member savings? This action will create interest transactions for all members with savings."
      )
    ) {
      return;
    }

    setIsApplyingInterest(true);
    try {
      const res = await fetch(`${API_BASE}/api/savings/admin/apply-interest`, {
        method: "POST",
        headers: {
          ...authService.getAuthHeaders(),
        },
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Interest Applied",
          description: data.message,
        });
        fetchSavingsData();
      } else {
        throw new Error(data.error || "Failed to apply interest");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsApplyingInterest(false);
    }
  };

  const generateSavingsPDF = () => {
    const totalSavings = membersWithSavings.reduce((sum, m) => sum + (m.currentBalance || 0), 0);
    const totalDeposits = membersWithSavings.reduce((sum, m) => sum + (m.totalDeposits || 0), 0);
    const totalInterest = membersWithSavings.reduce((sum, m) => sum + (m.totalInterestEarned || 0), 0);
    const membersWithBalance = membersWithSavings.filter((m) => (m.currentBalance || 0) > 0).length;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Savings Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
    .logo { max-width: 120px; height: auto; margin: 0 auto 15px; display: block; }
    .header h1 { color: #2563eb; margin: 0; font-size: 28px; }
    .header p { color: #666; margin: 5px 0; }
    .section { margin: 30px 0; }
    .section h2 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 20px; font-weight: bold; color: #2563eb; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${smcfLogo}" alt="SMCF Logo" class="logo" />
    <h1>SMCF - Smart Moves Cash Flow</h1>
    <p>Savings Report</p>
    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>

  <div class="section">
    <h2>Savings Summary</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Savings Pool</div>
        <div class="stat-value">KES ${totalSavings.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Savers</div>
        <div class="stat-value">${membersWithBalance}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Deposits</div>
        <div class="stat-value">KES ${totalDeposits.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Interest</div>
        <div class="stat-value">KES ${totalInterest.toLocaleString()}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Member Savings</h2>
    <table>
      <thead>
        <tr>
          <th>Member</th>
          <th>Member ID</th>
          <th>Current Balance</th>
          <th>Total Deposits</th>
          <th>Interest Earned</th>
          <th>Last Transaction</th>
        </tr>
      </thead>
      <tbody>
        ${membersWithSavings.map(member => `
          <tr>
            <td>${member.name || 'Unknown'}</td>
            <td>${member.member_id || '-'}</td>
            <td>KES ${(member.currentBalance || 0).toLocaleString()}</td>
            <td>KES ${(member.totalDeposits || 0).toLocaleString()}</td>
            <td>KES ${(member.totalInterestEarned || 0).toLocaleString()}</td>
            <td>${member.lastTransactionDate ? new Date(member.lastTransactionDate).toLocaleDateString() : '-'}</td>
          </tr>
        `).join('')}
        <tr style="font-weight:bold;background:#e5e7eb;">
          <td colspan="2">Grand Total</td>
          <td>KES ${totalSavings.toLocaleString()}</td>
          <td>KES ${totalDeposits.toLocaleString()}</td>
          <td>KES ${totalInterest.toLocaleString()}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p><strong>SMCF - Smart Moves Cash Flow</strong></p>
    <p>Digital Table Banking Platform | Automated Contributions | Secure Transactions</p>
    <p>This report is confidential and intended for authorized personnel only.</p>
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

  const exportSavingsCSV = () => {
    try {
      const totalSavings = membersWithSavings.reduce((sum, m) => sum + (m.currentBalance || 0), 0);
      const totalDeposits = membersWithSavings.reduce((sum, m) => sum + (m.totalDeposits || 0), 0);
      const totalInterest = membersWithSavings.reduce((sum, m) => sum + (m.totalInterestEarned || 0), 0);

      const csvData = [
        ['SMCF - Smart Moves Cash Flow', 'Savings Report', `Generated: ${new Date().toLocaleString()}`],
        [],
        ['Member', 'Member ID', 'Current Balance', 'Total Deposits', 'Interest Earned', 'Last Transaction'],
        ...membersWithSavings.map(member => [
          member.name || 'Unknown',
          member.member_id || '-',
          member.currentBalance || 0,
          member.totalDeposits || 0,
          member.totalInterestEarned || 0,
          member.lastTransactionDate ? new Date(member.lastTransactionDate).toLocaleDateString() : '-',
        ]),
        [],
        ['Summary'],
        ['Total Savings Pool', `KES ${totalSavings.toLocaleString()}`],
        ['Total Deposits', `KES ${totalDeposits.toLocaleString()}`],
        ['Total Interest', `KES ${totalInterest.toLocaleString()}`],
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smcf-savings-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'CSV Export Complete',
        description: 'Savings report has been downloaded as CSV',
      });
    } catch (err) {
      toast({
        title: 'CSV Export Failed',
        description: 'Could not export CSV report',
        variant: 'destructive',
      });
    }
  };

  // Calculate totals with safety checks
  const totalSavings = membersWithSavings.reduce(
    (sum, m) => sum + (m.currentBalance || 0),
    0
  );
  const totalDeposits = membersWithSavings.reduce(
    (sum, m) => sum + (m.totalDeposits || 0),
    0
  );
  const totalInterest = membersWithSavings.reduce(
    (sum, m) => sum + (m.totalInterestEarned || 0),
    0
  );
  const membersWithBalance = membersWithSavings.filter(
    (m) => (m.currentBalance || 0) > 0
  ).length;

  // Find the member with highest total deposits
  const topSaver = membersWithSavings.length > 0
    ? membersWithSavings.reduce((top, member) => 
        (member.totalDeposits || 0) > (top.totalDeposits || 0) ? member : top
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Savings Pool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                KES {totalSavings.toLocaleString()}
              </div>
              <PiggyBank className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Savers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{membersWithBalance}</div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                KES {totalDeposits.toLocaleString()}
              </div>
              <ArrowDownLeft className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Interest Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                KES {totalInterest.toLocaleString()}
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Savings Analytics Chart */}
      {membersWithSavings.length > 0 && (
        <SavingsChart data={membersWithSavings} />
      )}

      {/* Interest Application */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monthly Interest</CardTitle>
              <CardDescription>
                Apply 3% monthly interest to all member savings
              </CardDescription>
            </div>
            <Button
              onClick={handleApplyInterest}
              disabled={isReadOnly || isApplyingInterest || membersWithBalance === 0}
              className="bg-blue-600 hover:bg-blue-700"
              title={isReadOnly ? "Read-only access" : undefined}>
              {isApplyingInterest ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              Apply Interest
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Savings Management</CardTitle>
              <CardDescription>View member savings and generate reports</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={exportSavingsCSV}
                variant="outline"
                size="sm"
                disabled={membersWithSavings.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={generateSavingsPDF}
                variant="default"
                size="sm"
                disabled={membersWithSavings.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="members" className="w-full">
            <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-2 min-w-max">
              <TabsTrigger value="members">
                Member Savings ({membersWithSavings.length})
              </TabsTrigger>
              <TabsTrigger value="withdrawals">
                Pending Withdrawals ({pendingWithdrawals.length})
              </TabsTrigger>
            </TabsList>
            </div>

            {/* Member Savings Tab */}
            <TabsContent value="members" className="space-y-4">
              {membersWithSavings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <PiggyBank className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No savings data yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Details</TableHead>
                      <TableHead>Rank</TableHead>
                      <TableHead>Current Balance</TableHead>
                      <TableHead>Locked Savings</TableHead>
                      <TableHead>Available Balance</TableHead>
                      <TableHead>Total Deposits</TableHead>
                      <TableHead>Total Withdrawals</TableHead>
                      <TableHead>Interest Earned</TableHead>
                      <TableHead>Transaction Fees</TableHead>
                      <TableHead>Net Savings</TableHead>
                      <TableHead>Last Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membersWithSavings.map((member) => (
                      <TableRow key={member._id}>
                        <TableCell>
                          <div className="min-w-[150px]">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{member.name}</span>
                              {topSaver && member._id === topSaver._id && (
                                <TopSaverBadge 
                                  isTopSaver={true} 
                                  currentBalance={member.totalDeposits}
                                />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {member.member_id}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Phone: {member.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">#{member.position}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          KES {(member.currentBalance || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-orange-600">
                          <div className="min-w-[120px]">
                            <div className="flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3" />
                              KES {(member.totalLockedSavings || 0).toLocaleString()}
                            </div>
                            {member.lockedDepositsCount > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {member.lockedDepositsCount} deposit{member.lockedDepositsCount > 1 ? 's' : ''} locked
                              </div>
                            )}
                            {member.earliestUnlockDate && (
                              <div className="text-xs text-muted-foreground">
                                Next unlock: {new Date(member.earliestUnlockDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          KES {((member.currentBalance || 0) - (member.totalLockedSavings || 0)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-600">
                          <div className="flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" />
                            KES {(member.totalDeposits || 0).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-red-600">
                          <div className="flex items-center gap-1">
                            <ArrowDownLeft className="w-3 h-3" />
                            KES {(member.totalWithdrawals || 0).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-blue-600">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            KES {(member.totalInterestEarned || 0).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-amber-600">
                          KES {(member.totalTransactionFees || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="text-sm">
                            <div>
                              KES {((member.totalDeposits || 0) - (member.totalWithdrawals || 0)).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              (Deposits - Withdrawals)
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {member.lastTransaction
                              ? new Date(member.lastTransaction).toLocaleDateString()
                              : "N/A"}
                          </div>
                          {member.lastTransaction && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(member.lastTransaction).toLocaleTimeString()}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Grand Total Row */}
                    {membersWithSavings.length > 0 && (
                      <TableRow className="font-bold bg-primary/10">
                        <TableCell colSpan={2}>Grand Total</TableCell>
                        <TableCell className="text-blue-700">
                          KES {membersWithSavings.reduce((sum, m) => sum + (m.currentBalance || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-orange-700">
                          KES {membersWithSavings.reduce((sum, m) => sum + (m.totalLockedSavings || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-700">
                          KES {membersWithSavings.reduce((sum, m) => sum + ((m.currentBalance || 0) - (m.totalLockedSavings || 0)), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-700">
                          KES {membersWithSavings.reduce((sum, m) => sum + (m.totalDeposits || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-red-700">
                          KES {membersWithSavings.reduce((sum, m) => sum + (m.totalWithdrawals || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-blue-700">
                          KES {membersWithSavings.reduce((sum, m) => sum + (m.totalInterestEarned || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-amber-700">
                          KES {membersWithSavings.reduce((sum, m) => sum + (m.totalTransactionFees || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-bold">
                          KES {membersWithSavings.reduce((sum, m) => sum + ((m.totalDeposits || 0) - (m.totalWithdrawals || 0)), 0).toLocaleString()}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>

            {/* Pending Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-4">
              {pendingWithdrawals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No pending withdrawal requests</p>
                </div>
              ) : (                <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Details</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Wallet Balance</TableHead>
                      <TableHead>Account Details</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Lock Status</TableHead>
                      <TableHead>Penalty Info</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead>Reason/Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal._id}>
                        <TableCell>
                          <div className="min-w-[150px]">
                            <div className="font-medium">
                              {withdrawal.member_id?.name || "Unknown"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {withdrawal.member_id?.member_id || 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Phone: {withdrawal.member_id?.phone || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-red-600">
                            KES {withdrawal.amount.toLocaleString()}
                          </div>
                          {withdrawal.penalty_amount > 0 && (
                            <div className="text-xs text-orange-600 mt-1">
                              Penalty: KES {withdrawal.penalty_amount.toLocaleString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Before: KES {withdrawal.balance_before?.toLocaleString() || 0}</div>
                            <div className="text-muted-foreground">After: KES {withdrawal.balance_after?.toLocaleString() || 0}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {withdrawal.preferred_account_name || withdrawal.preferred_account_number || withdrawal.preferred_bank ? (
                            <div className="text-sm min-w-[180px]">
                              <div className="font-medium">{withdrawal.preferred_account_name || 'N/A'}</div>
                              <div className="text-muted-foreground">
                                Acc: {withdrawal.preferred_account_number || 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Bank: {withdrawal.preferred_bank || 'N/A'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No account details</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <Badge variant="outline">
                              {withdrawal.payment_method?.toUpperCase() || 'MPESA'}
                            </Badge>
                            {withdrawal.transaction_ref && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Ref: {withdrawal.transaction_ref}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm min-w-[120px]">
                            {withdrawal.lock_period_months > 0 ? (
                              <>
                                <Badge variant={withdrawal.maturity_status === 'matured' ? 'default' : 'destructive'}>
                                  {withdrawal.maturity_status === 'matured' ? 'Matured' : 'Locked'}
                                </Badge>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {withdrawal.lock_period_months} month{withdrawal.lock_period_months > 1 ? 's' : ''} lock
                                </div>
                                {withdrawal.unlock_date && (
                                  <div className="text-xs text-muted-foreground">
                                    Unlock: {new Date(withdrawal.unlock_date).toLocaleDateString()}
                                  </div>
                                )}
                              </>
                            ) : (
                              <Badge variant="outline">No Lock</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {withdrawal.is_early_withdrawal ? (
                            <div className="text-sm min-w-[140px]">
                              <Badge variant="destructive" className="mb-1">Early Withdrawal</Badge>
                              {withdrawal.penalty_percentage > 0 && (
                                <div className="text-xs text-red-600">
                                  {withdrawal.penalty_percentage}% penalty
                                </div>
                              )}
                              {withdrawal.penalty_reason && (
                                <div className="text-xs text-muted-foreground">
                                  {withdrawal.penalty_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(withdrawal.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(withdrawal.created_at).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {withdrawal.notes ? (
                            <div className="text-sm">
                              {withdrawal.notes.length > 50 ? (
                                <span title={withdrawal.notes}>
                                  {withdrawal.notes.substring(0, 50)}...
                                </span>
                              ) : (
                                withdrawal.notes
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleWithdrawalAction(
                                  withdrawal._id,
                                  "completed"
                                )
                              }
                              disabled={isReadOnly || isProcessing}
                              title={isReadOnly ? "Read-only access" : undefined}>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                handleWithdrawalAction(withdrawal._id, "failed")
                              }
                              disabled={isReadOnly || isProcessing}
                              title={isReadOnly ? "Read-only access" : undefined}>
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSavingsTab;
