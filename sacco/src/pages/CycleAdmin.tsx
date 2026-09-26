import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ArrowUpDown, CheckCircle2, Download, Landmark, ShieldCheck, TrendingUp, Wallet, Users, BarChart3, BellRing, LandmarkIcon, BadgeDollarSign } from "lucide-react";

function formatKES(value: number | string | undefined | null) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "KES 0";
  if (numeric >= 1_000_000) return `KES ${(numeric / 1_000_000).toFixed(1)}M`;
  if (numeric >= 1_000) return `KES ${(numeric / 1_000).toFixed(1)}K`;
  return `KES ${numeric.toLocaleString()}`;
}

export default function CycleAdmin() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole("admin");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [members, setMembers] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [feeSummary, setFeeSummary] = useState<any>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("overview");

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const [memberRes, savingsRes, withdrawalRes, feeRes, txRes] = await Promise.all([
          api.get("/members").catch(() => ({ data: [] })),
          api.get("/dashboard/stats").catch(() => ({})),
          api.get("/savings/admin/pending-withdrawals").catch(() => ({ data: [] })),
          api.get("/savings/admin/fees/summary").catch(() => ({ data: {} })),
          api.get("/transactions").catch(() => ({ data: [] })),
        ]);

        if (ignore) return;

        const memberList = Array.isArray((memberRes as any)?.data) ? (memberRes as any).data : Array.isArray(memberRes) ? memberRes : [];
        const walletStats = (savingsRes as any)?.data ?? savingsRes ?? {};
        const pending = Array.isArray((withdrawalRes as any)?.data) ? (withdrawalRes as any).data : Array.isArray(withdrawalRes) ? withdrawalRes : [];
        const fees = (feeRes as any)?.data ?? feeRes ?? {};
        const txList = Array.isArray((txRes as any)?.data) ? (txRes as any).data : Array.isArray(txRes) ? txRes : [];

        setMembers(memberList);
        setStats({
          totalMembers: walletStats.totalMembers ?? memberList.length ?? 0,
          totalSavings: walletStats.totalSavings ?? 0,
          totalShares: walletStats.totalShares ?? 0,
          totalLoans: walletStats.totalLoanBalance ?? 0,
          activeLoans: walletStats.activeLoans ?? 0,
          availableLiquidity: walletStats.availableLiquidity ?? 0,
          pendingApprovals: walletStats.pendingLoans ?? 0,
          defaultRate: walletStats.defaultRate ?? 0,
          par30: walletStats.par30 ?? 0,
          capitalAdequacy: walletStats.capitalAdequacy ?? 0,
        });
        setPendingWithdrawals(pending);
        setFeeSummary(fees);
        setTransactions(txList.slice(0, 8));
      } catch (error) {
        console.error("Failed to load cycle admin data", error);
        toast({ title: "Unable to load admin data", description: "Some cycle admin data could not be fetched.", variant: "destructive" });
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => { ignore = true; };
  }, [isAdmin, toast]);

  const overview = useMemo(() => {
    const totalMembers = members.length || Number(stats.totalMembers || 0);
    const paidMembers = members.filter((m) => m.registrationFeePaid || m.status === "active").length;
    const totalSavings = Number(stats.totalSavings || 0);
    const totalPortfolio = Number(stats.totalLoans || 0);
    const pendingApprovals = Number(stats.pendingApprovals || pendingWithdrawals.length || 0);
    return { totalMembers, paidMembers, totalSavings, totalPortfolio, pendingApprovals };
  }, [members, stats, pendingWithdrawals]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><ShieldCheck className="h-5 w-5" /> Access restricted</CardTitle>
            <CardDescription>You need admin access to view the Cycle Admin dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cycle Admin</h1>
          <p className="text-sm text-muted-foreground">Consolidated operational controls previously spread across the old cycle admin.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Export report</Button>
          <Button variant="default" size="sm">Sync data</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Members" value={overview.totalMembers.toLocaleString()} icon={Users} change={`${overview.paidMembers} active`} tone="default" />
        <StatCard title="Savings pool" value={formatKES(overview.totalSavings)} icon={Wallet} change="Cycle reserves" tone="success" />
        <StatCard title="Loan portfolio" value={formatKES(overview.totalPortfolio)} icon={LandmarkIcon} change="Active + closed" tone="accent" />
        <StatCard title="Pending approvals" value={String(overview.pendingApprovals)} icon={BellRing} change="Withdrawals / actions" tone="warning" />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Financial snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MetricRow label="Collections" value={formatKES(feeSummary?.totalAmount || 0)} />
                  <MetricRow label="Fee summary" value={feeSummary?.totalFees ? `${feeSummary.totalFees}` : "0"} />
                  <MetricRow label="Liquidity" value={formatKES(stats.availableLiquidity || 0)} />
                  <MetricRow label="Default rate" value={`${Number(stats.defaultRate || 0).toFixed(1)}%`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Cycle status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusRow label="Member activity" value={`${overview.paidMembers}/${overview.totalMembers}`} />
                <StatusRow label="Savings coverage" value={`${Math.min(100, Math.round((overview.totalSavings / Math.max(1, overview.totalPortfolio || overview.totalSavings)) * 100))}%`} />
                <StatusRow label="Approvals" value={String(overview.pendingApprovals)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ArrowUpDown className="h-4 w-4" /> Recent payment activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent transactions available.</p>
                ) : (
                  transactions.map((item, index) => (
                    <div key={item.id || index} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{item.type || "Payment"}</p>
                        <p className="text-xs text-muted-foreground">{item.memberName || item.member || "Member"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatKES(item.amount || 0)}</p>
                        <Badge variant={item.status === "completed" ? "default" : "secondary"}>{item.status || "processed"}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Savings & reserve overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetricRow label="Savings pool" value={formatKES(stats.totalSavings || 0)} />
              <MetricRow label="Available liquidity" value={formatKES(stats.availableLiquidity || 0)} />
              <MetricRow label="Share capital" value={formatKES(stats.totalShares || 0)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Approvals queue</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingWithdrawals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending approvals in the queue.</p>
              ) : (
                <div className="space-y-3">
                  {pendingWithdrawals.slice(0, 5).map((item, index) => (
                    <div key={item.id || index} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{item.memberName || item.member || "Member"}</p>
                        <p className="text-xs text-muted-foreground">{item.reason || "Withdrawal request"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatKES(item.amount || item.total || 0)}</p>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4" /> Financial performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricRow label="Loan balance" value={formatKES(stats.totalLoans || 0)} />
                <MetricRow label="PAR 30" value={`${Number(stats.par30 || 0).toFixed(1)}%`} />
                <MetricRow label="Capital adequacy" value={`${Number(stats.capitalAdequacy || 0).toFixed(1)}%`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Compliance watch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricRow label="Default rate" value={`${Number(stats.defaultRate || 0).toFixed(1)}%`} />
                <MetricRow label="Total approvals" value={String(overview.pendingApprovals)} />
                <MetricRow label="Members tracked" value={String(overview.totalMembers)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Loading cycle admin data…
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, change, tone = "default" }: {
  title: string;
  value: string;
  icon: any;
  change?: string;
  tone?: "default" | "success" | "accent" | "warning";
}) {
  const toneClasses = {
    default: "border-border bg-background",
    success: "border-emerald-600/20 bg-emerald-500/5",
    accent: "border-primary/15 bg-primary/5",
    warning: "border-amber-600/20 bg-amber-500/5",
  }[tone];

  return (
    <Card className={toneClasses}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && <p className="mt-2 text-xs text-muted-foreground">{change}</p>}
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
