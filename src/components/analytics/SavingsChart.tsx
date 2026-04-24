import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SavingsChartProps {
  data: any[];
}

const SavingsChart = ({ data }: SavingsChartProps) => {
  // Prepare data for the chart - top 10 savers by total deposits
  const chartData = data
    .sort((a, b) => (b.totalDeposits || 0) - (a.totalDeposits || 0))
    .slice(0, 10)
    .map(member => ({
      name: member.name || 'Unknown',
      balance: member.currentBalance || 0,
      deposits: member.totalDeposits || 0,
      interest: member.totalInterestEarned || 0,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Savers</CardTitle>
        <CardDescription>
          Members ranked by total deposits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
            />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => `KES ${value.toLocaleString()}`}
            />
            <Legend />
            <Bar dataKey="balance" fill="#2563eb" name="Current Balance" />
            <Bar dataKey="deposits" fill="#16a34a" name="Total Deposits" />
            <Bar dataKey="interest" fill="#f59e0b" name="Interest Earned" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SavingsChart;
