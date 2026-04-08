import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Plus, Download, DollarSign, TrendingUp } from 'lucide-react';

const reserveHistory = [
  { quarter: 'Q1 2023', balance: 1200000 },
  { quarter: 'Q2 2023', balance: 1450000 },
  { quarter: 'Q3 2023', balance: 1800000 },
  { quarter: 'Q4 2023', balance: 2100000 },
  { quarter: 'Q1 2024', balance: 2350000 },
  { quarter: 'Q2 2024', balance: 2600000 },
  { quarter: 'Q3 2024', balance: 2850000 },
];

const allocations = [
  { name: 'Statutory Reserve', amount: 1140000, percentage: 40 },
  { name: 'Operational Reserve', amount: 570000, percentage: 20 },
  { name: 'Risk Reserve', amount: 570000, percentage: 20 },
  { name: 'Growth Fund', amount: 285000, percentage: 10 },
  { name: 'Emergency Fund', amount: 285000, percentage: 10 }
];

export function ReserveFundTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Reserve Fund Management</CardTitle>
          <CardDescription>Monitor and manage SACCO reserve funds and allocations</CardDescription>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Record Allocation
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900">KES 2.85M</p>
                <p className="text-xs text-green-600 mt-1">↑ 10.2% YoY</p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reserve Ratio</p>
                <p className="text-3xl font-bold text-gray-900">6.2%</p>
                <p className="text-xs text-gray-600 mt-1">vs capital</p>
              </div>
              <TrendingUp className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Contribution</p>
                <p className="text-3xl font-bold text-gray-900">KES 85K</p>
                <p className="text-xs text-gray-600 mt-1">from surplus</p>
              </div>
              <DollarSign className="h-10 w-10 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reserve Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Reserve Fund Growth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={reserveHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="quarter" />
              <YAxis />
              <Tooltip formatter={(value) => {
                const numericValue = typeof value === 'number' ? value : Number(value);
                return `KES ${(numericValue / 1000000).toFixed(2)}M`;
              }} />
              <Line type="monotone" dataKey="balance" stroke="#C9A227" strokeWidth={2} name="Reserve Balance" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Allocations */}
      <Card>
        <CardHeader>
          <CardTitle>Current Allocations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {allocations.map((allocation) => (
            <div key={allocation.name} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{allocation.name}</p>
                <Progress
                  value={allocation.percentage}
                  className="mt-2 h-2 [&>div]:bg-gradient-to-r [&>div]:from-yellow-500 [&>div]:to-green-500"
                />
              </div>
              <div className="ml-4 text-right">
                <p className="font-semibold">{allocation.amount.toLocaleString()}</p>
                <p className="text-sm text-gray-600">{allocation.percentage}%</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
