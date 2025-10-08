import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LogOut, 
  Wallet, 
  Users, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Settings,
  DollarSign,
  Phone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MemberDashboard from '@/components/MemberDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import PaymentDialog from '@/components/PaymentDialog';
import io from 'socket.io-client';

const socket = io('http://localhost:4000'); // Update if backend runs elsewhere

interface DashboardProps {
  userRole: 'admin' | 'member';
  userData: any;
  onLogout: () => void;
}

const Dashboard = ({ userRole, userData, onLogout }: DashboardProps) => {
  const { toast } = useToast();

  // Mock data for demonstration
  const [cycleData] = useState({
    currentCycle: 15,
    daysLeft: 3,
    totalMembers: 12,
    paidMembers: 8,
    nextRecipient: 'Mary Wanjiku',
    totalAmount: 2448, // 12 members × 204 KES
    collectedAmount: 1632, // 8 members × 204 KES
    cycleStartDate: '2024-01-15',
    paymentDeadline: '2024-01-20'
  });

  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState([]);

  const handleLogout = () => {
    toast({
      title: "Logged out successfully",
      description: "You have been safely logged out of SMCF",
    });
    onLogout();
  };

  useEffect(() => {
    socket.on('announcement:new', (announcement) => {
      setAnnouncements((prev) => [announcement, ...prev]);
    });
    socket.on('member:new', (member) => {
      setMembers((prev) => [member, ...prev]);
    });
    return () => {
      socket.off('announcement:new');
      socket.off('member:new');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              {userRole === 'admin' ? 'A' : 'M'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">
                {userRole === 'admin' ? 'Admin Dashboard' : 'Member Dashboard'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {userData.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>
              {userRole === 'admin' ? 'Administrator' : `Member ${userData.memberId}`}
            </Badge>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Cycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary mb-2">
                #{cycleData.currentCycle}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {cycleData.daysLeft} days left
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Collection Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-financial-success mb-2">
                {Math.round((cycleData.paidMembers / cycleData.totalMembers) * 100)}%
              </div>
              <Progress 
                value={(cycleData.paidMembers / cycleData.totalMembers) * 100} 
                className="h-2"
              />
              <div className="text-sm text-muted-foreground mt-2">
                {cycleData.paidMembers}/{cycleData.totalMembers} members paid
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Amount Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent mb-2">
                KES {cycleData.collectedAmount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                of KES {cycleData.totalAmount.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-financial transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Next Recipient
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary mb-2">
                {cycleData.nextRecipient}
              </div>
              <div className="text-sm text-muted-foreground">
                Awaiting full collection
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Role-specific Dashboard */}
        {userRole === 'member' ? (
          <MemberDashboard userData={userData} cycleData={cycleData} />
        ) : (
          <AdminDashboard userData={userData} cycleData={cycleData} />
        )}
      </div>
    </div>
  );
};

export default Dashboard;