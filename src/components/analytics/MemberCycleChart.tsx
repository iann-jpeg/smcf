import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useEffect, useState } from 'react';
import { authService } from "@/lib/authService";
import API_BASE from "@/lib/api";

const MemberCycleChart = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMemberCycleData();
  }, []);

  const fetchMemberCycleData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payments`, {
        headers: authService.getAuthHeaders(),
      });
      
      const data = await response.json();
      
      // Handle both array response and object response
      const paymentsArray = Array.isArray(data) ? data : (data.success && data.data ? data.data : []);
      
      if (paymentsArray.length > 0) {
        const userData = authService.getUser();
        const userId = userData?._id || userData?.id;
        
        console.log('📊 Member Cycle Chart - User ID:', userId);
        console.log('📊 Total payments fetched:', paymentsArray.length);
        
        // Filter payments for this member only
        const memberPayments = paymentsArray.filter((payment: any) => {
          const paymentMemberId = payment.member_id?._id || payment.member_id;
          const matches = String(paymentMemberId) === String(userId) && payment.status === 'completed';
          return matches;
        });
        
        console.log('📊 Member payments found:', memberPayments.length);
        console.log('📊 Sample payment:', memberPayments[0]);

        // Group by cycle
        const cycleMap = new Map();
        
        memberPayments.forEach((payment: any) => {
          if (payment.cycle_number) {
            const cycle = payment.cycle_number;
            if (!cycleMap.has(cycle)) {
              cycleMap.set(cycle, {
                cycle: `Cycle ${cycle}`,
                amount: 0,
                payments: 0,
              });
            }
            const cycleData = cycleMap.get(cycle);
            cycleData.amount += payment.amount || 0;
            cycleData.payments += 1;
          }
        });

        // Convert to array and sort
        const processedData = Array.from(cycleMap.values())
          .map(item => ({
            cycle: item.cycle,
            amount: item.amount,
            payments: item.payments,
          }))
          .sort((a, b) => {
            const cycleA = parseInt(a.cycle.replace('Cycle ', ''));
            const cycleB = parseInt(b.cycle.replace('Cycle ', ''));
            return cycleA - cycleB;
          })
          .slice(-10); // Last 10 cycles

        console.log('📊 Processed cycle data:', processedData);
        setChartData(processedData);
      }
    } catch (error) {
      console.error("Error fetching member cycle data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading cycle data...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Contribution Trends</CardTitle>
          <CardDescription>Your payment patterns across cycles</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">No payment data available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Contribution Trends</CardTitle>
        <CardDescription>
          Your payment history across {chartData.length} cycles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="cycle" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              label={{ value: 'Amount (KES)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              label={{ value: 'Payments', angle: 90, position: 'insideRight' }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'amount') return [`KES ${value.toLocaleString()}`, 'Amount Paid'];
                if (name === 'payments') return [value, 'Number of Payments'];
                return [value, name];
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="amount" 
              stroke="#228B22" 
              strokeWidth={2}
              name="Amount Paid"
              dot={{ fill: '#228B22', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="payments" 
              stroke="#32CD32" 
              strokeWidth={2}
              name="Payments Count"
              dot={{ fill: '#32CD32', r: 4 }}
              activeDot={{ r: 6 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default MemberCycleChart;
