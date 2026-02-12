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
import { generateLoanTermsPDF } from "@/lib/loanTermsPDF";
import {
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Loader2,
  Trash2,
  XCircle,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import smcfLogo from '@/assets/newsmcflogo.png';
import { useEffect, useState } from "react";
import CreditScoreCard from "@/components/CreditScoreCard";
import { Progress } from "@/components/ui/progress";

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
  amount_paid?: number;
  amount_remaining?: number;
  due_date?: string;
  late_fees_accrued?: number;
  pending_late_fee?: number;
  total_late_fees?: number;
  days_overdue?: number;
  is_overdue?: boolean;
  current_total_due?: number;
  current_remaining?: number;
  payment_history?: Array<{
    amount: number;
    payment_date: string;
    payment_method: string;
    transaction_ref: string;
    notes: string;
  }>;
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
  requires_guarantor_approval?: boolean;
  guarantor_approval_pending?: boolean;
  all_guarantors_accepted?: boolean;
  guarantors?: {
    total: number;
    accepted: number;
    pending: number;
    declined: number;
    details: Array<{
      id: string;
      guarantor_id: string;
      guarantor_name: string;
      guarantor_phone: string;
      guarantor_member_id: string;
      guarantor_savings?: number;
      status: "pending" | "accepted" | "declined";
      accepted_at?: string;
      declined_at?: string;
      decline_reason?: string;
      liability_amount: number;
    }>;
  };
}

interface LoansTabProps {
  isReadOnly?: boolean;
}

