import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  TrendingUp, 
  ArrowRightLeft, 
  Download, 
  Upload,
  RefreshCw,
  Calendar,
  Users
} from "lucide-react";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

const TransactionFeesReport = () => {
  const [loading, setLoading] = useState(true);
  const [feeSummary, setFeeSummary] = useState<any>(null);
  const [feesList, setFeesList] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchFeeData();
  }, []);

  const fetchFeeData = async () => {
    setLoading(true);
    try {
      // Fetch summary
      const summaryRes = await fetch(`${API_BASE}/api/savings/admin/fees/summary`, {
        headers: authService.getAuthHeaders(),
      });
      const summaryData = await summaryRes.json();

      if (summaryData.success) {
        setFeeSummary(summaryData.data);
      }

      // Fetch recent fees list
      const feesRes = await fetch(`${API_BASE}/api/savings/admin/fees?limit=50`, {
        headers: authService.getAuthHeaders(),
      });
      const feesData = await feesRes.json();

      if (feesData.success) {
        setFeesList(feesData.data.fees || []);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch fee data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFeeTypeColor = (type: string) => {
    switch (type) {
      case "transfer":
        return "bg-blue-100 text-blue-800";
      case "top_up":
        return "bg-green-100 text-green-800";
      case "withdrawal":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getFeeTypeIcon = (type: string) => {
    switch (type) {
      case "transfer":
        return <ArrowRightLeft className="w-4 h-4" />;
      case "top_up":
        return <Upload className="w-4 h-4" />;
      case "withdrawal":
        return <Download className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transaction Fees Report</h2>
          <p className="text-muted-foreground">
            Track all fees collected from member transactions
          </p>
        </div>
        <Button onClick={fetchFeeData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Fees Collected */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Fees Collected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">
              KES {feeSummary?.totalCollected?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {feeSummary?.totalTransactions || 0} transactions
            </p>
          </CardContent>
        </Card>

        {/* Transfer Fees */}
        {feeSummary?.feesByType?.map((item: any) => item._id === "transfer" && (
          <Card key={item._id} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Transfer Fees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                KES {item.total?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.count} transfers • Avg: KES {item.avg?.toFixed(2) || 0}
              </p>
            </CardContent>
          </Card>
        ))}

        {/* Top-Up Fees */}
        {feeSummary?.feesByType?.map((item: any) => item._id === "top_up" && (
          <Card key={item._id} className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Top-Up Fees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">
                KES {item.total?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.count} top-ups • Avg: KES {item.avg?.toFixed(2) || 0}
              </p>
            </CardContent>
          </Card>
        ))}

        {/* Withdrawal Fees */}
        {feeSummary?.feesByType?.map((item: any) => item._id === "withdrawal" && (
          <Card key={item._id} className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Withdrawal Fees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                KES {item.total?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.count} withdrawals • Avg: KES {item.avg?.toFixed(2) || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fee Tariff Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            2026 Fee Tariff Chart
          </CardTitle>
          <CardDescription>
            Current fee structure for all transaction types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Transfer Fees */}
            <div>
              <h4 className="font-semibold mb-3 text-blue-700">Wallet Transfers</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>KES 1 - 99</span><span className="font-semibold text-green-600">Free</span></div>
                <div className="flex justify-between"><span>KES 100 - 499</span><span className="font-semibold">KES 5</span></div>
                <div className="flex justify-between"><span>KES 500 - 999</span><span className="font-semibold">KES 10</span></div>
                <div className="flex justify-between"><span>KES 1,000 - 1,999</span><span className="font-semibold">KES 20</span></div>
                <div className="flex justify-between"><span>KES 2,000 - 4,999</span><span className="font-semibold">KES 30</span></div>
                <div className="flex justify-between"><span>KES 5,000 - 9,999</span><span className="font-semibold">KES 40</span></div>
                <div className="flex justify-between"><span>KES 10,000 - 19,999</span><span className="font-semibold">KES 50</span></div>
                <div className="flex justify-between"><span>KES 20,000 - 49,999</span><span className="font-semibold">KES 70</span></div>
                <div className="flex justify-between"><span>KES 50,000 - 100,000</span><span className="font-semibold">KES 100</span></div>
              </div>
            </div>

            {/* Top-Up Fees */}
            <div>
              <h4 className="font-semibold mb-3 text-emerald-700">Wallet Top-Up</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Direct Deposit</span><span className="font-semibold text-green-600">Free</span></div>
                <div className="flex justify-between"><span>STK Push</span><span className="font-semibold">KES 5</span></div>
                <div className="flex justify-between"><span>M-Pesa</span><span className="font-semibold">KES 5</span></div>
              </div>
            </div>

            {/* Withdrawal Fees */}
            <div>
              <h4 className="font-semibold mb-3 text-orange-700">Withdrawals</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>KES 1 - 100</span><span className="font-semibold">KES 15</span></div>
                <div className="flex justify-between"><span>KES 101 - 500</span><span className="font-semibold">KES 18</span></div>
                <div className="flex justify-between"><span>KES 501 - 1,000</span><span className="font-semibold">KES 30</span></div>
                <div className="flex justify-between"><span>KES 1,001 - 2,500</span><span className="font-semibold">KES 38</span></div>
                <div className="flex justify-between"><span>KES 2,501 - 5,000</span><span className="font-semibold">KES 95</span></div>
                <div className="flex justify-between"><span>KES 5,001 - 10,000</span><span className="font-semibold">KES 145</span></div>
                <div className="flex justify-between"><span>KES 10,001 - 20,000</span><span className="font-semibold">KES 235</span></div>
                <div className="flex justify-between"><span>KES 20,001 - 50,000</span><span className="font-semibold">KES 350</span></div>
                <div className="flex justify-between"><span>KES 50,001 - 100,000</span><span className="font-semibold">KES 385</span></div>
              </div>
            </div>
                <div className="flex justify-between"><span>KES 50,000 - 100,000</span><span className="font-semibold">KES 80</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Fees List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent Transaction Fees
          </CardTitle>
          <CardDescription>
            Latest 50 fees collected from member transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {feesList.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No fees collected yet
              </div>
            ) : (
              feesList.map((fee) => (
                <div
                  key={fee._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getFeeTypeColor(fee.transaction_type)}`}>
                      {getFeeTypeIcon(fee.transaction_type)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {fee.member_id?.name || "Unknown Member"}
                        {fee.recipient_id && (
                          <span className="text-sm text-muted-foreground">
                            {" → "}{fee.recipient_id.name}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {fee.fee_description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(fee.created_at).toLocaleString()} • 
                        Member ID: {fee.member_id?.member_id || "N/A"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-700">
                      +KES {fee.fee_amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Amount: KES {fee.transaction_amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionFeesReport;
