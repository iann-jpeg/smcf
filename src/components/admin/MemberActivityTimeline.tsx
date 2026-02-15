// Member Activity Timeline Component
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, LogIn, DollarSign, FileText, User, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import API_BASE from '@/lib/api';
import { authService } from '@/lib/authService';

interface TimelineActivity {
  _id: string;
  activityType: string;
  description: string;
  amount: number | null;
  status: string;
  createdAt: string;
  userId?: {
    name?: string;
    phone?: string;
    member_id?: string;
  };
  actorId?: {
    name?: string;
    phone?: string;
    member_id?: string;
  };
}

export default function MemberActivityTimeline() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch all activities on component mount
  useEffect(() => {
    fetchAllActivities();
  }, []);

  const fetchAllActivities = async (search?: string) => {
    setLoading(true);
    try {
      const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`${API_BASE}/api/analytics/timeline/all${searchParam}&limit=200`, {
        headers: authService.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching activity timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchAllActivities(searchTerm);
  };

  const handleReset = () => {
    setSearchTerm('');
    fetchAllActivities();
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
      {/* Header Card with Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Complete Activity Timeline</CardTitle>
              <CardDescription>All member activities across the system ({totalCount.toLocaleString()} total)</CardDescription>
            </div>
            <Button onClick={handleReset} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Search by member name, ID, or phone number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
            {searchTerm && (
              <Button onClick={handleReset} variant="outline">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            {activities.length > 0 ? `Showing ${activities.length} of ${totalCount} activities` : 'No activities found'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Loading activities...</p>
            </div>
          ) : activities.length > 0 ? (
            <div className="relative space-y-4 max-h-[800px] overflow-auto">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

              {activities.map((activity) => (
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
                        {/* User Info */}
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">
                            {activity.userId?.name || 'Unknown User'}
                          </span>
                          {activity.userId?.member_id && (
                            <Badge variant="secondary" className="text-xs">
                              {activity.userId.member_id}
                            </Badge>
                          )}
                        </div>

                        {/* Activity Type */}
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

                        {/* Description */}
                        <p className="text-sm">{activity.description}</p>

                        {/* Amount */}
                        {activity.amount && (
                          <p className="text-sm font-semibold text-primary mt-1">
                            KES {activity.amount.toLocaleString()}
                          </p>
                        )}

                        {/* Actor */}
                        {activity.actorId && activity.actorId.name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            By: {activity.actorId.name}
                            {activity.actorId.member_id && ` (${activity.actorId.member_id})`}
                          </p>
                        )}

                        {/* Phone */}
                        {activity.userId?.phone && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {activity.userId.phone}
                          </p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No activities found</p>
              <p className="text-sm mt-1">{searchTerm ? 'Try a different search term' : 'Activities will appear here as members use the system'}</p>
            </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
