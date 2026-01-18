// Member Activity Timeline Component
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, LogIn, DollarSign, FileText, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import API_BASE from '@/lib/api';

interface TimelineActivity {
  _id: string;
  activityType: string;
  description: string;
  amount: number | null;
  status: string;
  createdAt: string;
  actorId?: {
    firstName?: string;
    lastName?: string;
  };
}

export default function MemberActivityTimeline() {
  const [searchTerm, setSearchTerm] = useState('');
  const [memberId, setMemberId] = useState('');
  const [timeline, setTimeline] = useState<TimelineActivity[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [lastLogin, setLastLogin] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchMemberTimeline = async () => {
    if (!memberId) return;

    setLoading(true);
    setSearched(true);
    try {
      const token = localStorage.getItem('smcf_token');
      const response = await fetch(`${API_BASE}/api/reports/members/${memberId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTimeline(data.timeline || []);
        setLoginHistory(data.loginHistory || []);
        setSearchHistory(data.searchHistory || []);
        setLastLogin(data.lastLogin);
      }
    } catch (error) {
      console.error('Error fetching member timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'login': LogIn,
      'logout': LogIn,
      'deposit': DollarSign,
      'withdrawal': DollarSign,
      'loan_application': FileText,
      'loan_approval': FileText,
      'search': Search,
      'default': User
    };
    const Icon = iconMap[type] || iconMap.default;
    return <Icon className="h-4 w-4" />;
  };

  const getActivityColor = (type: string) => {
    const colorMap: Record<string, string> = {
      'login': 'bg-blue-500',
      'logout': 'bg-gray-500',
      'deposit': 'bg-green-500',
      'withdrawal': 'bg-orange-500',
      'loan_application': 'bg-purple-500',
      'loan_approval': 'bg-green-600',
      'loan_rejection': 'bg-red-500',
      'search': 'bg-yellow-500',
      'default': 'bg-gray-400'
    };
    return colorMap[type] || colorMap.default;
  };

  return (
    <div className="space-y-6">
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Member Activity Timeline</CardTitle>
          <CardDescription>View complete activity history for any member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter member ID or phone number"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setMemberId(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchMemberTimeline();
                }
              }}
              className="flex-1"
            />
            <Button onClick={fetchMemberTimeline} disabled={loading || !memberId}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <>
          {/* Last Login Info */}
          {lastLogin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Last Login
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(lastLogin.loginTime), { addSuffix: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Device</p>
                    <p className="font-medium capitalize">{lastLogin.deviceType || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Browser</p>
                    <p className="font-medium">{lastLogin.browser || 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>
                {timeline.length} activities found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length > 0 ? (
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

                  {timeline.map((activity, index) => (
                    <div key={activity._id} className="relative flex gap-4 pl-12">
                      {/* Timeline dot */}
                      <div 
                        className={`absolute left-3 w-4 h-4 rounded-full ${getActivityColor(activity.activityType)} flex items-center justify-center`}
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>

                      {/* Activity card */}
                      <div className="flex-1 bg-muted/50 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getActivityIcon(activity.activityType)}
                              <Badge variant="outline" className="capitalize">
                                {activity.activityType.replace(/_/g, ' ')}
                              </Badge>
                              {activity.status && (
                                <Badge 
                                  variant={activity.status === 'success' ? 'default' : 
                                           activity.status === 'failed' ? 'destructive' : 'secondary'}
                                  className="capitalize"
                                >
                                  {activity.status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{activity.description}</p>
                            {activity.amount && (
                              <p className="text-sm font-semibold text-primary mt-1">
                                KES {activity.amount.toLocaleString()}
                              </p>
                            )}
                            {activity.actorId && (
                              <p className="text-xs text-muted-foreground mt-1">
                                By: {activity.actorId.firstName} {activity.actorId.lastName}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No activities found for this member
                </div>
              )}
            </CardContent>
          </Card>

          {/* Login History */}
          {loginHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Login History</CardTitle>
                <CardDescription>Recent login sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {loginHistory.map((login) => (
                    <div key={login._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <LogIn className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(login.loginTime).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {login.deviceType} • {login.browser}
                            {login.sessionDuration > 0 && ` • ${Math.floor(login.sessionDuration / 60)} min`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={login.isActive ? 'default' : 'secondary'}>
                        {login.isActive ? 'Active' : 'Ended'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search History */}
          {searchHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Search History</CardTitle>
                <CardDescription>Recent searches by this member</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {searchHistory.map((search) => (
                    <div key={search._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{search.searchTerm}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {search.searchCategory} • {search.resultsCount} results
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(search.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {searched && timeline.length === 0 && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No data found for this member ID</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
