import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  exportDetailedIncomeStatement,
  exportDetailedBalanceSheet,
  exportDetailedCashFlow,
  exportFinancialReportPack,
} from "@/lib/pdf-export";
import { useAuth } from "@/hooks/useAuth";

type PeriodType = "monthly" | "quarterly" | "yearly" | "custom";

type StatementType = "income_statement" | "balance_sheet" | "cash_flow_statement";

type StatementPreview = {
  statementType: StatementType;
  period: {
    periodType: PeriodType;
    periodLabel: string;
    startDate: string;
    endDate: string;
  };
  lines: Record<string, number>;
  summary: Record<string, number | string | boolean>;
  comparison: Record<string, unknown>;
  trend: Array<Record<string, unknown>>;
  validation: {
    isValid: boolean;
    warnings: string[];
    requiresOverride: boolean;
  };
  adjustmentsApplied: Array<{ _id: string; lineKey: string; amount: number; note: string }>;
};

type ReportPackPreview = {
  period: StatementPreview["period"];
  income: StatementPreview;
  balance: StatementPreview;
  cash: StatementPreview;
  validation: {
    isValid: boolean;
    warnings: string[];
    requiresOverride: boolean;
  };
};

const statementTitles: Record<StatementType, string> = {
  income_statement: "Income Statement",
  balance_sheet: "Balance Sheet",
  cash_flow_statement: "Cash Flow Statement",
};

const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});

function buildQueryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
}

function amountCell(value: unknown) {
  if (typeof value === "number") return KES.format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "-");
}

