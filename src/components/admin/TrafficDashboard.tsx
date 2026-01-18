import { useState, useEffect, useCallback } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [searchData, setSearchData] = useState<any>(null);
  const [loginData, setLoginData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No admin token found. Please login again.');
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      console.log('Fetching analytics data...');
      console.log('API_BASE:', API_BASE);

      const promises = [
        fetch(`${API_BASE}/api/analytics/dashboard?period=${period}`, { headers })
          .then(r => {
            if (!r.ok) throw new Error(`Dashboard API failed: ${r.status}`);
            return r.json();
          }),
        fetch(`${API_BASE}/api/analytics/searches?period=${period}`, { headers })
          .then(r => {
            if (!r.ok) throw new Error(`Searches API failed: ${r.status}`);
            return r.json();
          }),
        fetch(`${API_BASE}/api/analytics/logins?period=${period}`, { headers })
          .then(r => {
            if (!r.ok) throw new Error(`Logins API failed: ${r.status}`);
            return r.json();
          }),
        fetch(`${API_BASE}/api/analytics/activities?period=${period}`, { headers })
          .then(r => {
            if (!r.ok) throw new Error(`Activities API failed: ${r.status}`);
            return r.json();
          })
      ];

      const [dashboard, searches, logins, activities] = await Promise.all(promises);

      console.log('Analytics data fetched successfully');
      setDashboardData(dashboard);
      setSearchData(searches);
      setLoginData(logins);
      setActivityData(activities);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
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
      <div className="sticky top-0 z-10 bg-background pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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

      {/* Error Banner */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchAnalytics}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="sticky top-[72px] z-10 bg-background pb-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logins">Logins & Sessions</TabsTrigger>
            <TabsTrigger value="searches">Search Activity</TabsTrigger>
            <TabsTrigger value="activities">Member Activities</TabsTrigger>
            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading dashboard data...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchAnalytics}>Retry</Button>
              </CardContent>
            </Card>
          ) : dashboardData ? (
            <DashboardOverview data={dashboardData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logins" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading login data...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchAnalytics}>Retry</Button>
              </CardContent>
            </Card>
          ) : loginData ? (
            <LoginAnalytics data={loginData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="searches" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading search data...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchAnalytics}>Retry</Button>
              </CardContent>
            </Card>
          ) : searchData ? (
            <SearchAnalytics data={searchData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading activity data...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchAnalytics}>Retry</Button>
              </CardContent>
            </Card>
          ) : activityData ? (
            <ActivityAnalytics data={activityData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No data available</p>
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
