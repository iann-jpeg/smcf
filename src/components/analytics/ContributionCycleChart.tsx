import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ContributionCycleChartProps {
  payments: any[];
  totalMembers: number;
}

const ContributionCycleChart = ({ payments, totalMembers }: ContributionCycleChartProps) => {
  // Group payments by cycle and calculate statistics
  const cycleMap = new Map();
  
  payments.forEach(payment => {
    if (payment.status === 'completed' && payment.cycle_number) {
      const cycle = payment.cycle_number;
      if (!cycleMap.has(cycle)) {
        cycleMap.set(cycle, {
          cycle: `Cycle ${cycle}`,
          paidCount: 0,
          totalAmount: 0,
          members: new Set(),
        });
      }
      const cycleData = cycleMap.get(cycle);
      cycleData.members.add(payment.member_id?._id || payment.member_id);
      cycleData.totalAmount += payment.amount || 0;
    }
  });

  // Convert to array and calculate percentages
  const chartData = Array.from(cycleMap.values())
    .map(item => ({
      cycle: item.cycle,
      paidMembers: item.members.size,
      totalAmount: item.totalAmount,
      completionRate: totalMembers > 0 ? Math.round((item.members.size / totalMembers) * 100) : 0,
    }))
    .sort((a, b) => {
      const cycleA = parseInt(a.cycle.replace('Cycle ', ''));
      const cycleB = parseInt(b.cycle.replace('Cycle ', ''));
      return cycleA - cycleB;
    })
    .slice(-6); // Last 6 cycles

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution Cycle Trends</CardTitle>
        <CardDescription>
          Payment patterns across recent cycles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cycle" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'totalAmount') return `KES ${value.toLocaleString()}`;
                if (name === 'completionRate') return `${value}%`;
                return value;
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="paidMembers" 
              stroke="#2563eb" 
              strokeWidth={2}
              name="Members Paid"
              dot={{ r: 4 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="completionRate" 
              stroke="#16a34a" 
              strokeWidth={2}
              name="Completion %"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ContributionCycleChart;
