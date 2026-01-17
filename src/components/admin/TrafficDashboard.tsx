import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Calendar } from 'lucide-react';
import API_BASE from '@/lib/api';

// Analytics Components
import DashboardOverview from './DashboardOverview';
import LoginAnalytics from './LoginAnalytics';
import SearchAnalytics from './SearchAnalytics';
import ActivityAnalytics from './ActivityAnalytics.tsx';
import MemberActivityTimeline from './MemberActivityTimeline.tsx';

export default function TrafficDashboard() {
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [searchData, setSearchData] = useState<any>(null);
  const [loginData, setLoginData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const promises = [
        fetch(`${API_BASE}/api/analytics/dashboard?period=${period}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/analytics/searches?period=${period}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/analytics/logins?period=${period}`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/api/analytics/activities?period=${period}`, { headers }).then(r => r.json())
      ];

      const [dashboard, searches, logins, activities] = await Promise.all(promises);

      setDashboardData(dashboard);
      setSearchData(searches);
      setLoginData(logins);
      setActivityData(activities);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv' | 'excel') => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE}/api/analytics/export?period=${period}&format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  // Fetch data on mount and when period changes
  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Traffic & Analytics Dashboard</h1>
          <p className="text-muted-foreground">Monitor system usage, user activity, and engagement</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button 
            variant="outline" 
            size="icon"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Export Button */}
          <Button 
            variant="outline"
            onClick={() => handleExport('csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logins">Logins & Sessions</TabsTrigger>
          <TabsTrigger value="searches">Search Activity</TabsTrigger>
          <TabsTrigger value="activities">Member Activities</TabsTrigger>
          <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {dashboardData ? (
            <DashboardOverview data={dashboardData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Loading dashboard data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logins" className="space-y-4">
          {loginData ? (
            <LoginAnalytics data={loginData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Loading login data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="searches" className="space-y-4">
          {searchData ? (
            <SearchAnalytics data={searchData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Loading search data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          {activityData ? (
            <ActivityAnalytics data={activityData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Loading activity data...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <MemberActivityTimeline />
        </TabsContent>
      </Tabs>
    </div>
  );
}
