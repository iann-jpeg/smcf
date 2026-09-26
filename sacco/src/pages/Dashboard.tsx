import { Users, Wallet, Landmark, TrendingUp, AlertTriangle, ShieldCheck, Clock, Percent, Bell, CheckCircle, XCircle, Info, Mail, UserPlus, FileText, CalendarCheck, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

function formatKES(amount: number) {
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `KES ${(amount / 1_000).toFixed(1)}K`;
  return `KES ${amount.toLocaleString()}`;
}

const typeIcon = { approval: CheckCircle, rejection: XCircle, info: Info };
const typeColor: Record<string, string> = { approval: "text-green-600", rejection: "text-destructive", info: "text-blue-500" };

export default function Dashboard() {
  const { isStaff, roles, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  // Redirect regular members to their self-service portal
  if (!isStaff && roles.length > 0) {
    return <Navigate to="/my-account" replace />;
  }

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: notifications = [], isLoading: notifsLoading, unreadCount } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const navigate = useNavigate();

  const recentNotifs = notifications.slice(0, 5);

  const s = stats ?? {
    totalMembers: 0, totalSavings: 0, totalShares: 0, totalLoans: 0,
    activeLoans: 0, availableLiquidity: 0,
    liquidityRatio: 0, par30: 0, defaultRate: 0, capitalAdequacy: 0,
    pendingApprovals: 0, recentTransactions: [],
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">SMCF command centre</p>
          <h1 className="mt-2 text-3xl font-heading font-bold tracking-tight">Good evening, Admin</h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s what&apos;s happening across SMCF.</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{new Intl.DateTimeFormat("en-KE", { dateStyle: "full" }).format(new Date())}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link to="/members"><UserPlus className="mr-2 h-4 w-4" /> Add Member</Link></Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/cycle-admin")}><CalendarCheck className="mr-2 h-4 w-4" /> Manage Cycles</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/accounts?tab=wallet")}><Wallet className="mr-2 h-4 w-4" /> Wallets</Button>
          <Button asChild size="sm" variant="outline"><Link to="/reports"><FileText className="mr-2 h-4 w-4" /> Reports</Link></Button>
        </div>
      </div>

      <section aria-labelledby="financial-position-heading" className="space-y-3">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Financial position</p><h2 id="financial-position-heading" className="text-xl font-heading font-bold">At a glance</h2></div><Button asChild variant="ghost" size="sm"><Link to="/accounts">Open ledger <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <StatCard title="Total Members" value={s.totalMembers.toLocaleString()} icon={Users} />
            <StatCard title="Total Savings" value={formatKES(s.totalSavings)} icon={Wallet} variant="success" subtitle={s.totalShares > 0 ? `Shares: ${formatKES(s.totalShares)}` : undefined} />
            <StatCard title="Active Loans" value={s.activeLoans.toLocaleString()} icon={Landmark} variant="accent" subtitle={`Portfolio: ${formatKES(s.totalLoans)}`} />
            <StatCard title="Share Capital" value={formatKES(s.totalShares)} icon={Percent} variant="success" />
            <StatCard title="Available Liquidity" value={formatKES(s.availableLiquidity)} icon={TrendingUp} variant={s.liquidityRatio < 25 ? "destructive" : "default"} subtitle={`Ratio: ${s.liquidityRatio}%`} />
            <StatCard title="Needs Attention" value={s.pendingApprovals.toLocaleString()} icon={Clock} variant="warning" subtitle="Pending approvals" />
          </>
        )}
      </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <StatCard title="PAR 30" value={`${s.par30}%`} icon={AlertTriangle} variant={s.par30 > 5 ? "warning" : "success"} subtitle="Portfolio at Risk" />
            <StatCard title="Default Rate" value={`${s.defaultRate}%`} icon={ShieldCheck} variant={s.defaultRate > 3 ? "destructive" : "success"} />
            <StatCard title="Capital Adequacy" value={`${s.capitalAdequacy}%`} icon={Percent} variant="success" />
            <StatCard title="Pending Approvals" value={s.pendingApprovals.toString()} icon={Clock} variant="warning" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(s.recentTransactions as any[])?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
            ) : (
              (s.recentTransactions as any[])?.map((txn: any) => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{txn.type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(txn.processed_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">KES {Number(txn.amount).toLocaleString()}</p>
                    <Badge variant={txn.status === "completed" ? "default" : "destructive"} className="text-[10px]">
                      {txn.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card className="border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Needs Your Attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/loans/approvals" className="flex items-center justify-between rounded-lg border bg-background/70 p-3 transition hover:border-amber-400 hover:bg-background">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                <span className="text-sm font-medium">Loan Approvals</span>
              </div>
              <Badge variant="outline" className="text-lg font-bold">{s.pendingApprovals}</Badge>
            </Link>
            <Link to="/notifications" className="flex items-center justify-between rounded-lg border bg-background/70 p-3 transition hover:border-primary hover:bg-background">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Unread Alerts</span>
              </div>
              <Badge variant="outline" className="text-lg font-bold">{unreadCount}</Badge>
            </Link>
            <Link to="/cycle-admin" className="flex items-center justify-between rounded-lg border bg-background/70 p-3 transition hover:border-primary hover:bg-background"><div className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" /><span className="text-sm font-medium">Cycle operations</span></div><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></Link>
          </CardContent>
        </Card>

        {/* Admin Communications */}
        {isAdmin && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Admin Communications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Send broadcast emails to members and users, and review inbox activity.
              </p>
              <Button asChild size="sm" variant="default" className="w-full">
                <Link to="/admin-email">
                  Open Admin Communications →
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notifications Widget */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Recent Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-1">{unreadCount} unread</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={() => { markAllRead.mutate(); toast("All notifications marked as read"); }}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Mark all as read
              </button>
            )}
            <button onClick={() => navigate("/notifications")} className="text-xs text-primary hover:underline">
              View all
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/5 rounded" />
                  <Skeleton className="h-3 w-2/5 rounded" />
                </div>
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))
          ) : recentNotifs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notifications yet</p>
          ) : (
            recentNotifs.map((n: any) => {
              const Icon = typeIcon[n.type as keyof typeof typeIcon] ?? Info;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/60 transition-colors ${!n.read ? "bg-muted/40 -mx-2 px-2 rounded" : "-mx-2 px-2 rounded"}`}
                  onClick={() => {
                    if (!n.read) { markRead.mutate(n.id); toast("Notification marked as read", { description: n.title }); }
                    if (n.link) navigate(n.link);
                  }}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${typeColor[n.type] ?? "text-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
