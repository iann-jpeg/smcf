import { useQuery } from "@tanstack/react-query";
import { Users, Wallet, Landmark, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { getPublicTransparency } from "@/lib/api";

const money = (value: number) => `KES ${value.toLocaleString()}`;

export default function Transparency() {
  const { data, isLoading, error } = useQuery({ queryKey: ["public-transparency"], queryFn: getPublicTransparency, staleTime: 5 * 60_000 });
  return <main className="min-h-screen bg-background px-4 py-10 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-8">
      <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">SMCF SACCO</p><h1 className="mt-2 text-3xl font-heading font-bold">Public transparency</h1><p className="mt-2 max-w-2xl text-muted-foreground">A high-level view of our cooperative activity, published without personal or transaction-level information.</p></header>
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        : error || !data ? <EmptyState title="Metrics unavailable" description="Please try again later." />
        : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Active members" value={data.memberCount.toLocaleString()} icon={Users} />
          <Metric title="Savings held" value={money(data.totalSavings)} icon={Wallet} />
          <Metric title="Active loans" value={data.activeLoanCount.toLocaleString()} icon={Landmark} />
          <Metric title="Completed transactions" value={data.completedTransactionCount.toLocaleString()} icon={Activity} />
        </div><Card><CardHeader><CardTitle className="text-base">About these figures</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground"><p>{data.disclaimer}</p><p className="mt-2 text-xs">Updated {new Date(data.asOf).toLocaleString("en-KE")}</p></CardContent></Card></>}
    </div>
  </main>;
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Users }) {
  return <Card><CardContent className="flex items-center gap-3 p-5"><Icon className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-xl font-bold">{value}</p></div></CardContent></Card>;
}
