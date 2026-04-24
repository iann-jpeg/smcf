import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, TrendingUp, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import API_BASE from "@/lib/api";

interface ReserveBalance {
  current_balance: number;
  health_score: number;
  loan_coverage_ratio: number;
  is_locked: boolean;
  lock_reason?: string;
}

interface ReserveTransaction {
  _id: string;
  type: "credit" | "debit";
  amount: number;
  source: string;
  description: string;
  created_at: string;
}

export default function ReserveBalanceCard() {
  const [balance, setBalance] = useState<ReserveBalance | null>(null);
  const [transactions, setTransactions] = useState<ReserveTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReserveData();
  }, []);

  const fetchReserveData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [balanceRes, transactionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/reserve/balance`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }),
        fetch(`${API_BASE}/api/reserve/transactions/public`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }),
      ]);

      if (!balanceRes.ok || !transactionsRes.ok) {
        throw new Error("Failed to fetch reserve data");
      }

      const balanceData = await balanceRes.json();
      const transactionsData = await transactionsRes.json();

      setBalance(balanceData);
      setTransactions(transactionsData.transactions || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load reserve data");
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-600">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-600">Good</Badge>;
    if (score >= 40) return <Badge className="bg-orange-600">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  const formatSource = (source: string) => {
    return source
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Group Reserve Account
          </CardTitle>
          <CardDescription>Loading reserve information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-20 bg-muted animate-pulse rounded-md" />
            <div className="h-20 bg-muted animate-pulse rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !balance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Group Reserve Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Failed to load reserve data"}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Group Reserve Account
          {balance.is_locked && (
            <Badge variant="destructive" className="ml-auto">
              Locked
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Our collective safety net for emergencies and group sustainability
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {balance.is_locked && balance.lock_reason && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Reserve Locked:</strong> {balance.lock_reason}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Current Balance
                </p>
                <p className="text-3xl font-bold">KES {balance.current_balance.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  Available for group emergencies and approved expenses
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Health Score
                </p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-3xl font-bold ${getHealthColor(balance.health_score)}`}>
                    {balance.health_score.toFixed(0)}
                  </p>
                  <span className="text-muted-foreground">/100</span>
                  {getHealthBadge(balance.health_score)}
                </div>
                <Progress value={balance.health_score} className="h-2" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Loan Coverage Ratio</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold">
                  {(balance.loan_coverage_ratio * 100).toFixed(1)}%
                </p>
                <span className="text-xs text-muted-foreground">
                  of outstanding loans covered by reserves
                </span>
              </div>
              <Progress value={balance.loan_coverage_ratio * 100} className="h-2" />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>What is the Reserve Account?</strong>
                <br />
                The Group Reserve Account is our collective fund that automatically accumulates
                from various sources including early withdrawal penalties, loan interest, and
                transaction fees. It serves as a safety net to cover loan defaults, support
                emergency situations, and ensure the long-term sustainability of our group.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">How Reserves Grow:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Early withdrawal penalties from locked deposits</li>
                <li>Portion of loan interest (97% to reserve, 3% operational)</li>
                <li>Loan default penalties and recovered amounts</li>
                <li>Transaction fees from withdrawals</li>
                <li>Monthly cycle contributions (KES 20 per member)</li>
                <li>System fees from various operations</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recent Transactions</h4>
              <p className="text-xs text-muted-foreground">
                Latest contributions to the group reserve
              </p>
            </div>

            {transactions.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>No recent transactions</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 10).map((txn) => (
                  <div
                    key={txn._id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSource(txn.source)} •{" "}
                        {new Date(txn.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          txn.type === "credit" ? "text-green-600" : "text-red-600"
                        }`}>
                        {txn.type === "credit" ? "+" : "-"}
                        KES {txn.amount.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {txn.type === "credit" ? "Credit" : "Debit"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Only administrators can withdraw from the reserve account. All withdrawals require
                proper justification and are subject to monthly limits.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
