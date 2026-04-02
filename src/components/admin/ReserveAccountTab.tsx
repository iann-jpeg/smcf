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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import jsPDF from "jspdf";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Loader2,
  Lock,
  Save,
  Shield,
  TrendingDown,
  TrendingUp,
  Unlock,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

const ReserveAccountTab = () => {
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const { toast } = useToast();

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Config form state
  const [config, setConfig] = useState<any>(null);

  // Lock form state
  const [lockReason, setLockReason] = useState("");

  useEffect(() => {
    fetchReserveData();
  }, []);

  const fetchReserveData = async () => {
    setIsLoading(true);
    try {
      const [summaryRes, transactionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/reserve/admin/summary`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/reserve/admin/transactions?limit=50`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ]);

      const summaryData = await summaryRes.json();
      const transactionsData = await transactionsRes.json();

      if (summaryData.success) {
        setSummary(summaryData.data);
        setConfig(summaryData.data.account.config);
      }

      if (transactionsData.success) {
        setTransactions(transactionsData.data);
      }
    } catch (error: any) {
      toast({
        title: "Error Loading Reserve Data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive",
      });
      return;
    }

    if (!withdrawReason) {
      toast({
        title: "Reason Required",
        description: "Please select a withdrawal reason",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/reserve/admin/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          amount,
          withdrawal_reason: withdrawReason,
          withdrawal_notes: withdrawNotes,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Withdrawal Successful",
          description: `KES ${amount.toLocaleString()} withdrawn from reserve account`,
        });
        setShowWithdrawDialog(false);
        setWithdrawAmount("");
        setWithdrawReason("");
        setWithdrawNotes("");
        fetchReserveData();
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

  const handleSaveConfig = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/reserve/admin/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Configuration Saved",
          description: "Reserve account configuration updated successfully",
        });
        setShowConfigDialog(false);
        fetchReserveData();
      } else {
        throw new Error(data.error || "Configuration update failed");
      }
    } catch (error: any) {
      toast({
        title: "Configuration Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleLock = async () => {
    if (!summary?.account?.config?.is_locked && !lockReason) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for locking the reserve account",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/reserve/admin/toggle-lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          is_locked: !summary.account.config.is_locked,
          reason: lockReason,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: summary.account.config.is_locked ? "Reserve Unlocked" : "Reserve Locked",
          description: data.message,
        });
        setShowLockDialog(false);
        setLockReason("");
        fetchReserveData();
      } else {
        throw new Error(data.error || "Lock toggle failed");
      }
    } catch (error: any) {
      toast({
        title: "Operation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadMonthlyReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reserve/admin/report/current`, {
        headers: { ...authService.getAuthHeaders() },
      });

      const data = await res.json();

      if (data.success) {
        const report = data.data;
        
        // Create PDF
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        let yPos = 20;

        // Title
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("Group Reserve Account - Monthly Report", pageWidth / 2, yPos, { align: "center" });
        
        yPos += 15;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Period: ${report.period?.month_name || "Current"} ${report.period?.year || new Date().getFullYear()}`, pageWidth / 2, yPos, { align: "center" });
        
        yPos += 15;
        pdf.text(`Generated: ${new Date().toLocaleDateString("en-US", { dateStyle: "full" })}`, pageWidth / 2, yPos, { align: "center" });

        // Summary Section
        yPos += 20;
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Financial Summary", 20, yPos);
        
        yPos += 10;
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Opening Balance: KES ${(report.opening_balance || 0).toLocaleString()}`, 20, yPos);
        
        yPos += 7;
        pdf.text(`Closing Balance: KES ${(report.closing_balance || 0).toLocaleString()}`, 20, yPos);
        
        yPos += 7;
        pdf.setTextColor(0, 128, 0);
        pdf.text(`Total Credits: KES ${(report.total_credits || 0).toLocaleString()}`, 20, yPos);
        
        yPos += 7;
        pdf.setTextColor(255, 0, 0);
        pdf.text(`Total Debits: KES ${(report.total_debits || 0).toLocaleString()}`, 20, yPos);
        
        yPos += 7;
        pdf.setTextColor(0, 0, 0);
        const netChange = (report.closing_balance || 0) - (report.opening_balance || 0);
        pdf.text(`Net Change: KES ${netChange.toLocaleString()}`, 20, yPos);

        // Credits Breakdown
        if (report.credits_by_source && Object.keys(report.credits_by_source).length > 0) {
          yPos += 15;
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.text("Credits by Source", 20, yPos);
          
          yPos += 10;
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          
          Object.entries(report.credits_by_source).forEach(([source, amount]: [string, any]) => {
            const formattedSource = source.split("_").map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(" ");
            
            pdf.text(`• ${formattedSource}: KES ${Number(amount).toLocaleString()}`, 25, yPos);
            yPos += 6;
            
            // Add new page if needed
            if (yPos > 270) {
              pdf.addPage();
              yPos = 20;
            }
          });
        }

        // Transaction Statistics
        yPos += 10;
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Transaction Statistics", 20, yPos);
        
        yPos += 10;
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Total Transactions: ${report.transaction_count || 0}`, 20, yPos);
        
        yPos += 7;
        pdf.text(`Credit Transactions: ${report.credit_count || 0}`, 20, yPos);
        
        yPos += 7;
        pdf.text(`Debit Transactions: ${report.debit_count || 0}`, 20, yPos);

        // Health Metrics
        if (report.health_score_start !== undefined || report.health_score_end !== undefined) {
          yPos += 15;
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.text("Health Metrics", 20, yPos);
          
          yPos += 10;
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "normal");
          pdf.text(`Health Score (Start): ${(report.health_score_start || 0).toFixed(1)}/100`, 20, yPos);
          
          yPos += 7;
          pdf.text(`Health Score (End): ${(report.health_score_end || 0).toFixed(1)}/100`, 20, yPos);
          
          const healthChange = (report.health_score_end || 0) - (report.health_score_start || 0);
          yPos += 7;
          pdf.text(`Health Change: ${healthChange >= 0 ? '+' : ''}${healthChange.toFixed(1)} points`, 20, yPos);
        }

        // Footer
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text("SMART MONEY CASH FLOW - Reserve Account Management System", pageWidth / 2, 285, { align: "center" });

        // Download PDF
        pdf.save(`reserve-report-${new Date().toISOString().split("T")[0]}.pdf`);

        toast({
          title: "Report Downloaded",
          description: "Monthly reserve report downloaded as PDF",
        });
      } else {
        throw new Error(data.error || "Report generation failed");
      }
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const account = summary?.account;
  const health = summary?.health;
  const isLocked = account?.config?.is_locked;

  return (
    <div className="space-y-6">
      {/* Header with Balance and Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              KES {(account?.current_balance || 0).toLocaleString()}
            </div>
            {isLocked && (
              <Badge variant="destructive" className="mt-2">
                <Lock className="w-3 h-3 mr-1" />
                Locked
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              Reserve Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-600">
                  {health?.health_score || 0}/100
                </span>
                {(health?.monthly_growth_rate || 0) >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <Progress value={health?.health_score || 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Loan Coverage Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(health?.loan_coverage_ratio || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Reserve / Outstanding Loans
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={() => setShowWithdrawDialog(true)} disabled={isLocked}>
          <ArrowDownCircle className="w-4 h-4 mr-2" />
          Withdraw Funds
        </Button>
        <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
          <Shield className="w-4 h-4 mr-2" />
          Configure Sources
        </Button>
        <Button variant="outline" onClick={() => setShowLockDialog(true)}>
          {isLocked ? (
            <>
              <Unlock className="w-4 h-4 mr-2" />
              Unlock Reserve
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Lock Reserve
            </>
          )}
        </Button>
        <Button variant="outline" onClick={downloadMonthlyReport}>
          <Download className="w-4 h-4 mr-2" />
          Monthly Report
        </Button>
      </div>

      {/* Lock Warning */}
      {isLocked && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">Reserve Account Locked</p>
                <p className="text-sm">
                  Reason: {account.config.locked_reason}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  No withdrawals or automatic credits allowed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="sources">Sources Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Early Withdrawal Penalties</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-red-600">
                  KES {(account?.total_from_early_withdrawal_penalties || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Loan Defaults</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-orange-600">
                  KES {(account?.total_from_loan_defaults || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Loan Interest (97%)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-blue-600">
                  KES {(account?.total_from_loan_interest || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Withdrawal Fees</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-purple-600">
                  KES {(account?.total_from_withdrawal_fees || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">System Fees</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-indigo-600">
                  KES {(account?.total_from_system_fees || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Cycle Contributions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-green-600">
                  KES {(account?.total_from_cycle_contributions || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Withdrawn</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                KES {(account?.total_withdrawn || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 50 reserve transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn) => (
                      <TableRow key={txn._id}>
                        <TableCell className="text-xs">
                          {new Date(txn.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {txn.transaction_type === "credit" ? (
                            <Badge variant="default" className="bg-green-600">
                              <ArrowUpCircle className="w-3 h-3 mr-1" />
                              Credit
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <ArrowDownCircle className="w-3 h-3 mr-1" />
                              Debit
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {txn.source_type.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          KES {txn.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          KES {txn.balance_after.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate">
                          {txn.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Sources Configuration</CardTitle>
              <CardDescription>
                Enable/disable automatic funding sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Early Withdrawal Penalties</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically credit penalties from early withdrawals
                      </p>
                    </div>
                    <Switch
                      checked={config.early_withdrawal_penalties_enabled}
                      onCheckedChange={(val) =>
                        setConfig({
                          ...config,
                          early_withdrawal_penalties_enabled: val,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Loan Default Penalties</Label>
                      <p className="text-sm text-muted-foreground">
                        Credit default penalties to reserve
                      </p>
                    </div>
                    <Switch
                      checked={config.loan_default_penalties_enabled}
                      onCheckedChange={(val) =>
                        setConfig({
                          ...config,
                          loan_default_penalties_enabled: val,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Withdrawal Fees</Label>
                      <p className="text-sm text-muted-foreground">
                        Add withdrawal transaction fees
                      </p>
                    </div>
                    <Switch
                      checked={config.withdrawal_fees_enabled}
                      onCheckedChange={(val) =>
                        setConfig({ ...config, withdrawal_fees_enabled: val })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Cycle Member Credits</Label>
                      <p className="text-sm text-muted-foreground">
                        Credit member credit portion from cycles
                      </p>
                    </div>
                    <Switch
                      checked={config.cycle_contributions_enabled}
                      onCheckedChange={(val) =>
                        setConfig({
                          ...config,
                          cycle_contributions_enabled: val,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Label>Loan Interest Percentage to Reserve</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={config.loan_interest_percentage}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            loan_interest_percentage: parseInt(e.target.value),
                          })
                        }
                      />
                      <span className="text-sm">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Default: 97% (Interest - 3%)
                    </p>
                  </div>

                  <Button onClick={handleSaveConfig} disabled={isProcessing}>
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw from Reserve Account</DialogTitle>
            <DialogDescription>
              Withdraw funds from the group reserve account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="1"
                max={account?.current_balance || 0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: KES {(account?.current_balance || 0).toLocaleString()}
              </p>
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Select value={withdrawReason} onValueChange={setWithdrawReason}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select withdrawal reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan_default_coverage">
                    Loan Default Coverage
                  </SelectItem>
                  <SelectItem value="emergency_group_support">
                    Emergency Group Support
                  </SelectItem>
                  <SelectItem value="operational_costs">
                    Operational Costs
                  </SelectItem>
                  <SelectItem value="group_investment">
                    Group Investment
                  </SelectItem>
                  <SelectItem value="member_refund">Member Refund</SelectItem>
                  <SelectItem value="audit_adjustment">
                    Audit Adjustment
                  </SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes for this withdrawal..."
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
              <p className="text-amber-800">
                ⚠️ This withdrawal will be permanently logged in the audit trail
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleWithdraw} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Withdraw Funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock/Unlock Dialog */}
      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isLocked ? "Unlock" : "Lock"} Reserve Account
            </DialogTitle>
            <DialogDescription>
              {isLocked
                ? "Unlock the reserve account to allow transactions"
                : "Lock the reserve account to prevent all transactions (for audits)"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!isLocked && (
              <div>
                <Label htmlFor="lockReason">Reason for Locking</Label>
                <Textarea
                  id="lockReason"
                  placeholder="e.g., Annual audit in progress"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {isLocked && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
                <p className="text-blue-800">
                  <strong>Current lock reason:</strong>{" "}
                  {account?.config?.locked_reason}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleToggleLock} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {isLocked ? "Unlock Reserve" : "Lock Reserve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reserve Account Configuration</DialogTitle>
            <DialogDescription>
              Configure funding sources and withdrawal limits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {config && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Funding Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Early Withdrawal Penalties</Label>
                        <p className="text-xs text-muted-foreground">
                          Penalties from early withdrawals
                        </p>
                      </div>
                      <Switch
                        checked={config.early_withdrawal_penalties_enabled}
                        onCheckedChange={(val) =>
                          setConfig({
                            ...config,
                            early_withdrawal_penalties_enabled: val,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Loan Default Penalties</Label>
                        <p className="text-xs text-muted-foreground">
                          Penalties from loan defaults
                        </p>
                      </div>
                      <Switch
                        checked={config.loan_default_penalties_enabled}
                        onCheckedChange={(val) =>
                          setConfig({
                            ...config,
                            loan_default_penalties_enabled: val,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Withdrawal Fees</Label>
                        <p className="text-xs text-muted-foreground">
                          Transaction fees from withdrawals
                        </p>
                      </div>
                      <Switch
                        checked={config.withdrawal_fees_enabled}
                        onCheckedChange={(val) =>
                          setConfig({ ...config, withdrawal_fees_enabled: val })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Cycle Contributions</Label>
                        <p className="text-xs text-muted-foreground">
                          Member credit from cycle payments
                        </p>
                      </div>
                      <Switch
                        checked={config.cycle_contributions_enabled}
                        onCheckedChange={(val) =>
                          setConfig({
                            ...config,
                            cycle_contributions_enabled: val,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                      <Label>Loan Interest % to Reserve</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={config.loan_interest_percentage}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            loan_interest_percentage: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Withdrawal Limits</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Max Withdrawal Per Month (KES)</Label>
                      <Input
                        type="number"
                        value={config.max_withdrawal_per_month}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            max_withdrawal_per_month: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Withdrawal Percentage</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={config.max_withdrawal_percentage}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            max_withdrawal_percentage: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        % of balance that can be withdrawn per month
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <Label>Require Dual Approval</Label>
                        <p className="text-xs text-muted-foreground">
                          Require two admins to approve withdrawals
                        </p>
                      </div>
                      <Switch
                        checked={config.require_dual_approval}
                        onCheckedChange={(val) =>
                          setConfig({ ...config, require_dual_approval: val })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReserveAccountTab;
