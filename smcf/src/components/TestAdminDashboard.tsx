// Simple Admin Test Component
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TestAdminDashboardProps {
  userData: {
    name?: string;
    phone?: string;
    role?: string;
  };
  onLogout: () => void;
}

const TestAdminDashboard = ({ userData, onLogout }: TestAdminDashboardProps) => {
  console.log('TestAdminDashboard rendered with userData:', userData);
  
  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>Welcome: {userData?.name || 'Unknown Admin'}</p>
            <p>Phone: {userData?.phone || 'No Phone'}</p>
            <p>Role: {userData?.role || 'No Role'}</p>
            <Button onClick={onLogout} variant="outline">
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestAdminDashboard;