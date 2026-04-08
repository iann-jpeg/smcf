import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, Briefcase, AlertTriangle } from 'lucide-react';

interface OverviewStats {
  totalSharesIssued: number;
  totalShareholders: number;
  totalDividendsDeclared: number;
  shareCapitalValue: number;
}

interface ShareholderGrowthPoint {
  month: string;
  shareholders: number;
  activeMembers: number;
}

interface SharesDistributionPoint {
  name: string;
  value: number;
  fill: string;
}

interface DividendHistoryPoint {
  year: string;
  amount: number;
  perShare: number;
}

export function OverviewTab({ stats }: { stats: OverviewStats }) {
  const [shareholdersGrowth, setShareholdersGrowth] = useState<ShareholderGrowthPoint[]>([]);
  const [sharesDistribution, setSharesDistribution] = useState<SharesDistributionPoint[]>([]);
  const [dividendHistory, setDividendHistory] = useState<DividendHistoryPoint[]>([]);

  useEffect(() => {
    // Mock data for shareholding growth
    setShareholdersGrowth([
      { month: 'Jan', shareholders: 180, activeMembers: 165 },
      { month: 'Feb', shareholders: 195, activeMembers: 182 },
      { month: 'Mar', shareholders: 210, activeMembers: 198 },
      { month: 'Apr', shareholders: 225, activeMembers: 215 },
      { month: 'May', shareholders: 235, activeMembers: 227 },
      { month: 'Jun', shareholders: 247, activeMembers: 234 }
    ]);

    // Mock data for shares distribution by category
    setSharesDistribution([
      { name: 'Staff', value: 15420, fill: '#C9A227' },
      { name: 'Suppliers', value: 12380, fill: '#2D7A36' },
      { name: 'Members', value: 10520, fill: '#1e40af' },
      { name: 'Management', value: 4850, fill: '#dc2626' },
      { name: 'Directors', value: 2510, fill: '#7c3aed' }
    ]);

    // Mock data for dividend history
    setDividendHistory([
      { year: '2021', amount: 2100000, perShare: 46 },
      { year: '2022', amount: 2850000, perShare: 58 },
      { year: '2023', amount: 3200000, perShare: 70 },
      { year: '2024', amount: 3950000, perShare: 87 },
      { year: '2025', amount: 8950000, perShare: 196 }
    ]);
  }, []);

  return (
    <div className="space-y-6">
      {/* Quick Alerts */}
      <Card className="border-l-4 border-l-yellow-500 bg-yellow-50">
        <CardContent className="pt-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">11 items require review</p>
            <p className="text-sm text-gray-600">
              8 pending share applications, 3 exit requests, and 1 beneficiary update
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shareholding Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Shareholding Growth Trend</CardTitle>
            <CardDescription>Total shareholders and active members over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={shareholdersGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="shareholders" 
                  stroke="#C9A227" 
                  name="Total Shareholders"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="activeMembers" 
                  stroke="#2D7A36" 
                  name="Active Members"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Share Distribution by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Share Distribution by Category</CardTitle>
            <CardDescription>Breakdown of {stats.totalSharesIssued.toLocaleString()} shares across member categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sharesDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sharesDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => (typeof value === 'number' ? value.toLocaleString() : String(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Dividend Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Dividend Payment Trend</CardTitle>
          <CardDescription>Annual total dividends and per-share dividend payments</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dividendHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis yAxisId="left" label={{ value: 'Total Dividends (KES)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Per Share (KES)', angle: 90, position: 'insideRight' }} />
              <Tooltip 
                formatter={(value) => typeof value === 'number' ? value.toLocaleString() : value}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="amount" fill="#C9A227" name="Total Dividends (KES)" />
              <Bar yAxisId="right" dataKey="perShare" fill="#2D7A36" name="Per Share (KES)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Growth Rate Card - Green */}
        <Card className="border-t-4 border-t-emerald-500 bg-gradient-to-br from-emerald-50 to-white hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-emerald-900">Growth Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-emerald-600">+4.9%</div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-emerald-700 mt-2">vs same period last year</p>
          </CardContent>
        </Card>

        {/* Avg Shareholding Card - Blue */}
        <Card className="border-t-4 border-t-blue-500 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-900">Avg Shareholding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-600">
                {Math.round(stats.totalSharesIssued / stats.totalShareholders)} shares
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-blue-700 mt-2">Average per shareholder</p>
          </CardContent>
        </Card>

        {/* Dividend Ratio Card - Orange */}
        <Card className="border-t-4 border-t-orange-500 bg-gradient-to-br from-orange-50 to-white hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-900">Dividend Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-orange-600">
                {((stats.totalDividendsDeclared / stats.shareCapitalValue) * 100).toFixed(1)}%
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-orange-700 mt-2">vs share capital</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
