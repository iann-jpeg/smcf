// Activity Analytics Component
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ActivityAnalyticsProps {
  data: {
    totalActivities: number;
    activitiesByType: Array<{ _id: string; count: number }>;
    recentActivities: Array<{
      _id: string;
      activityType: string;
      description: string;
      userId: {
        firstName?: string;
        lastName?: string;
        phoneNumber: string;
      };
      amount: number | null;
      status: string;
      createdAt: string;
    }>;
    mostActiveUsers: Array<{ _id: string; activityCount: number }>;
    activityTrends: Array<{ _id: string; count: number }>;
  };
}

export default function ActivityAnalytics({ data }: ActivityAnalyticsProps) {
  const [showAllActivities, setShowAllActivities] = useState(false);

  const activitiesToShow = showAllActivities ? data.recentActivities : data.recentActivities.slice(0, 15);

  const getActivityBadgeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      'login': 'bg-blue-100 text-blue-800',
      'logout': 'bg-gray-100 text-gray-800',
      'deposit': 'bg-green-100 text-green-800',
      'withdrawal': 'bg-orange-100 text-orange-800',
      'loan_application': 'bg-purple-100 text-purple-800',
      'loan_approval': 'bg-green-100 text-green-800',
      'loan_rejection': 'bg-red-100 text-red-800',
      'admin_action': 'bg-yellow-100 text-yellow-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Total Activities</CardTitle>
            <CardDescription>All tracked actions in selected period</CardDescription>
          </div>
          <Activity className="h-8 w-8 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{data.totalActivities}</div>
        </CardContent>
      </Card>

      {/* Activity Trends Chart */}
      {data.activityTrends && data.activityTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Trends</CardTitle>
            <CardDescription>Daily activity volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.activityTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="_id" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Activities by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Activities by Type</CardTitle>
          <CardDescription>Breakdown of different activity types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.activitiesByType.map((activity) => {
              const percentage = ((activity.count / data.totalActivities) * 100).toFixed(1);
              return (
                <div key={activity._id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">
                      {activity._id.replace(/_/g, ' ')}
                    </span>
                    <span className="text-muted-foreground">{activity.count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Most Active Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Most Active Users
          </CardTitle>
          <CardDescription>Top 10 users by activity count</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.mostActiveUsers.slice(0, 10).map((user, index) => (
              <div key={user._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium">User #{user._id.slice(-6)}</span>
                </div>
                <Badge variant="secondary">{user.activityCount} activities</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Latest tracked actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activitiesToShow.map((activity) => (
                <TableRow key={activity._id}>
                  <TableCell>
                    <Badge className={getActivityBadgeColor(activity.activityType)}>
                      {activity.activityType.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {activity.description}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">
                        {activity.userId?.firstName && activity.userId?.lastName
                          ? `${activity.userId.firstName} ${activity.userId.lastName}`
                          : 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {activity.userId?.phoneNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {activity.amount ? `KES ${activity.amount.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={activity.status === 'success' ? 'default' : 
                               activity.status === 'failed' ? 'destructive' : 'secondary'}
                    >
                      {activity.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.recentActivities.length > 15 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllActivities(!showAllActivities)}
                className="text-sm text-primary hover:underline"
              >
                {showAllActivities ? 'Show Less' : `Show All (${data.recentActivities.length})`}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
