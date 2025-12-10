import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import API_BASE from '@/lib/api';
import { authService } from '@/lib/authService';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Wallet,
  AlertCircle,
  Loader2 
} from 'lucide-react';

interface PendingLoan {
  _id: string;
  member_id: {
    _id: string;
    name: string;
    phone: string;
    member_id: string;
  };
  amount: number;
  purpose: string;
  status: string;
  interest_rate: number;
  total_repayable: number;
  created_at: string;
}

interface PendingWithdrawal {
  _id: string;
  member_id: {
    _id: string;
    name: string;
    phone: string;
    member_id: string;
  };
  amount: number;
  transaction_type: string;
  status: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
  notes?: string;
}

const ApprovalsTab = () => {
  const [pendingLoans, setPendingLoans] = useState<PendingLoan[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [itemType, setItemType] = useState<'loan' | 'withdrawal'>('loan');
  const { toast } = useToast();

  const fetchPendingItems = async () => {
    try {
      const [loansRes, withdrawalsRes] = await Promise.all([
        fetch(`${API_BASE}/api/loans`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/savings/admin/pending-withdrawals`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ]);

      if (loansRes.ok) {
        const loansData = await loansRes.json();
        const pending = Array.isArray(loansData) 
          ? loansData.filter((l: any) => l.status === 'pending')
          : [];
        setPendingLoans(pending);
      }

      if (withdrawalsRes.ok) {
        const withdrawalsData = await withdrawalsRes.json();
        setPendingWithdrawals(withdrawalsData.success ? withdrawalsData.data : []);
      }
    } catch (error) {
      console.error('Error fetching pending items:', error);
    }
  };

  useEffect(() => {
    fetchPendingItems();
    
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchPendingItems, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleApproveLoan = async (loan: PendingLoan) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/api/loans/${loan._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          status: 'approved',
          approval_date: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to approve loan');

      toast({
        title: 'Loan Approved',
        description: `Loan of KES ${loan.amount.toLocaleString()} for ${loan.member_id.name} has been approved`,
      });

      fetchPendingItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve loan',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectLoan = async () => {
    if (!selectedItem || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/api/loans/${selectedItem._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approval_date: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to reject loan');

      toast({
        title: 'Loan Rejected',
        description: `Loan request for ${selectedItem.member_id.name} has been rejected`,
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedItem(null);
      fetchPendingItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject loan',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawal: PendingWithdrawal) => {
    setIsProcessing(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/savings/admin/approve-withdrawal/${withdrawal._id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
        }
      );

      if (!response.ok) throw new Error('Failed to approve withdrawal');

      toast({
        title: 'Withdrawal Approved',
        description: `Withdrawal of KES ${withdrawal.amount.toLocaleString()} for ${withdrawal.member_id.name} has been approved`,
      });

      fetchPendingItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve withdrawal',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectWithdrawal = async () => {
    if (!selectedItem || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/savings/admin/reject-withdrawal/${selectedItem._id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            rejection_reason: rejectionReason,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to reject withdrawal');

      toast({
        title: 'Withdrawal Rejected',
        description: `Withdrawal request for ${selectedItem.member_id.name} has been rejected`,
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedItem(null);
      fetchPendingItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject withdrawal',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPending = pendingLoans.length + pendingWithdrawals.length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{totalPending}</div>
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Items requiring approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{pendingLoans.length}</div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Loan requests awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{pendingWithdrawals.length}</div>
              <Wallet className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Withdrawal requests awaiting approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Approvals
              </CardTitle>
              <CardDescription>
                Review and approve or reject pending requests
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPendingItems}
              disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {totalPending === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
              <p>No pending items require your approval at this time.</p>
            </div>
          ) : (
            <Tabs defaultValue="loans" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="loans">
                  Loans ({pendingLoans.length})
                </TabsTrigger>
                <TabsTrigger value="withdrawals">
                  Withdrawals ({pendingWithdrawals.length})
                </TabsTrigger>
              </TabsList>

              {/* Pending Loans */}
              <TabsContent value="loans" className="space-y-4">
                {pendingLoans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No pending loan requests</p>
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
                                {loan.member_id?.name || 'Unknown Member'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {loan.member_id?.phone || 'N/A'}
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
                                onClick={() => handleApproveLoan(loan)}
                                disabled={isProcessing}>
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Approve'
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedItem(loan);
                                  setItemType('loan');
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

              {/* Pending Withdrawals */}
              <TabsContent value="withdrawals" className="space-y-4">
                {pendingWithdrawals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No pending withdrawal requests</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance Before</TableHead>
                        <TableHead>Balance After</TableHead>
                        <TableHead>Requested On</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingWithdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal._id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {withdrawal.member_id?.name || 'Unknown'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {withdrawal.member_id?.member_id || 'N/A'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-amber-600">
                            KES {withdrawal.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            KES {withdrawal.balance_before?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell>
                            KES {withdrawal.balance_after?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell>
                            {new Date(withdrawal.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {withdrawal.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveWithdrawal(withdrawal)}
                                disabled={isProcessing}>
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Approve'
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedItem(withdrawal);
                                  setItemType('withdrawal');
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
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {itemType === 'loan' ? 'Loan' : 'Withdrawal'} Request
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this {itemType} request.
              This will be communicated to the member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedItem && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">
                  {selectedItem.member_id?.name || 'Unknown Member'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Amount: KES {selectedItem.amount.toLocaleString()}
                </p>
              </div>
            )}
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
                setSelectedItem(null);
              }}
              disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={itemType === 'loan' ? handleRejectLoan : handleRejectWithdrawal}
              disabled={isProcessing || !rejectionReason.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalsTab;
