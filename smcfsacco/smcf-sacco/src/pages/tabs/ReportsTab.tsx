import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Eye, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const reportData = [
  { month: 'Jan', shareholders: 210, shares: 42000, value: 42000000 },
  { month: 'Feb', shareholders: 218, shares: 43200, value: 43200000 },
  { month: 'Mar', shareholders: 225, shares: 44500, value: 44500000 },
  { month: 'Apr', shareholders: 230, shares: 45200, value: 45200000 },
  { month: 'May', shareholders: 238, shares: 45600, value: 45600000 },
  { month: 'Jun', shareholders: 247, shares: 45680, value: 45680000 },
];

const reports = [
  {
    id: 1,
    title: 'Monthly Shareholder Report',
    type: 'Operational',
    frequency: 'Monthly',
    lastGenerated: '2025-03-01',
    format: 'PDF',
    status: 'Current'
  },
  {
    id: 2,
    title: 'Dividend Performance Analysis',
    type: 'Financial',
    frequency: 'Quarterly',
    lastGenerated: '2024-12-31',
    format: 'Excel',
    status: 'Current'
  },
  {
    id: 3,
    title: 'Share Transaction Summary',
    type: 'Operational',
    frequency: 'Monthly',
    lastGenerated: '2025-03-01',
    format: 'PDF',
    status: 'Current'
  },
  {
    id: 4,
    title: 'Reserve Fund Status Report',
    type: 'Financial',
    frequency: 'Quarterly',
    lastGenerated: '2024-12-31',
    format: 'PDF',
    status: 'Current'
  },
  {
    id: 5,
    title: 'Annual Shareholder Report',
    type: 'Compliance',
    frequency: 'Annually',
    lastGenerated: '2024-12-31',
    format: 'PDF',
    status: 'Current'
  }
];

export function ReportsTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Reports & Analytics</CardTitle>
          <CardDescription>Generate and view SACCO financial and operational reports</CardDescription>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {/* Key Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Shareholder Growth & Share Value Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reportData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" label={{ value: 'Shareholders', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Total Value (Millions)', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="shareholders" fill="#C9A227" name="Total Shareholders" />
              <Bar yAxisId="right" dataKey="value" fill="#2D7A36" name="Total Value (M KES)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Available Reports */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Available Reports</CardTitle>
            </div>
            <Badge variant="outline">{reports.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-start gap-3 flex-1">
                <BarChart3 className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{report.title}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{report.type}</Badge>
                    <Badge variant="outline" className="text-xs">{report.frequency}</Badge>
                    <p className="text-xs text-gray-600">Last generated: {new Date(report.lastGenerated).toLocaleDateString('en-KE')}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Custom Report Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom Reports</CardTitle>
          <CardDescription>Build custom reports with selected parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="gap-2" variant="outline">
            <Plus className="h-4 w-4" />
            Create Custom Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
