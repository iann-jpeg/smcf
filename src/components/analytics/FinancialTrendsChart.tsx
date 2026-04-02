import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useEffect, useState } from 'react';
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

interface ChartDataPoint {
  month: string;
  year: number;
  monthNumber: number;
  Savings: number;
  'Loans Disbursed': number;
  Repayments: number;
  rawSavings: number;
  rawLoans: number;
  rawRepayments: number;
}

interface SocketIOClient {
  on: (event: string, callback: (data: unknown) => void) => void;
  off: (event: string, callback: (data: unknown) => void) => void;
}

const FinancialTrendsChart = () => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch financial trends data
  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Fetching financial trends data...');
      
      const response = await fetch(`${API_BASE}/api/analytics/financial-trends?months=7`, {
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('📊 Financial trends response:', result);

      if (result.success && result.data) {
        setChartData(result.data);
        console.log('✅ Chart data updated:', result.data.length, 'months');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error fetching financial trends:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
      
      // Show empty data instead of sample data to make the issue obvious
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchFinancialData();

    // Set up Socket.IO listeners for real-time updates
    const socket = (window as Window & { socket?: SocketIOClient }).socket;
    if (socket) {
      console.log('📊 Setting up real-time chart updates...');
      
      // Listen for financial events that should trigger chart refresh
      const events = [
        'savingDeposit',
        'saving:new',
        'withdrawalApproved',
        'loanDisbursed',
        'loanPayment',
        'loanStatusUpdated',
        'payment:completed',
        'interestApplied'
      ];

      const handleFinancialUpdate = (data: unknown) => {
        console.log('💰 Financial update received, refreshing chart...', data);
        // Refresh chart data when financial transactions occur
        fetchFinancialData();
      };

      events.forEach(event => {
        socket.on(event, handleFinancialUpdate);
      });

      // Cleanup listeners on unmount
      return () => {
        events.forEach(event => {
          socket.off(event, handleFinancialUpdate);
        });
      };
    }
  }, []);

  // Auto-refresh every 2 minutes as a fallback
  useAutoRefresh({
    onRefresh: fetchFinancialData,
    refreshOnVisible: true,
    refreshOnFocus: true,
    debounceMs: 10000, // Don't refresh more than once per 10 seconds
    debug: false
  });

  const formatYAxis = (value: number) => {
    if (value === 0) return '0';
    if (value < 0.01) return '<0.01M';
    return `${value.toFixed(1)}M`;
  };

  const formatTooltip = (value: number, name: string) => {
    const valueInKES = value * 1000000;
    return [`KES ${valueInKES.toLocaleString()}`, name];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Trends</CardTitle>
          <CardDescription>
            Monthly overview of savings, loans, and repayments
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading financial data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Trends</CardTitle>
          <CardDescription>
            Monthly overview of savings, loans, and repayments
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <p className="text-sm text-destructive mb-2">Failed to load chart data</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button 
              onClick={fetchFinancialData}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Trends</CardTitle>
          <CardDescription>
            Monthly overview of savings, loans, and repayments
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No financial data available yet</p>
            <p className="text-xs text-muted-foreground mt-1">Data will appear as transactions are recorded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Trends</CardTitle>
        <CardDescription>
          Monthly overview of savings, loans, and repayments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart 
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#20c997" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#20c997" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorLoans" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffc107" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ffc107" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorRepayments" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6c757d" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6c757d" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" strokeOpacity={0.5} />
            <XAxis 
              dataKey="month" 
              stroke="#888"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              tickFormatter={formatYAxis}
              stroke="#888"
              style={{ fontSize: '12px' }}
            />
            <Tooltip 
              formatter={formatTooltip}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            <Legend 
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{
                fontSize: '13px',
                paddingTop: '10px',
              }}
            />
            <Area 
              type="monotone" 
              dataKey="Savings" 
              stackId="1"
              stroke="#20c997" 
              strokeWidth={2}
              fill="url(#colorSavings)"
            />
            <Area 
              type="monotone" 
              dataKey="Loans Disbursed" 
              stackId="1"
              stroke="#ffc107" 
              strokeWidth={2}
              fill="url(#colorLoans)"
            />
            <Area 
              type="monotone" 
              dataKey="Repayments" 
              stackId="1"
              stroke="#6c757d" 
              strokeWidth={2}
              fill="url(#colorRepayments)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default FinancialTrendsChart;
