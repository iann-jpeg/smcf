import { TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WalletPoint = { label?: string; date?: string; amount?: number; balance?: number };
type WalletSummaryVisualProps = { balance: number; history?: WalletPoint[]; title?: string };

export function WalletSummaryVisual({ balance, history = [], title = "Wallet summary" }: WalletSummaryVisualProps) {
  const chartData = history.map((point, index) => ({ label: point.label || point.date || `${index + 1}`, balance: Number(point.balance ?? point.amount ?? 0) }));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base font-heading"><Wallet className="h-4 w-4 text-emerald-600" />{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-2"><div><p className="text-xs text-muted-foreground">Available balance</p><p className="text-2xl font-bold">KES {balance.toLocaleString()}</p></div><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
        {chartData.length > 1 && <div className="h-24 w-full" aria-label="Wallet balance growth chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="wallet-growth" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="hsl(152 60% 40%)" stopOpacity={0.35} /><stop offset="95%" stopColor="hsl(152 60% 40%)" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="label" hide /><Tooltip formatter={(value: number) => [`KES ${value.toLocaleString()}`, "Balance"]} /><Area type="monotone" dataKey="balance" stroke="hsl(152 60% 40%)" fill="url(#wallet-growth)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>}
      </CardContent>
    </Card>
  );
}
