import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface LoansChartProps {
  loans: any[];
}

const LoansChart = ({ loans }: LoansChartProps) => {
  // Count loans by status
  const statusCounts = {
    pending: loans.filter(l => l.status === 'pending').length,
    approved: loans.filter(l => l.status === 'approved').length,
    rejected: loans.filter(l => l.status === 'rejected').length,
    disbursed: loans.filter(l => l.status === 'disbursed').length,
    repaid: loans.filter(l => l.status === 'repaid').length,
  };

  const chartData = [
    { name: 'Pending', value: statusCounts.pending, color: '#f59e0b' },
    { name: 'Approved', value: statusCounts.approved, color: '#3b82f6' },
    { name: 'Rejected', value: statusCounts.rejected, color: '#ef4444' },
    { name: 'Disbursed', value: statusCounts.disbursed, color: '#8b5cf6' },
    { name: 'Repaid', value: statusCounts.repaid, color: '#10b981' },
  ].filter(item => item.value > 0); // Only show non-zero values

  // Calculate totals
  const totalLoans = loans.length;
  const totalAmount = loans.reduce((sum, loan) => sum + (loan.amount || 0), 0);
  const totalDisbursed = loans
    .filter(l => l.status === 'disbursed' || l.status === 'repaid')
    .reduce((sum, loan) => sum + (loan.amount || 0), 0);
  const totalRepaid = loans
    .filter(l => l.status === 'repaid')
    .reduce((sum, loan) => sum + (loan.amount || 0), 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} loan{payload[0].value !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            {((payload[0].value / totalLoans) * 100).toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loan Status Distribution</CardTitle>
          <CardDescription>
            Overview of loan applications by status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No loan data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Loan Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLoans}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {totalAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all loans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Disbursed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              KES {totalDisbursed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Given to members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Repaid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              KES {totalRepaid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Paid back + interest
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoansChart;
