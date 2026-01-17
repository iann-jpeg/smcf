import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LogIn, Clock, Smartphone, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';

interface LoginAnalyticsProps {
  data: {
    totalLogins: number;
    uniqueUsers: number;
    averageSessionDuration: number;
    loginsByRole: Array<{ _id: string; count: number }>;
    loginsByDevice: Array<{ _id: string; count: number }>;
    activeSessions: Array<{
      _id: string;
      userId: {
        firstName?: string;
        lastName?: string;
        phoneNumber: string;
      };
      role: string;
      loginTime: string;
      deviceType: string;
      browser: string;
    }>;
    failedAttempts: Array<{ _id: string; count: number }>;
    suspiciousIPs: Array<{ _id: string; failedAttempts: number }>;
  };
}

export default function LoginAnalytics({ data }: LoginAnalyticsProps) {
  const [showAllSessions, setShowAllSessions] = useState(false);

  const formatSessionDuration = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
    return formatDuration(duration, { format: ['hours', 'minutes'] });
  };

  const activeSessionsToShow = showAllSessions ? data.activeSessions : data.activeSessions.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalLogins}</div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <LogIn className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Different accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatSessionDuration(data.averageSessionDuration)}
            </div>
            <p className="text-xs text-muted-foreground">Session duration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.failedAttempts.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Security alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Logins by Role */}
      <Card>
        <CardHeader>
          <CardTitle>Logins by Role</CardTitle>
          <CardDescription>Distribution by user type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.loginsByRole.map((role) => {
              const total = data.loginsByRole.reduce((sum, r) => sum + r.count, 0);
              const percentage = ((role.count / total) * 100).toFixed(1);
              return (
                <div key={role._id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{role._id.replace('_', ' ')}</span>
                    <span className="text-muted-foreground">{role.count} ({percentage}%)</span>
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

      {/* Logins by Device */}
      <Card>
        <CardHeader>
          <CardTitle>Logins by Device Type</CardTitle>
          <CardDescription>Platform distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.loginsByDevice.map((device) => {
              const total = data.loginsByDevice.reduce((sum, d) => sum + d.count, 0);
              const percentage = ((device.count / total) * 100).toFixed(1);
              return (
                <div key={device._id} className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <Smartphone className="h-8 w-8 text-primary" />
                  <div>
                    <div className="font-medium capitalize">{device._id}</div>
                    <div className="text-sm text-muted-foreground">
                      {device.count} ({percentage}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Currently logged in users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>Login Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSessionsToShow.map((session) => (
                <TableRow key={session._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {session.userId?.firstName && session.userId?.lastName
                          ? `${session.userId.firstName} ${session.userId.lastName}`
                          : 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {session.userId?.phoneNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {session.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{session.deviceType || 'Unknown'}</TableCell>
                  <TableCell>{session.browser || 'Unknown'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(session.loginTime), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.activeSessions.length > 10 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllSessions(!showAllSessions)}
                className="text-sm text-primary hover:underline"
              >
                {showAllSessions ? 'Show Less' : `Show All (${data.activeSessions.length})`}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Login Attempts */}
      {data.failedAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Failed Login Attempts</CardTitle>
            <CardDescription>Breakdown by failure reason</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.failedAttempts.map((attempt) => (
                <div key={attempt._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <span className="capitalize font-medium">{attempt._id?.replace('_', ' ') || 'Other'}</span>
                  <Badge variant="destructive">{attempt.count} attempts</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suspicious IPs */}
      {data.suspiciousIPs.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Suspicious IP Addresses
            </CardTitle>
            <CardDescription>IPs with multiple failed login attempts (last 24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.suspiciousIPs.map((ip) => (
                <div key={ip._id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <span className="font-mono text-sm">{ip._id || 'Unknown'}</span>
                  <Badge variant="destructive">{ip.failedAttempts} failed attempts</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
