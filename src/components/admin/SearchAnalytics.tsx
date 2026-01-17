import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SearchAnalyticsProps {
  data: {
    totalSearches: number;
    topSearches: Array<{ _id: string; count: number }>;
    searchesByCategory: Array<{ _id: string; count: number }>;
    recentSearches: Array<{
      _id: string;
      searchTerm: string;
      searchCategory: string;
      userId: {
        firstName?: string;
        lastName?: string;
        phoneNumber: string;
      };
      resultsCount: number;
      createdAt: string;
      suspicious: boolean;
    }>;
    suspiciousSearches: number;
  };
}

export default function SearchAnalytics({ data }: SearchAnalyticsProps) {
  const [showAllRecent, setShowAllRecent] = useState(false);
  
  const recentSearchesToShow = showAllRecent ? data.recentSearches : data.recentSearches.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSearches}</div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Search</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {data.topSearches[0]?._id || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.topSearches[0]?.count || 0} searches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious</CardTitle>
            <Badge variant="destructive">{data.suspiciousSearches}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.suspiciousSearches}</div>
            <p className="text-xs text-muted-foreground">Flagged patterns</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Searches */}
      <Card>
        <CardHeader>
          <CardTitle>Top Search Terms</CardTitle>
          <CardDescription>Most frequently searched keywords</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topSearches.slice(0, 10).map((search, index) => (
              <div key={search._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium">{search._id}</span>
                </div>
                <Badge variant="secondary">{search.count} searches</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Searches by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Searches by Category</CardTitle>
          <CardDescription>Distribution across different sections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.searchesByCategory.map((category) => {
              const percentage = ((category.count / data.totalSearches) * 100).toFixed(1);
              return (
                <div key={category._id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{category._id}</span>
                    <span className="text-muted-foreground">{category.count} ({percentage}%)</span>
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

      {/* Recent Searches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Searches</CardTitle>
          <CardDescription>Latest search activity</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Search Term</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSearchesToShow.map((search) => (
                <TableRow key={search._id}>
                  <TableCell className="font-medium">{search.searchTerm}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {search.searchCategory}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {search.userId?.firstName && search.userId?.lastName
                          ? `${search.userId.firstName} ${search.userId.lastName}`
                          : 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {search.userId?.phoneNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{search.resultsCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(search.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    {search.suspicious ? (
                      <Badge variant="destructive">Suspicious</Badge>
                    ) : (
                      <Badge variant="secondary">Normal</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.recentSearches.length > 10 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllRecent(!showAllRecent)}
                className="text-sm text-primary hover:underline"
              >
                {showAllRecent ? 'Show Less' : `Show All (${data.recentSearches.length})`}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
