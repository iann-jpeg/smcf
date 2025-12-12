import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LoansChart from "@/components/analytics/LoansChart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import {
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  HandCoins,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import smcfLogo from '@/assets/smcf-logo.png';
import { useEffect, useState } from "react";
import CreditScoreCard from "@/components/CreditScoreCard";

interface Loan {
  _id: string;
  member_id: {
    _id: string;
    name: string;
    phone: string;
    member_id: string;
  };
  amount: number;
  purpose: string;
  status: "pending" | "approved" | "rejected" | "disbursed" | "repaid";
  interest_rate: number;
  total_repayable: number;
  approved_by?: {
    name: string;
    role: string;
  };
  approval_date?: string;
  disbursement_date?: string;
  repayment_date?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
}

const LoansTab = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDisbursementDialog, setShowDisbursementDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showCreditScoreDialog, setShowCreditScoreDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchLoans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/loans`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });
      const data = await res.json();
      setLoans(data);
    } catch (e) {
      console.error("Fetch loans error", e);
    }
  };

  useEffect(() => {
    fetchLoans();
    const interval = setInterval(fetchLoans, 20000);
    return () => clearInterval(interval);
  }, []);

  const updateLoanStatus = async (
    loanId: string,
    status: string,
    additionalData?: any
  ) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          status,
          ...additionalData,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast({
          title: "Success",
          description: `Loan ${status} successfully`,
        });
        fetchLoans();
        return true;
      } else {
        throw new Error(result.error || "Failed to update loan");
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Could not update loan status",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (loan: Loan) => {
    const success = await updateLoanStatus(loan._id, "approved");
    if (success) {
      setSelectedLoan(null);
    }
  };

  const handleReject = async () => {
    if (!selectedLoan) return;

    const success = await updateLoanStatus(selectedLoan._id, "rejected", {
      rejection_reason: rejectionReason,
    });

    if (success) {
      setShowRejectDialog(false);
      setSelectedLoan(null);
      setRejectionReason("");
    }
  };

  const handleDisburse = async () => {
    if (!selectedLoan) return;

    const success = await updateLoanStatus(selectedLoan._id, "disbursed");

    if (success) {
      setShowDisbursementDialog(false);
      setSelectedLoan(null);
      toast({
        title: "Loan Disbursed",
        description: `KES ${selectedLoan.amount.toLocaleString()} has been marked as disbursed to ${
          selectedLoan.member_id?.name || "member"
        }`,
      });
    }
  };

  const handleMarkRepaid = async (loan: Loan) => {
    const success = await updateLoanStatus(loan._id, "repaid");
    if (success) {
      toast({
        title: "Loan Repaid",
        description: `Loan marked as fully repaid`,
      });
    }
  };

  const handleClearAllLoans = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/loans`, {
        method: "DELETE",
        headers: {
          ...authService.getAuthHeaders(),
        },
      });

      const result = await res.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "All loans have been cleared",
        });
        fetchLoans();
        setShowClearDialog(false);
      } else {
        throw new Error(result.error || "Failed to clear loans");
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Could not clear loans",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateLoansPDF = () => {
    const totalLoaned = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const totalRepayable = loans.reduce((sum, loan) => sum + loan.total_repayable, 0);
    const pendingLoans = loans.filter(l => l.status === 'pending').length;
    const approvedLoans = loans.filter(l => l.status === 'approved').length;
    const disbursedLoans = loans.filter(l => l.status === 'disbursed').length;
    const repaidLoans = loans.filter(l => l.status === 'repaid').length;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Loans Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
    .logo { max-width: 120px; height: auto; margin: 0 auto 15px; display: block; }
    .header h1 { color: #2563eb; margin: 0; font-size: 28px; }
    .header p { color: #666; margin: 5px 0; }
    .section { margin: 30px 0; }
    .section h2 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    .status-pending { color: #ea580c; font-weight: bold; }
    .status-approved { color: #2563eb; font-weight: bold; }
    .status-disbursed { color: #16a34a; font-weight: bold; }
    .status-repaid { color: #059669; font-weight: bold; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${smcfLogo}" alt="SMCF Logo" class="logo" />
    <h1>SMCF - Smart Moves Cash Flow</h1>
    <p>Loans Report</p>
    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>

  <div class="section">
    <h2>Loans Summary</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Loans</div>
        <div class="stat-value">${loans.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Loaned</div>
        <div class="stat-value">KES ${totalLoaned.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Repayable</div>
        <div class="stat-value">KES ${totalRepayable.toLocaleString()}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Loan Status Breakdown</h2>
    <table>
      <tr>
        <td><strong>Pending</strong></td>
        <td style="text-align: right;">${pendingLoans}</td>
      </tr>
      <tr>
        <td><strong>Approved</strong></td>
        <td style="text-align: right;">${approvedLoans}</td>
      </tr>
      <tr>
        <td><strong>Disbursed</strong></td>
        <td style="text-align: right;">${disbursedLoans}</td>
      </tr>
      <tr>
        <td><strong>Repaid</strong></td>
        <td style="text-align: right;">${repaidLoans}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>All Loans</h2>
    <table>
      <thead>
        <tr>
          <th>Member</th>
          <th>Amount</th>
          <th>Purpose</th>
          <th>Interest Rate</th>
          <th>Total Repayable</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${loans.map(loan => `
          <tr>
            <td>${loan.member_id?.name || 'Unknown'}</td>
            <td>KES ${loan.amount.toLocaleString()}</td>
            <td>${loan.purpose}</td>
            <td>${loan.interest_rate}%</td>
            <td>KES ${loan.total_repayable.toLocaleString()}</td>
            <td class="status-${loan.status}">${loan.status.toUpperCase()}</td>
            <td>${new Date(loan.created_at).toLocaleDateString()}</td>
          </tr>
        `).join('')}
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

  const exportLoansCSV = () => {
    try {
      const csvData = [
        ['SMCF - Smart Moves Cash Flow', 'Loans Report', `Generated: ${new Date().toLocaleString()}`],
        [],
        ['Member', 'Phone', 'Amount', 'Purpose', 'Interest Rate', 'Total Repayable', 'Status', 'Date'],
        ...loans.map(loan => [
          loan.member_id?.name || 'Unknown',
          loan.member_id?.phone || '-',
          loan.amount,
          loan.purpose,
          `${loan.interest_rate}%`,
          loan.total_repayable,
          loan.status,
          new Date(loan.created_at).toLocaleDateString(),
        ]),
        [],
        ['Summary'],
        ['Total Loans', loans.length],
        ['Total Loaned', `KES ${loans.reduce((sum, loan) => sum + loan.amount, 0).toLocaleString()}`],
        ['Total Repayable', `KES ${loans.reduce((sum, loan) => sum + loan.total_repayable, 0).toLocaleString()}`],
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smcf-loans-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'CSV Export Complete',
        description: 'Loans report has been downloaded as CSV',
      });
    } catch (err) {
      toast({
        title: 'CSV Export Failed',
        description: 'Could not export CSV report',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "outline", icon: Clock, className: "text-amber-600" },
      approved: {
        variant: "default",
        icon: CheckCircle,
        className: "bg-blue-600",
      },
      rejected: {
        variant: "destructive",
        icon: XCircle,
        className: "bg-red-600",
      },
      disbursed: {
        variant: "default",
        icon: HandCoins,
        className: "bg-financial-success",
      },
      repaid: {
        variant: "outline",
        icon: CheckCircle,
        className: "text-financial-success border-financial-success",
      },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const pendingLoans = loans.filter((l) => l.status === "pending");
  const approvedLoans = loans.filter((l) => l.status === "approved");
  const disbursedLoans = loans.filter((l) => l.status === "disbursed");
  const completedLoans = loans.filter(
    (l) => l.status === "repaid" || l.status === "rejected"
  );

  const totalLoaned = loans
    .filter((l) => l.status === "disbursed" || l.status === "repaid")
    .reduce((sum, l) => sum + l.amount, 0);

  const totalRepaid = loans
    .filter((l) => l.status === "repaid")
    .reduce((sum, l) => sum + l.total_repayable, 0);

  const activeLoans = loans.filter((l) => l.status === "disbursed").length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{pendingLoans.length}</div>
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{activeLoans}</div>
              <HandCoins className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Loaned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {totalLoaned.toLocaleString()}
              </div>
              <DollarSign className="w-8 h-8 text-financial-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Repaid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {totalRepaid.toLocaleString()}
              </div>
              <CheckCircle className="w-8 h-8 text-financial-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loans Analytics Chart */}
      {loans.length > 0 && (
        <LoansChart loans={loans} />
      )}

      {/* Loans Management Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loan Management</CardTitle>
              <CardDescription>
                Review and manage member loan requests
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchLoans} variant="outline" size="sm">
                Refresh
              </Button>
              <Button
                onClick={exportLoansCSV}
                variant="outline"
                size="sm"
                disabled={loans.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={generateLoansPDF}
                variant="default"
                size="sm"
                disabled={loans.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button
                onClick={() => setShowClearDialog(true)}
                variant="destructive"
                size="sm"
                disabled={loans.length === 0}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Loans
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-4 min-w-max">
              <TabsTrigger value="pending">
                Pending ({pendingLoans.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approvedLoans.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({disbursedLoans.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedLoans.length})
              </TabsTrigger>
            </TabsList>
            </div>

            {/* Pending Loans */}
            <TabsContent value="pending" className="space-y-4">
              {pendingLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending loan requests
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Credit Score</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Total Repayable</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLoans.map((loan) => (
                      <TableRow key={loan._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {loan.member_id?.name || "Unknown Member"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {loan.member_id?.phone || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowCreditScoreDialog(true);
                            }}>
                            View Score
                          </Button>
                        </TableCell>
                        <TableCell className="font-semibold">
                          KES {loan.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {loan.purpose}
                        </TableCell>
                        <TableCell>{loan.interest_rate}%</TableCell>
                        <TableCell className="font-semibold">
                          KES {loan.total_repayable.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(loan.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(loan)}
                              disabled={isProcessing}>
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Approve"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setShowRejectDialog(true);
                              }}
                              disabled={isProcessing}>
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

            {/* Approved Loans */}
            <TabsContent value="approved" className="space-y-4">
              {approvedLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No approved loans awaiting disbursement
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Approved On</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedLoans.map((loan) => (
                      <TableRow key={loan._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {loan.member_id?.name || "Unknown Member"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {loan.member_id?.phone || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          KES {loan.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {loan.purpose}
                        </TableCell>
                        <TableCell>
                          {loan.approved_by?.name || "Admin"}
                        </TableCell>
                        <TableCell>
                          {loan.approval_date
                            ? new Date(loan.approval_date).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowDisbursementDialog(true);
                            }}
                            disabled={isProcessing}>
                            Disburse Funds
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>

            {/* Active/Disbursed Loans */}
            <TabsContent value="active" className="space-y-4">
              {disbursedLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active loans
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Total Repayable</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Disbursed On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursedLoans.map((loan) => (
                      <TableRow key={loan._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {loan.member_id?.name || "Unknown Member"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {loan.member_id?.phone || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          KES {loan.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold text-amber-600">
                          KES {loan.total_repayable.toLocaleString()}
                        </TableCell>
                        <TableCell>{loan.interest_rate}%</TableCell>
                        <TableCell>
                          {loan.disbursement_date
                            ? new Date(
                                loan.disbursement_date
                              ).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>{getStatusBadge(loan.status)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkRepaid(loan)}
                            disabled={isProcessing}>
                            Mark as Repaid
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>

            {/* Completed Loans */}
            <TabsContent value="completed" className="space-y-4">
              {completedLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed loans
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Total Repaid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed On</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedLoans.map((loan) => (
                      <TableRow key={loan._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {loan.member_id?.name || "Unknown Member"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {loan.member_id?.phone || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          KES {loan.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {loan.status === "repaid"
                            ? `KES ${loan.total_repayable.toLocaleString()}`
                            : "N/A"}
                        </TableCell>
                        <TableCell>{getStatusBadge(loan.status)}</TableCell>
                        <TableCell>
                          {loan.repayment_date
                            ? new Date(loan.repayment_date).toLocaleDateString()
                            : loan.approval_date
                            ? new Date(loan.approval_date).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {loan.status === "rejected" && loan.rejection_reason ? (
                            <div className="max-w-xs">
                              <div className="text-xs font-medium text-destructive mb-1">Rejection Reason:</div>
                              <div className="text-xs text-muted-foreground">{loan.rejection_reason}</div>
                            </div>
                          ) : loan.notes ? (
                            <div className="max-w-xs">
                              <div className="text-xs font-medium mb-1">Notes:</div>
                              <div className="text-xs text-muted-foreground">{loan.notes}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
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

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Loan Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this loan request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing || !rejectionReason.trim()}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Reject Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Loans Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Loans</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all loans? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <p className="text-red-800 text-sm">
              ⚠️ <strong>Warning:</strong> This will permanently delete all loan records including:
            </p>
            <ul className="list-disc list-inside text-red-700 text-sm mt-2 space-y-1">
              <li>Pending loan requests ({pendingLoans.length})</li>
              <li>Approved loans ({approvedLoans.length})</li>
              <li>Active/disbursed loans ({disbursedLoans.length})</li>
              <li>Completed loans ({completedLoans.length})</li>
            </ul>
            <p className="text-red-800 text-sm mt-3 font-semibold">
              Total: {loans.length} loan records will be deleted
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllLoans}
              disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Clear All Loans
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement Confirmation Dialog */}
      <Dialog
        open={showDisbursementDialog}
        onOpenChange={setShowDisbursementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disburse Loan</DialogTitle>
            <DialogDescription>
              Confirm loan disbursement to member
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Member:</span>
                      <span className="font-medium">
                        {selectedLoan.member_id?.name || "Unknown Member"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{selectedLoan.member_id?.phone || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-semibold text-lg">
                        KES {selectedLoan.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interest:</span>
                      <span>{selectedLoan.interest_rate}%</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">
                        Total Repayable:
                      </span>
                      <span className="font-semibold text-lg text-amber-600">
                        KES {selectedLoan.total_repayable.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
                <p className="text-amber-800">
                  ⚠️ Please ensure funds have been sent to the member before
                  marking as disbursed.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisbursementDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDisburse} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm Disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Score Dialog */}
      <Dialog open={showCreditScoreDialog} onOpenChange={setShowCreditScoreDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Member Credit Score</DialogTitle>
            <DialogDescription>
              Review member's creditworthiness before approving loan
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{selectedLoan.member_id?.name || "Unknown Member"}</div>
                    <div className="text-sm text-muted-foreground">{selectedLoan.member_id?.phone || "N/A"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Requesting</div>
                    <div className="text-lg font-bold">KES {selectedLoan.amount.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <CreditScoreCard memberId={selectedLoan.member_id?._id} showTitle={false} />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreditScoreDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoansTab;