const LoansTab = ({ isReadOnly = false }: LoansTabProps) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedLoanLoading, setSelectedLoanLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showPaymentHistoryDialog, setShowPaymentHistoryDialog] = useState(false);
  const [showDisbursementDialog, setShowDisbursementDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showCreditScoreDialog, setShowCreditScoreDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  // Repayment dialog state
  const [showRepayDialog, setShowRepayDialog] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayError, setRepayError] = useState("");
  const [repayLoading, setRepayLoading] = useState(false);
    // Fetch latest loan data by ID
    const fetchLoanById = async (loanId: string) => {
      setSelectedLoanLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}`, {
          headers: { ...authService.getAuthHeaders() },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setSelectedLoan(data.data);
          return data.data;
        }
      } catch (e) {
        // fallback
      }
      setSelectedLoanLoading(false);
      return null;
    };

    // Open repay dialog and fetch latest loan data
    const handleOpenRepayDialog = async (loan: Loan) => {
      setRepayAmount("");
      setRepayError("");
      setRepayLoading(true);
      const latestLoan = await fetchLoanById(loan._id);
      setRepayLoading(false);
      if (latestLoan) {
        setSelectedLoan(latestLoan);
        setShowRepayDialog(true);
      } else {
        setSelectedLoan(loan);
        setShowRepayDialog(true);
      }
    };

    // Repay submit handler
    const handleRepaySubmit = async () => {
      if (!selectedLoan) return;
      setRepayError("");
      const maxPayable = selectedLoan.current_remaining || selectedLoan.amount_remaining || 0;
      const amountNum = Number(repayAmount);
      if (!repayAmount || isNaN(amountNum) || amountNum <= 0) {
        setRepayError("Enter a valid amount");
        return;
      }
      if (amountNum > maxPayable) {
        setRepayError(`Amount too high. Maximum payable is KES ${maxPayable.toLocaleString()}`);
        return;
      }
      setRepayLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/${selectedLoan._id}/repay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({ amount: amountNum }),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: "Repayment Successful", description: `KES ${amountNum.toLocaleString()} repaid.` });
          setShowRepayDialog(false);
          setRepayAmount("");
          setRepayError("");
          fetchLoans();
        } else {
          setRepayError(data.error || "Repayment failed");
        }
      } catch (e) {
        setRepayError("Repayment failed");
      } finally {
        setRepayLoading(false);
      }
    };
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
      console.log("Loans data with guarantors:", data);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">{pendingLoans.length}</div>
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Active Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">{activeLoans}</div>
              <HandCoins className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Total Loaned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">
                {totalLoaned.toLocaleString()}
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-financial-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Total Repaid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">
                {totalRepaid.toLocaleString()}
              </div>
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-financial-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loans Analytics Chart */}
      {loans.length > 0 && (
        <LoansChart loans={loans} />
      )}

      {/* Loan Policy Download */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Official Loan Terms & Conditions</h4>
                <p className="text-xs text-muted-foreground">
                  Download the Kenyan-compliant loan policy document for members
                </p>
              </div>
            </div>
            <Button
              onClick={generateLoanTermsPDF}
              variant="default"
              size="sm"
              className="whitespace-nowrap">
              <Download className="w-4 h-4 mr-2" />
              Download Policy PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loans Management Tabs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">Loan Management</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Review and manage member loan requests
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
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
                disabled={isReadOnly || loans.length === 0}
                title={isReadOnly ? "Read-only access" : undefined}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Loans
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <div className="overflow-x-auto -mx-1 px-1 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-4 min-w-max text-xs sm:text-sm">
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
                      <TableHead>Guarantors</TableHead>
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
                        <TableCell className="max-w-md">
                          <div className="text-sm break-words whitespace-normal">
                            {loan.purpose}
                          </div>
                        </TableCell>
                        <TableCell>{loan.interest_rate}%</TableCell>
                        <TableCell className="font-semibold">
                          KES {loan.total_repayable.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {loan.guarantors && loan.guarantors.total > 0 ? (
                            <div className="space-y-2">
                              <div className="flex gap-1 items-center flex-wrap">
                                {loan.guarantors.accepted > 0 && (
                                  <Badge variant="default" className="bg-green-600 text-white">
                                    ✓ {loan.guarantors.accepted} Accepted
                                  </Badge>
                                )}
                                {loan.guarantors.pending > 0 && (
                                  <Badge variant="secondary" className="bg-yellow-500 text-white">
                                    ⏳ {loan.guarantors.pending} Pending
                                  </Badge>
                                )}
                                {loan.guarantors.declined > 0 && (
                                  <Badge variant="destructive">
                                    ✗ {loan.guarantors.declined} Declined
                                  </Badge>
                                )}
                              </div>
                              {loan.guarantors.details && loan.guarantors.details.length > 0 && (
                                <div className="space-y-1 mt-2">
                                  {loan.guarantors.details.map((g) => (
                                    <div key={g.id} className="text-xs flex items-center gap-2">
                                      <span className="font-medium">{g.guarantor_name || 'Unknown'}</span>
                                      <Badge 
                                        variant={g.status === 'accepted' ? 'default' : g.status === 'pending' ? 'secondary' : 'destructive'}
                                        className={`text-xs py-0 ${g.status === 'accepted' ? 'bg-green-100 text-green-800' : g.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}
                                      >
                                        {g.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No guarantors</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(loan.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {loan.requires_guarantor_approval && 
                             loan.guarantors && 
                             (loan.guarantors.pending > 0 || loan.guarantors.declined > 0) && (
                              <div className="flex items-center gap-1 text-amber-600 text-xs mb-1" title="Awaiting all guarantors to accept">
                                <AlertTriangle className="w-3 h-3" />
                                <span className="hidden md:inline">Guarantors pending</span>
                              </div>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleApprove(loan)}
                              disabled={isReadOnly || isProcessing}
                              title={
                                isReadOnly 
                                  ? "Read-only access" 
                                  : loan.requires_guarantor_approval && 
                                    loan.guarantors && 
                                    (loan.guarantors.pending > 0 || loan.guarantors.declined > 0)
                                    ? "All guarantors must accept before approval"
                                    : undefined
                              }>
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
                              disabled={isReadOnly || isProcessing}
                              title={isReadOnly ? "Read-only access" : undefined}>
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
                        <TableCell className="max-w-md">
                          <div className="text-sm break-words whitespace-normal">
                            {loan.purpose}
                          </div>
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
                            disabled={isReadOnly || isProcessing}
                            title={isReadOnly ? "Read-only access" : undefined}>
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
                      <TableHead>Loan Amount</TableHead>
                      <TableHead>Payment Progress</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Late Fees</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursedLoans.map((loan) => {
                      const amountPaid = loan.amount_paid || 0;
                      const totalDue = loan.current_total_due || loan.total_repayable || loan.amount;
                      const remaining = loan.current_remaining || loan.amount_remaining || totalDue;
                      const progress = totalDue > 0 ? Math.min(100, Math.round((amountPaid / totalDue) * 100)) : 0;
                      const isOverdue = loan.is_overdue || false;
                      const daysOverdue = loan.days_overdue || 0;
                      const totalLateFees = loan.total_late_fees || 0;
                      
                      return (
                      <TableRow key={loan._id} className={isOverdue ? "bg-red-50" : ""}>
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
                          <div>
                            <div className="font-semibold">
                              KES {loan.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              + {loan.interest_rate}% interest
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[180px]">
                            <div className="flex justify-between text-xs">
                              <span>Paid: KES {amountPaid.toLocaleString()}</span>
                              <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Remaining: KES {remaining.toLocaleString()}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 px-1 text-xs"
                                onClick={async () => {
                                  setSelectedLoanLoading(true);
                                  try {
                                    const res = await fetch(`${API_BASE}/api/loans/${loan._id}`, {
                                      headers: { ...authService.getAuthHeaders() },
                                    });
                                    const data = await res.json();
                                    if (data.success && data.data) {
                                      setSelectedLoan(data.data);
                                    } else {
                                      setSelectedLoan(loan);
                                    }
                                  } catch (e) {
                                    setSelectedLoan(loan);
                                  }
                                  setSelectedLoanLoading(false);
                                  setShowPaymentHistoryDialog(true);
                                }}
                                disabled={selectedLoanLoading}
                              >
                                View History
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {loan.due_date ? (
                              <>
                                <div className={isOverdue ? "text-red-600 font-medium" : ""}>
                                  {new Date(loan.due_date).toLocaleDateString()}
                                </div>
                                {isOverdue && (
                                  <div className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {daysOverdue} days overdue
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {totalLateFees > 0 ? (
                            <div className="text-red-600 font-medium">
                              KES {totalLateFees.toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-green-600">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isOverdue ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              Overdue
                            </Badge>
                          ) : (
                            getStatusBadge(loan.status)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRepayDialog(loan)}
                              disabled={isReadOnly || isProcessing}
                              title={isReadOnly ? "Read-only access" : undefined}>
                              Repay
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkRepaid(loan)}
                              disabled={isReadOnly || isProcessing}
                              title={isReadOnly ? "Read-only access" : undefined}>
                              Mark as Repaid
                            </Button>
                          </div>
                        </TableCell>
                            {/* Repayment Dialog */}
                            <Dialog open={showRepayDialog} onOpenChange={setShowRepayDialog}>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Loan Repayment</DialogTitle>
                                  <DialogDescription>
                                    Enter repayment amount for this loan. The maximum allowed is always based on the latest backend calculation.
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedLoan && (
                                  <div className="space-y-4">
                                    <div className="bg-muted p-3 rounded-lg">
                                      <div className="flex justify-between text-sm">
                                        <span>Member:</span>
                                        <span className="font-medium">{selectedLoan.member_id?.name || "Unknown"}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span>Loan Amount:</span>
                                        <span>KES {selectedLoan.amount.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span>Current Remaining:</span>
                                        <span className="font-semibold text-amber-600">KES {(selectedLoan.current_remaining || selectedLoan.amount_remaining || 0).toLocaleString()}</span>
                                      </div>
                                      {(selectedLoan.total_late_fees || 0) > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span>Late Fees:</span>
                                          <span className="text-red-600">KES {selectedLoan.total_late_fees?.toLocaleString()}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <Label htmlFor="repay-amount">Amount to Repay</Label>
                                      <input
                                        id="repay-amount"
                                        type="number"
                                        min="1"
                                        max={selectedLoan.current_remaining || selectedLoan.amount_remaining || 0}
                                        className="input input-bordered w-full mt-1"
                                        value={repayAmount}
                                        onChange={e => setRepayAmount(e.target.value)}
                                        disabled={repayLoading}
                                        placeholder={`Max: KES ${(selectedLoan.current_remaining || selectedLoan.amount_remaining || 0).toLocaleString()}`}
                                      />
                                      {repayError && <div className="text-red-600 text-xs mt-1">{repayError}</div>}
                                    </div>
                                  </div>
                                )}
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setShowRepayDialog(false)} disabled={repayLoading}>Cancel</Button>
                                  <Button onClick={handleRepaySubmit} disabled={repayLoading || !repayAmount}>
                                    {repayLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Submit Repayment
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                      </TableRow>
                      );
                    })}
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
                    {completedLoans.map((loan) => {
                      const hasUnpaidLateFees = loan.status === "repaid" && (loan.total_late_fees || 0) > 0;
                      return (
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
                            {hasUnpaidLateFees && (
                              <div className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Unpaid Late Fees: KES {loan.total_late_fees?.toLocaleString()}
                              </div>
                            )}
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
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="mt-2"
                                  onClick={async () => {
                                    if (window.confirm("Are you sure you want to permanently delete this rejected loan?")) {
                                      try {
                                        const res = await fetch(`${API_BASE}/api/loans/${loan._id}`, {
                                          method: "DELETE",
                                          headers: { ...authService.getAuthHeaders() },
                                        });
                                        const result = await res.json();
                                        if (result.success) {
                                          toast({ title: "Loan Deleted", description: "Rejected loan deleted successfully" });
                                          fetchLoans();
                                        } else {
                                          toast({ title: "Delete Failed", description: result.error || "Could not delete loan", variant: "destructive" });
                                        }
                                      } catch (err) {
                                        toast({ title: "Delete Failed", description: "Could not delete loan", variant: "destructive" });
                                      }
                                    }
                                  }}
                                >
                                  Delete Loan
                                </Button>
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
                      );
                    })}
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

      {/* Payment History Dialog */}
      <Dialog open={showPaymentHistoryDialog} onOpenChange={setShowPaymentHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              Detailed payment history for this loan
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              {/* Loan Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Member:</span>
                      <div className="font-medium">{selectedLoan.member_id?.name || "Unknown"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Loan Amount:</span>
                      <div className="font-medium">KES {selectedLoan.amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Due (with interest):</span>
                      <div className="font-medium">KES {selectedLoan.total_repayable.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <div className="font-medium text-green-600">
                        KES {(selectedLoan.amount_paid || 0).toLocaleString()}
                      </div>
                    </div>
                    {(selectedLoan.total_late_fees || 0) > 0 && (
                      <div>
                        <span className="text-muted-foreground">Late Fees:</span>
                        <div className="font-medium text-red-600">
                          KES {selectedLoan.total_late_fees?.toLocaleString()}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Remaining Balance:</span>
                      <div className="font-medium text-amber-600">
                        KES {(selectedLoan.current_remaining || selectedLoan.amount_remaining || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Payment Progress</span>
                      <span className="font-medium">
                        {selectedLoan.total_repayable > 0 
                          ? Math.round(((selectedLoan.amount_paid || 0) / selectedLoan.total_repayable) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={selectedLoan.total_repayable > 0 
                        ? Math.min(100, ((selectedLoan.amount_paid || 0) / selectedLoan.total_repayable) * 100)
                        : 0} 
                      className="h-3"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment History List */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Payment Transactions
                </h4>
                {selectedLoan.payment_history && selectedLoan.payment_history.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLoan.payment_history.map((payment, index) => (
                      <Card key={index} className="border">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-green-600">
                                + KES {payment.amount.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(payment.payment_date).toLocaleString()}
                              </div>
                              {payment.payment_method && (
                                <div className="text-xs text-muted-foreground">
                                  Method: {payment.payment_method.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {payment.transaction_ref && (
                                <div className="text-xs font-mono text-muted-foreground">
                                  {payment.transaction_ref}
                                </div>
                              )}
                              {payment.notes && (
                                <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                                  {payment.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground bg-muted rounded-lg">
                    No payments recorded yet
                  </div>
                )}
              </div>

              {/* Overdue Warning */}
              {selectedLoan.is_overdue && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Loan is {selectedLoan.days_overdue} days overdue
                  </div>
                  <div className="text-sm text-red-600 mt-1">
                    Late fees are being applied at 3% per day on the remaining balance.
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoansTab;