function rowTitle(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roles } = useAuth();

  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);
  const [customStart, setCustomStart] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notesToAccounts, setNotesToAccounts] = useState<string>("");
  const [allowOverride, setAllowOverride] = useState<boolean>(false);
  const [allowVersioning, setAllowVersioning] = useState<boolean>(false);
  const [adjustmentLineKey, setAdjustmentLineKey] = useState<string>("otherApprovedExpenses");
  const [adjustmentTarget, setAdjustmentTarget] = useState<"income_statement" | "balance_sheet" | "cash_flow_statement" | "all">("all");
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>("");
  const [adjustmentNote, setAdjustmentNote] = useState<string>("");
  const [mappingsJson, setMappingsJson] = useState<string>("");

  const canApprove = roles.includes("admin") || roles.includes("auditor") || roles.includes("treasurer");
  const canLock = roles.includes("admin") || roles.includes("treasurer") || roles.includes("auditor");
  const canUnlock = roles.includes("admin");
  const canAdjust = roles.includes("admin") || roles.includes("treasurer");
  const canManageMappings = roles.includes("admin") || roles.includes("auditor");

  const periodParams = useMemo(() => {
    const base: Record<string, string | number | undefined> = {
      periodType,
      year,
      month,
      quarter,
      startDate: customStart,
      endDate: customEnd,
    };

    if (periodType === "monthly") {
      return { periodType, year, month };
    }
    if (periodType === "quarterly") {
      return { periodType, year, quarter };
    }
    if (periodType === "yearly") {
      return { periodType, year };
    }
    return { periodType, startDate: base.startDate, endDate: base.endDate };
  }, [periodType, year, month, quarter, customStart, customEnd]);

  const periodSignature = useMemo(() => JSON.stringify(periodParams), [periodParams]);

  const financialQueryOptions = {
    retry: 1,
    refetchOnWindowFocus: false,
  } as const;

  const overviewQuery = useQuery({
    queryKey: ["financial-statements", "overview", periodSignature],
    queryFn: async () => {
      const q = buildQueryString(periodParams);
      return api.get(`/financial-statements/overview?${q}`) as Promise<any>;
    },
    ...financialQueryOptions,
  });

  const incomeQuery = useQuery({
    queryKey: ["financial-statements", "income", periodSignature],
    queryFn: async () => {
      const q = buildQueryString(periodParams);
      return api.get(`/financial-statements/income_statement/preview?${q}`) as Promise<StatementPreview>;
    },
    ...financialQueryOptions,
  });

  const balanceQuery = useQuery({
    queryKey: ["financial-statements", "balance", periodSignature],
    queryFn: async () => {
      const q = buildQueryString(periodParams);
      return api.get(`/financial-statements/balance_sheet/preview?${q}`) as Promise<StatementPreview>;
    },
    ...financialQueryOptions,
  });

  const cashQuery = useQuery({
    queryKey: ["financial-statements", "cash", periodSignature],
    queryFn: async () => {
      const q = buildQueryString(periodParams);
      return api.get(`/financial-statements/cash_flow_statement/preview?${q}`) as Promise<StatementPreview>;
    },
    ...financialQueryOptions,
  });

  const reportPackQuery = useQuery({
    queryKey: ["financial-statements", "report-pack", periodSignature],
    queryFn: async () => {
      const q = buildQueryString(periodParams);
      return api.get(`/financial-statements/report-pack/preview?${q}`) as Promise<ReportPackPreview>;
    },
    ...financialQueryOptions,
  });

  const historyQuery = useQuery({
    queryKey: ["financial-statements", "history"],
    queryFn: async () => api.get("/financial-statements/history/list") as Promise<any[]>,
    ...financialQueryOptions,
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["financial-statements", "adjustments"],
    queryFn: async () => api.get("/financial-statements/adjustments/list") as Promise<any[]>,
    ...financialQueryOptions,
  });

  const mappingsQuery = useQuery({
    queryKey: ["financial-statements", "mappings"],
    queryFn: async () => api.get("/financial-statements/mappings/list") as Promise<{ mappings: any[]; missing: string[] }>,
    ...financialQueryOptions,
  });

  const auditLogQuery = useQuery({
    queryKey: ["financial-statements", "audit-log"],
    queryFn: async () => api.get("/financial-statements/audit-log/list") as Promise<any[]>,
    ...financialQueryOptions,
  });

  const generateMutation = useMutation({
    mutationFn: async (statementType: StatementType) => {
      return api.post(`/financial-statements/${statementType}/generate`, {
        ...periodParams,
        allowOverride,
        allowVersioning,
        notesToAccounts,
      });
    },
    onSuccess: () => {
      toast({ title: "Statement generated", description: "Statement snapshot was stored in history." });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "history"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveStatementMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/financial-statements/history/${id}/approve`, {}),
    onSuccess: () => {
      toast({ title: "Statement approved" });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "history"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
    },
  });

  const lockStatementMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/financial-statements/history/${id}/lock`, {}),
    onSuccess: () => {
      toast({ title: "Statement locked" });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "history"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
    },
  });

  const unlockStatementMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/financial-statements/history/${id}/unlock`, {}),
    onSuccess: () => {
      toast({ title: "Statement unlocked" });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "history"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
    },
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(adjustmentAmount);
      if (!Number.isFinite(amount) || amount === 0) {
        throw new Error("Adjustment amount must be non-zero.");
      }
      if (!adjustmentNote.trim()) {
        throw new Error("Adjustment note is required.");
      }

      return api.post("/financial-statements/adjustments", {
        ...periodParams,
        targetStatement: adjustmentTarget,
        lineKey: adjustmentLineKey,
        category: adjustmentLineKey,
        amount,
        note: adjustmentNote,
      });
    },
    onSuccess: () => {
      toast({ title: "Adjustment submitted" });
      setAdjustmentAmount("");
      setAdjustmentNote("");
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "income", periodSignature] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "balance", periodSignature] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "cash", periodSignature] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not submit adjustment", description: error.message, variant: "destructive" });
    },
  });

  const approveAdjustmentMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/financial-statements/adjustments/${id}/approve`, {}),
    onSuccess: () => {
      toast({ title: "Adjustment approved" });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "income", periodSignature] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "balance", periodSignature] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "cash", periodSignature] });
    },
  });

  const rejectAdjustmentMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/financial-statements/adjustments/${id}/reject`, {}),
    onSuccess: () => {
      toast({ title: "Adjustment rejected" });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
    },
  });

  const updateMappingsMutation = useMutation({
    mutationFn: async () => {
      if (!mappingsJson.trim()) {
        throw new Error("Mappings JSON is empty.");
      }
      const parsed = JSON.parse(mappingsJson);
      return api.put("/financial-statements/mappings", { mappings: parsed });
    },
    onSuccess: () => {
      toast({ title: "Mappings updated" });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "mappings"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statements", "audit-log"] });
    },
    onError: (error: Error) => {
      toast({ title: "Mapping update failed", description: error.message, variant: "destructive" });
    },
  });

  const loading =
    overviewQuery.isLoading ||
    incomeQuery.isLoading ||
    balanceQuery.isLoading ||
    cashQuery.isLoading ||
    reportPackQuery.isLoading;

  const criticalQueryErrors = [overviewQuery, incomeQuery, balanceQuery, cashQuery, reportPackQuery]
    .map((q) => q.error)
    .filter(Boolean) as Error[];

  const income = incomeQuery.data;
  const balance = balanceQuery.data;
  const cash = cashQuery.data;

  const allWarnings = useMemo(() => {
    const warningSet = new Set<string>();
    [income, balance, cash].forEach((statement) => {
      statement?.validation?.warnings?.forEach((w) => warningSet.add(w));
    });
    return Array.from(warningSet);
  }, [income, balance, cash]);

  const canExportIncome = Boolean(income);
  const canExportBalance = Boolean(balance);
  const canExportCash = Boolean(cash);
  const canExportReportPack = Boolean(reportPackQuery.data && income && balance && cash);

  const onExportIncome = () => {
    if (!income) {
      toast({
        title: "Income statement not ready",
        description: "Wait for the preview data to load, then try exporting again.",
        variant: "destructive",
      });
      return;
    }
    exportDetailedIncomeStatement(income);
  };

  const onExportBalance = () => {
    if (!balance) {
      toast({
        title: "Balance sheet not ready",
        description: "Wait for the preview data to load, then try exporting again.",
        variant: "destructive",
      });
      return;
    }
    exportDetailedBalanceSheet(balance);
  };

  const onExportCash = () => {
    if (!cash) {
      toast({
        title: "Cash flow statement not ready",
        description: "Wait for the preview data to load, then try exporting again.",
        variant: "destructive",
      });
      return;
    }
    exportDetailedCashFlow(cash);
  };

  const onExportReportPack = () => {
    if (!reportPackQuery.data || !income || !balance || !cash) {
      toast({
        title: "Report pack not ready",
        description: "Required financial previews are still loading. Try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    if (!reportPackQuery.data.validation.isValid && !allowOverride) {
      toast({
        title: "Report pack blocked",
        description: "Validation warnings exist. Enable override to export anyway.",
        variant: "destructive",
      });
      return;
    }

    exportFinancialReportPack({
      periodLabel: reportPackQuery.data.period?.periodLabel || "Selected Period",
      income,
      balance,
      cash,
      notesToAccounts,
    });
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Financial Statements</h1>
        <p className="text-muted-foreground text-sm">
          Income Statement, Balance Sheet, Cash Flow Statement, validation, history, and export workflows for SACCO admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporting Period</CardTitle>
          <CardDescription>Select monthly, quarterly, yearly, or custom dates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label htmlFor="periodType">Period Type</Label>
              <select
                id="periodType"
                title="Period type"
                aria-label="Period type"
                className="w-full border rounded-md h-10 px-3 bg-background"
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {(periodType === "monthly" || periodType === "quarterly" || periodType === "yearly") && (
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))}
                />
              </div>
            )}

            {periodType === "monthly" && (
              <div>
                <Label htmlFor="month">Month</Label>
                <Input id="month" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value || 1))} />
              </div>
            )}

            {periodType === "quarterly" && (
              <div>
                <Label htmlFor="quarter">Quarter</Label>
                <Input
                  id="quarter"
                  type="number"
                  min={1}
                  max={4}
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value || 1))}
                />
              </div>
            )}

            {periodType === "custom" && (
              <>
                <div>
                  <Label htmlFor="customStart">Start Date</Label>
                  <Input id="customStart" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="customEnd">End Date</Label>
                  <Input id="customEnd" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="notesToAccounts">Notes to Accounts</Label>
              <Textarea
                id="notesToAccounts"
                value={notesToAccounts}
                onChange={(e) => setNotesToAccounts(e.target.value)}
                placeholder="Explain assumptions, reclassifications, or exceptional items..."
                className="min-h-[96px]"
              />
            </div>
            <div className="rounded-lg border p-3 text-sm space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allowOverride} onChange={(e) => setAllowOverride(e.target.checked)} />
                Allow override when validations fail
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allowVersioning} onChange={(e) => setAllowVersioning(e.target.checked)} />
                Allow generation of new version even when a period is already locked
              </label>
              <p className="text-muted-foreground text-xs">
                Overrides and locking actions are recorded in financial statement audit logs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {criticalQueryErrors.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Financial Reports Data Unavailable</CardTitle>
            <CardDescription>
              Some financial statement endpoints are not reachable right now. The page remains available while backend routing is fixed.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {criticalQueryErrors.slice(0, 2).map((error, index) => (
              <p key={`${error.message}-${index}`}>{error.message}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {allWarnings.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base">Validation Warnings</CardTitle>
            <CardDescription>Resolve these warnings or use override with proper approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {allWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="income">Income Statement</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash">Cash Flow Statement</TabsTrigger>
          <TabsTrigger value="history">Statement History</TabsTrigger>
          <TabsTrigger value="exports">PDF Exports</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Overview</CardTitle>
              <CardDescription>{income?.period?.periodLabel || "Current period"}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Net Profit or Loss</p>
                <p className="text-xl font-semibold">{amountCell(overviewQuery.data?.netProfitOrLoss)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Assets</p>
                <p className="text-xl font-semibold">{amountCell(overviewQuery.data?.totalAssets)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Closing Cash</p>
                <p className="text-xl font-semibold">{amountCell(overviewQuery.data?.closingCashBalance)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">History Records</p>
                <p className="text-xl font-semibold">{String(overviewQuery.data?.historyCount ?? 0)}</p>
              </div>
            </CardContent>
          </Card>

          {canAdjust && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manual Adjustments</CardTitle>
                <CardDescription>
                  Post reclassification or correction entries into statement lines. All entries are audited.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="adjTarget">Target Statement</Label>
                    <select
                      id="adjTarget"
                      title="Adjustment target statement"
                      aria-label="Adjustment target statement"
                      className="w-full border rounded-md h-10 px-3 bg-background"
                      value={adjustmentTarget}
                      onChange={(e) => setAdjustmentTarget(e.target.value as any)}
                    >
                      <option value="all">All Statements</option>
                      <option value="income_statement">Income Statement</option>
                      <option value="balance_sheet">Balance Sheet</option>
                      <option value="cash_flow_statement">Cash Flow Statement</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="adjLine">Line Key</Label>
                    <Input id="adjLine" value={adjustmentLineKey} onChange={(e) => setAdjustmentLineKey(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="adjAmount">Amount (KES)</Label>
                    <Input id="adjAmount" type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => createAdjustmentMutation.mutate()} disabled={createAdjustmentMutation.isPending} className="w-full">
                      Add Adjustment
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="adjNote">Adjustment Note</Label>
                  <Textarea id="adjNote" value={adjustmentNote} onChange={(e) => setAdjustmentNote(e.target.value)} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapping Layer</CardTitle>
              <CardDescription>
                Missing mappings can lead to classification gaps in financial statements. Keep this mapping table updated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mappingsQuery.data?.missing?.length ? (
                <div className="rounded-md border border-amber-300 p-3 text-sm">
                  <p className="font-medium">Missing mappings</p>
                  <p className="text-muted-foreground mt-1">{mappingsQuery.data.missing.join(", ")}</p>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300 p-3 text-sm">No required mapping gaps detected.</div>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Income Line</TableHead>
                      <TableHead>Balance Line</TableHead>
                      <TableHead>Cash Flow Line</TableHead>
                      <TableHead>Direction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeArray<any>(mappingsQuery.data?.mappings).map((m: any) => (
                      <TableRow key={`${m.sourceType}:${m.sourceKey}`}>
                        <TableCell>{m.sourceType}:{m.sourceKey}</TableCell>
                        <TableCell>{m.incomeLineKey || "-"}</TableCell>
                        <TableCell>{m.balanceSheetLineKey || "-"}</TableCell>
                        <TableCell>{m.cashFlowLineKey || "-"}</TableCell>
                        <TableCell>{m.direction}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {canManageMappings && (
                <>
                  <div>
                    <Label htmlFor="mappingsJson">Bulk Mapping Update JSON</Label>
                    <Textarea
                      id="mappingsJson"
                      className="min-h-[140px]"
                      value={mappingsJson}
                      onChange={(e) => setMappingsJson(e.target.value)}
                      placeholder='[{"sourceType":"transaction","sourceKey":"deposit","incomeLineKey":null,"balanceSheetLineKey":"mobileMoneyWalletBalances","cashFlowLineKey":"memberSavingsDepositsReceived","cashFlowBucket":"operating","direction":"inflow","isActive":true}]'
                    />
                  </div>
                  <Button onClick={() => updateMappingsMutation.mutate()} disabled={updateMappingsMutation.isPending}>
                    Save Mapping Updates
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardHeader>
              <CardTitle>Income Statement Preview</CardTitle>
              <CardDescription>{income?.period?.periodLabel || "Data unavailable"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(income?.lines || {}).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell>{rowTitle(key)}</TableCell>
                        <TableCell className="text-right">{amountCell(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Summary</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(income?.summary || {}).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{rowTitle(key)}</TableCell>
                        <TableCell className="text-right">{amountCell(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => generateMutation.mutate("income_statement")} disabled={generateMutation.isPending}>
                  Save Snapshot
                </Button>
                <Button variant="outline" onClick={onExportIncome}>Export PDF</Button>
                <Badge variant={income?.validation?.isValid ? "default" : "destructive"}>
                  {income?.validation?.isValid ? "Valid" : "Validation warning"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet Preview</CardTitle>
              <CardDescription>{balance?.period?.periodLabel || "Data unavailable"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(balance?.lines || {}).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell>{rowTitle(key)}</TableCell>
                        <TableCell className="text-right">{amountCell(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Summary</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(balance?.summary || {}).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{rowTitle(key)}</TableCell>
                        <TableCell className="text-right">{amountCell(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => generateMutation.mutate("balance_sheet")} disabled={generateMutation.isPending}>
                  Save Snapshot
                </Button>
                <Button variant="outline" onClick={onExportBalance}>Export PDF</Button>
                <Badge variant={balance?.validation?.isValid ? "default" : "destructive"}>
                  {balance?.validation?.isValid ? "Valid" : "Validation warning"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Statement Preview</CardTitle>
              <CardDescription>{cash?.period?.periodLabel || "Data unavailable"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(cash?.lines || {}).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell>{rowTitle(key)}</TableCell>
                        <TableCell className="text-right">{amountCell(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Summary</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(cash?.summary || {}).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{rowTitle(key)}</TableCell>
                        <TableCell className="text-right">{amountCell(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => generateMutation.mutate("cash_flow_statement")} disabled={generateMutation.isPending}>
                  Save Snapshot
                </Button>
                <Button variant="outline" onClick={onExportCash}>Export PDF</Button>
                <Badge variant={cash?.validation?.isValid ? "default" : "destructive"}>
                  {cash?.validation?.isValid ? "Valid" : "Validation warning"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Statement History</CardTitle>
              <CardDescription>Generated snapshots with version, approval, and locking status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valid</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeArray<any>(historyQuery.data).map((row: any) => (
                      <TableRow key={row._id}>
                        <TableCell>{statementTitles[row.statementType as StatementType] || row.statementType}</TableCell>
                        <TableCell>{row.periodLabel}</TableCell>
                        <TableCell>v{row.version}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "locked" ? "default" : row.status === "approved" ? "secondary" : "outline"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.isValid ? "default" : "destructive"}>{row.isValid ? "Yes" : "No"}</Badge>
                        </TableCell>
                        <TableCell>{new Date(row.generatedAt || row.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="space-x-2">
                          {canApprove && row.status !== "approved" && row.status !== "locked" && (
                            <Button size="sm" variant="outline" onClick={() => approveStatementMutation.mutate(row._id)}>
                              Approve
                            </Button>
                          )}
                          {canLock && row.status !== "locked" && (
                            <Button size="sm" variant="outline" onClick={() => lockStatementMutation.mutate(row._id)}>
                              Lock
                            </Button>
                          )}
                          {canUnlock && row.status === "locked" && (
                            <Button size="sm" variant="outline" onClick={() => unlockStatementMutation.mutate(row._id)}>
                              Unlock
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Adjustments History</h3>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {safeArray<any>(adjustmentsQuery.data).map((row: any) => (
                        <TableRow key={row._id}>
                          <TableCell>{row.periodLabel}</TableCell>
                          <TableCell>{row.targetStatement}</TableCell>
                          <TableCell>{row.lineKey}</TableCell>
                          <TableCell>{amountCell(row.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate" title={row.note}>{row.note}</TableCell>
                          <TableCell className="space-x-2">
                            {canApprove && row.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => approveAdjustmentMutation.mutate(row._id)}>Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => rejectAdjustmentMutation.mutate(row._id)}>Reject</Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports">
          <Card>
            <CardHeader>
              <CardTitle>PDF Exports</CardTitle>
              <CardDescription>Generate branded exports and full report pack.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onExportIncome} disabled={!canExportIncome}>Export Income Statement PDF</Button>
                <Button variant="outline" onClick={onExportBalance} disabled={!canExportBalance}>Export Balance Sheet PDF</Button>
                <Button variant="outline" onClick={onExportCash} disabled={!canExportCash}>Export Cash Flow PDF</Button>
                <Button onClick={onExportReportPack} disabled={!canExportReportPack}>Export Combined Report Pack PDF</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Combined report pack export is blocked by validation warnings unless override is enabled above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Financial Statement Audit Log</CardTitle>
              <CardDescription>Generation, approvals, locks, adjustments, and mapping changes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeArray<any>(auditLogQuery.data).map((entry: any) => (
                      <TableRow key={entry._id}>
                        <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{entry.userId?.fullName || entry.userId?.email || "System"}</TableCell>
                        <TableCell>{entry.action}</TableCell>
                        <TableCell>{entry.recordId || "-"}</TableCell>
                        <TableCell className="max-w-[400px] truncate" title={JSON.stringify(entry.changes || {})}>
                          {JSON.stringify(entry.changes || {})}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
