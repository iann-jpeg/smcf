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
  HandCoins,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

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
  created_at: string;
}

const LoansTab = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDisbursementDialog, setShowDisbursementDialog] = useState(false);
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
            <Button onClick={fetchLoans} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
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

            {/* Pending Loans */}
            <TabsContent value="pending" className="space-y-4">
              {pendingLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending loan requests
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
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
              )}
            </TabsContent>

            {/* Approved Loans */}
            <TabsContent value="approved" className="space-y-4">
              {approvedLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No approved loans awaiting disbursement
                </div>
              ) : (
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
              )}
            </TabsContent>

            {/* Active/Disbursed Loans */}
            <TabsContent value="active" className="space-y-4">
              {disbursedLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active loans
                </div>
              ) : (
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
              )}
            </TabsContent>

            {/* Completed Loans */}
            <TabsContent value="completed" className="space-y-4">
              {completedLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed loans
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Total Repaid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed On</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
    </div>
  );
};

export default LoansTab;
