import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  DollarSign, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Send,
  UserPlus,
  Download,
  Wallet,
  Edit,
  Trash2,
  Save,
  Megaphone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MpesaDisbursementDialog from '@/components/MpesaDisbursementDialog';
import AddMemberDialog from '@/components/AddMemberDialog';
import AnnouncementDialog from '@/components/AnnouncementDialog';
import LoansTab from './admin/LoansTab';
import ApprovalsTab from './admin/ApprovalsTab';
import ReportsTab from './admin/ReportsTab';
// ...existing code...

interface AdminDashboardProps {
  userData: any;
  members: any[];
  announcements: any[];
  onLogout: () => void;
  cycleData?: any;
}

const AdminDashboard = ({ userData, members, announcements, onLogout }: AdminDashboardProps) => {
  console.log('AdminDashboard rendered with:', { userData, members: members?.length || 0, announcements: announcements?.length || 0 });
  
  // Safety check for required data
  if (!userData || !userData.cycleData) {
    console.log('Missing userData or cycleData, rendering fallback');
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Admin Dashboard...</h2>
          <p className="text-muted-foreground">Please wait while we load your data.</p>
        </div>
      </div>
    );
  }
  
  const { toast } = useToast();
  const [showDisbursementDialog, setShowDisbursementDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editedMemberData, setEditedMemberData] = useState<any>({});
  // Safe fallbacks to avoid runtime errors when data is undefined
  const safeMembers = Array.isArray(members) ? members : [];
  const paidMembers = safeMembers.filter((m: any) => m && m.status === 'paid');
  const pendingMembers = safeMembers.filter((m: any) => m && m.status === 'pending');
  const safeDisbursements = Array.isArray(userData.disbursements) ? userData.disbursements : [];
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  // Polling for recent payments
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  import API_BASE from '@/lib/api';

  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/payments`);
      const data = await res.json();
      setRecentPayments(Array.isArray(data) ? data.slice(0,5) : []);
    } catch (e) {
      console.error('Could not fetch payments', e);
      setRecentPayments([]);
    }
  };

  useEffect(() => {
    // initial fetch
    fetchPayments();
    // poll every 15 seconds
    pollRef.current = setInterval(fetchPayments, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSendReminders = () => {
    const pendingMembers = safeMembers.filter(m => m.status === 'pending');
    toast({
      title: "Reminders Sent",
      description: `Payment reminders sent to ${pendingMembers.length} members`,
    });
  };

  const handleProcessPayout = () => {
    if (userData.cycleData.paidMembers < userData.cycleData.totalMembers) {
      toast({
        title: "Cannot Process Payout",
        description: "All members must pay before disbursement",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Payout Initiated",
      description: `KES ${userData.cycleData.totalAmount.toLocaleString()} being sent to ${userData.cycleData.nextRecipient}`,
    });
  };

  const handleExportData = () => {
    toast({
      title: "Export Started",
      description: "Financial records are being prepared for download",
    });
  };

  const handleAddMember = (newMember: any) => {
    // mutate original array if provided, otherwise just push into safeMembers
    if (Array.isArray(members)) {
      members.push(newMember);
    } else {
      safeMembers.push(newMember);
    }
    toast({
      title: "Member Added",
      description: "New member has been added successfully",
    });
  };

  const handleEditMember = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      setEditingMember(memberId);
      setEditedMemberData({ ...member });
    }
  };

  const handleSaveMember = (memberId: string) => {
    const index = members.findIndex(m => m.id === memberId);
    if (index !== -1) {
      members[index] = { ...editedMemberData };
    }
    setEditingMember(null);
    setEditedMemberData({});
    toast({
      title: "Member Updated",
      description: "Member information has been saved successfully",
    });
  };

  const handleDeleteMember = (memberId: string) => {
    const index = members.findIndex(m => m.id === memberId);
    if (index !== -1) {
      members.splice(index, 1);
    }
    toast({
      title: "Member Removed",
      description: "Member has been removed from the group",
    });
  };

  const handleTogglePaymentStatus = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      const newStatus = member.status === 'paid' ? 'pending' : 'paid';
      member.status = newStatus;
      member.amount = newStatus === 'paid' ? 204 : 0;
      member.date = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
      
      toast({
        title: "Payment Status Updated",
        description: `${member.name}'s payment status changed to ${newStatus}`,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setEditedMemberData({});
  };

  

  return (
    <div className="space-y-6">
      {/* Admin Actions */}
      <Card className="border-l-4 border-l-accent bg-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSendReminders} variant="outline" size="sm">
              <Send className="w-4 h-4 mr-2" />
              Send Reminders
            </Button>
            <Button 
              onClick={handleProcessPayout} 
              variant={userData.cycleData.paidMembers === userData.cycleData.totalMembers ? "financial" : "outline"}
              size="sm"
              disabled={userData.cycleData.paidMembers < userData.cycleData.totalMembers}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Process Payout
            </Button>
            <Button onClick={handleExportData} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Records
            </Button>
            <Button 
              onClick={() => setShowAddMemberDialog(true)}
              variant="outline" 
              size="sm"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
            <Button 
              onClick={() => setShowAnnouncementDialog(true)}
              variant="secondary" 
              size="sm"
            >
              <Megaphone className="w-4 h-4 mr-2" />
              Send Announcement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="members">Member Management</TabsTrigger>
          <TabsTrigger value="payments">Payment Tracking</TabsTrigger>
          <TabsTrigger value="disbursements">Disbursements</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          {/* Member Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-financial-success" />
                  Paid Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-financial-success mb-2">
                  {paidMembers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  KES {(paidMembers.length * 204).toLocaleString()} collected
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-financial-warning" />
                  Pending Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-financial-warning mb-2">
                  {pendingMembers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  KES {(pendingMembers.length * 204).toLocaleString()} outstanding
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member List */}
          <Card>
              <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>
                Total: {safeMembers.length} members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeMembers.map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    {editingMember === member.id ? (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`name-${member.id}`} className="text-xs">Name</Label>
                            <Input
                              id={`name-${member.id}`}
                              value={editedMemberData.name || ''}
                              onChange={(e) => setEditedMemberData(prev => ({...prev, name: e.target.value}))}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`phone-${member.id}`} className="text-xs">Phone</Label>
                            <Input
                              id={`phone-${member.id}`}
                              value={editedMemberData.phone || ''}
                              onChange={(e) => setEditedMemberData(prev => ({...prev, phone: e.target.value}))}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveMember(member.id)}>
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            member.status === 'paid' ? 'bg-financial-success' : 'bg-financial-warning'
                          }`} />
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {member.id} • {member.phone}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Badge variant={member.status === 'paid' ? 'default' : 'secondary'}>
                              {member.status === 'paid' ? 'Paid' : 'Pending'}
                            </Badge>
                            {member.date && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {member.date}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant={member.status === 'paid' ? 'destructive' : 'default'}
                              onClick={() => handleTogglePaymentStatus(member.id)}
                            >
                              {member.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEditMember(member.id)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleDeleteMember(member.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          {/* Payment Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Collection Progress
              </CardTitle>
              <CardDescription>
                Cycle #{userData.cycleData.currentCycle} • {userData.cycleData.daysLeft} days remaining
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Collection Progress</span>
                  <span>{Math.round((userData.cycleData.paidMembers / userData.cycleData.totalMembers) * 100)}%</span>
                </div>
                <Progress 
                  value={(userData.cycleData.paidMembers / userData.cycleData.totalMembers) * 100} 
                  className="h-3"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {userData.cycleData.paidMembers}/{userData.cycleData.totalMembers}
                  </div>
                  <div className="text-sm text-muted-foreground">Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-financial-success">
                    KES {userData.cycleData.collectedAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Collected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    KES {(userData.cycleData.totalAmount - userData.cycleData.collectedAmount).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Recent Payments</CardTitle>
                  <CardDescription>Latest contributions for this cycle</CardDescription>
                </div>
                <div>
                  <Button size="sm" variant="outline" onClick={fetchPayments}>Refresh</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(recentPayments.length ? recentPayments : paidMembers.slice(0, 5)).map((payment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-financial-success/5 border border-financial-success/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div>
                        <div className="font-medium">{payment.name || payment.member_id || payment.phone}</div>
                        <div className="text-sm text-muted-foreground">{payment.phone || payment.mpesa_transaction_id || ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-financial-success">
                        KES {payment.amount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disbursements" className="space-y-6">
          {/* M-Pesa Send Payment Section */}
          <Card className="border-l-4 border-l-mpesa-green bg-mpesa-green/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-mpesa-green" />
                Send M-Pesa Payment
              </CardTitle>
              <CardDescription>
                Send money directly to members via M-Pesa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Send payments to any group member from your M-Pesa account
                  </p>
                </div>
                <Button 
                  onClick={() => setShowDisbursementDialog(true)}
                  variant="mpesa"
                  size="sm"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Send Payment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Next Disbursement */}
          <Card className="border-l-4 border-l-accent bg-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Next Disbursement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient:</span>
                  <span className="font-semibold">{userData.cycleData.nextRecipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold text-accent">
                    KES {userData.cycleData.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={userData.cycleData.paidMembers === userData.cycleData.totalMembers ? 'default' : 'secondary'}>
                    {userData.cycleData.paidMembers === userData.cycleData.totalMembers ? 'Ready' : 'Waiting for payments'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disbursement History */}
          <Card>
            <CardHeader>
              <CardTitle>Disbursement History</CardTitle>
              <CardDescription>Previous payouts to members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeDisbursements.map((disbursement, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div>
                        <div className="font-medium">Cycle #{disbursement.cycle}</div>
                        <div className="text-sm text-muted-foreground">
                          {disbursement.recipient} • {disbursement.date}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-financial-success">
                        KES {disbursement.amount.toLocaleString()}
                      </div>
                      <Badge variant="default" className="text-xs">
                        {disbursement.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="loans" className="space-y-6">
          <LoansTab />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6">
          <ApprovalsTab />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <ReportsTab />
        </TabsContent>
      </Tabs>

      {/* M-Pesa Disbursement Dialog */}
      <MpesaDisbursementDialog
        open={showDisbursementDialog}
        onOpenChange={setShowDisbursementDialog}
        members={safeMembers}
      />

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        onMemberAdded={handleAddMember}
      />

      {/* Announcement Dialog */}
      <AnnouncementDialog
        open={showAnnouncementDialog}
        onOpenChange={setShowAnnouncementDialog}
      />
    </div>
  );
};

export default AdminDashboard;