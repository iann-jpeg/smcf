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
  preferred_account_name?: string;
  preferred_account_number?: string;
  preferred_bank?: string;
  payment_method?: string;
  transaction_ref?: string;
  lock_period_months?: number;
  unlock_date?: string;
  maturity_status?: string;
  is_early_withdrawal?: boolean;
  penalty_amount?: number;
  penalty_percentage?: number;
  penalty_reason?: string;
}

interface ApprovalsTabProps {
  isReadOnly?: boolean;
}

const ApprovalsTab = ({ isReadOnly = false }: ApprovalsTabProps) => {
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
    
    // Auto-refresh every 60 seconds (reduced from 15s to minimize server load)
    const interval = setInterval(fetchPendingItems, 60000);
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
              <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
              <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-2 min-w-max">
                <TabsTrigger value="loans">
                  Loans ({pendingLoans.length})
                </TabsTrigger>
                <TabsTrigger value="withdrawals">
                  Withdrawals ({pendingWithdrawals.length})
                </TabsTrigger>
              </TabsList>
              </div>

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
                            {new Date(loan.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveLoan(loan)}
                                disabled={isReadOnly || isProcessing}
                                title={isReadOnly ? "Read-only access" : undefined}>
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
                )}
              </TabsContent>

              {/* Pending Withdrawals */}
              <TabsContent value="withdrawals" className="space-y-4">
                {/* Early Withdrawal Alert */}
                {pendingWithdrawals.some((w: any) => w.lock_period_months > 0 && w.maturity_status === 'locked') && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-900 mb-2">⚠️ Early Withdrawal Requests Pending</h4>
                        <p className="text-sm text-amber-800 mb-3">
                          Some withdrawal requests involve locked deposits before maturity. Review lock period terms and penalties carefully before approval.
                        </p>
                        <div className="bg-white/60 rounded-md p-3 text-xs text-amber-900 space-y-1">
                          <p className="font-medium">Early Withdrawal Policy:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Penalties range from 5% to 20% based on time remaining</li>
                            <li>All penalties are automatically added to group reserve account</li>
                            <li>Credit scores are reduced by configured penalty points</li>
                            <li>System calculates and applies penalties automatically upon approval</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {pendingWithdrawals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No pending withdrawal requests</p>
                  </div>
                ) : (                  <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">                  <Table>
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
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingWithdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal._id}>
                          <TableCell>
                            <div className="min-w-[150px]">
                              <div className="font-medium">
                                {withdrawal.member_id?.name || 'Unknown'}
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
                            <div className="font-semibold text-amber-600">
                              KES {withdrawal.amount.toLocaleString()}
                            </div>
                            {withdrawal.penalty_amount > 0 && (
                              <div className="text-xs text-red-600">
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
                              <span className="text-xs text-muted-foreground">No account provided</span>
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
                                onClick={() => handleApproveWithdrawal(withdrawal)}
                                disabled={isReadOnly || isProcessing}
                                title={isReadOnly ? "Read-only access" : undefined}>
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
