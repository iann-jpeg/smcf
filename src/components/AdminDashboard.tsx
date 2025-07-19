import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminDashboardProps {
  userData: any;
  cycleData: any;
}

const AdminDashboard = ({ userData, cycleData }: AdminDashboardProps) => {
  const { toast } = useToast();

  // Mock admin data
  const [adminData] = useState({
    members: [
      { id: 'SMCF-0001', name: 'John Kamau', phone: '+254722123456', status: 'paid', amount: 200, date: '2024-01-15' },
      { id: 'SMCF-0002', name: 'Mary Wanjiku', phone: '+254733234567', status: 'paid', amount: 200, date: '2024-01-15' },
      { id: 'SMCF-0003', name: 'Peter Mwangi', phone: '+254744345678', status: 'paid', amount: 200, date: '2024-01-16' },
      { id: 'SMCF-0004', name: 'Grace Nyong', phone: '+254755456789', status: 'paid', amount: 200, date: '2024-01-16' },
      { id: 'SMCF-0005', name: 'David Kiprotich', phone: '+254766567890', status: 'paid', amount: 200, date: '2024-01-17' },
      { id: 'SMCF-0006', name: 'Sarah Wambui', phone: '+254777678901', status: 'paid', amount: 200, date: '2024-01-17' },
      { id: 'SMCF-0007', name: 'James Ochieng', phone: '+254788789012', status: 'paid', amount: 200, date: '2024-01-18' },
      { id: 'SMCF-0008', name: 'Faith Akinyi', phone: '+254799890123', status: 'paid', amount: 200, date: '2024-01-18' },
      { id: 'SMCF-0009', name: 'Michael Kariuki', phone: '+254700901234', status: 'pending', amount: 0, date: null },
      { id: 'SMCF-0010', name: 'Lucy Njeri', phone: '+254711012345', status: 'pending', amount: 0, date: null },
      { id: 'SMCF-0011', name: 'Samuel Mutua', phone: '+254722123456', status: 'pending', amount: 0, date: null },
      { id: 'SMCF-0012', name: 'Agnes Wanjala', phone: '+254733234567', status: 'pending', amount: 0, date: null },
    ],
    disbursements: [
      { cycle: 14, recipient: 'John Kamau', amount: 2400, date: '2024-01-10', status: 'completed' },
      { cycle: 13, recipient: 'Mary Wanjiku', amount: 2400, date: '2024-01-05', status: 'completed' },
      { cycle: 12, recipient: 'Peter Mwangi', amount: 2400, date: '2023-12-31', status: 'completed' },
    ]
  });

  const handleSendReminders = () => {
    const pendingMembers = adminData.members.filter(m => m.status === 'pending');
    toast({
      title: "Reminders Sent",
      description: `Payment reminders sent to ${pendingMembers.length} members`,
    });
  };

  const handleProcessPayout = () => {
    if (cycleData.paidMembers < cycleData.totalMembers) {
      toast({
        title: "Cannot Process Payout",
        description: "All members must pay before disbursement",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Payout Initiated",
      description: `KES ${cycleData.totalAmount.toLocaleString()} being sent to ${cycleData.nextRecipient}`,
    });
  };

  const handleExportData = () => {
    toast({
      title: "Export Started",
      description: "Financial records are being prepared for download",
    });
  };

  const paidMembers = adminData.members.filter(m => m.status === 'paid');
  const pendingMembers = adminData.members.filter(m => m.status === 'pending');

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
              variant={cycleData.paidMembers === cycleData.totalMembers ? "financial" : "outline"}
              size="sm"
              disabled={cycleData.paidMembers < cycleData.totalMembers}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Process Payout
            </Button>
            <Button onClick={handleExportData} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Records
            </Button>
            <Button variant="outline" size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members">Member Management</TabsTrigger>
          <TabsTrigger value="payments">Payment Tracking</TabsTrigger>
          <TabsTrigger value="disbursements">Disbursements</TabsTrigger>
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
                  KES {(paidMembers.length * 200).toLocaleString()} collected
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
                  KES {(pendingMembers.length * 200).toLocaleString()} outstanding
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member List */}
          <Card>
            <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>
                Total: {adminData.members.length} members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {adminData.members.map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
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
                Cycle #{cycleData.currentCycle} • {cycleData.daysLeft} days remaining
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Collection Progress</span>
                  <span>{Math.round((cycleData.paidMembers / cycleData.totalMembers) * 100)}%</span>
                </div>
                <Progress 
                  value={(cycleData.paidMembers / cycleData.totalMembers) * 100} 
                  className="h-3"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {cycleData.paidMembers}/{cycleData.totalMembers}
                  </div>
                  <div className="text-sm text-muted-foreground">Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-financial-success">
                    KES {cycleData.collectedAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Collected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    KES {(cycleData.totalAmount - cycleData.collectedAmount).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>Latest contributions for this cycle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paidMembers.slice(0, 5).map((payment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-financial-success/5 border border-financial-success/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div>
                        <div className="font-medium">{payment.name}</div>
                        <div className="text-sm text-muted-foreground">{payment.phone}</div>
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
                  <span className="font-semibold">{cycleData.nextRecipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold text-accent">
                    KES {cycleData.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={cycleData.paidMembers === cycleData.totalMembers ? 'default' : 'secondary'}>
                    {cycleData.paidMembers === cycleData.totalMembers ? 'Ready' : 'Waiting for payments'}
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
                {adminData.disbursements.map((disbursement, index) => (
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
      </Tabs>
    </div>
  );
};

export default AdminDashboard;