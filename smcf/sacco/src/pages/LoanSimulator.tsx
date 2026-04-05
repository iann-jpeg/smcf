import { useState, useMemo, useCallback } from "react";
import { useMembers } from "@/hooks/useMembers";
import { useLoans } from "@/hooks/useLoans";
import { useSimulationHistory, type SimulationRecord } from "@/hooks/useSimulationHistory";
import { useSimulationPresets, type CustomPreset } from "@/hooks/useSimulationPresets";
import { evaluateLoanSafety, type LoanSafetyInput, type LoanSafetyResult } from "@/lib/loan-safety-engine";
import { exportSimulationSingle, exportSimulationComparison } from "@/lib/pdf-export";
import { LoanSafetyPanel } from "@/components/LoanSafetyPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FlaskConical, Users, TrendingUp, RotateCcw, CheckCircle2, Columns2, LayoutDashboard, Download, Save, History, Trash2, Eye, Plus, Pencil, Copy, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Scenario state ────────────────────────────────────

interface ScenarioState {
  memberId: string;
  amount: number;
  guarantors: string[];
  overrideTrust: number | null;
}

const defaultScenario = (): ScenarioState => ({
  memberId: "",
  amount: 50000,
  guarantors: [],
  overrideTrust: null,
});

// ─── Preset Templates ──────────────────────────────────

interface PresetTemplate {
  name: string;
  description: string;
  icon: string;
  amount: number;
  overrideTrust: number | null;
  guarantorCount: number; // how many to auto-select
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  { name: "Low Risk Borrower", description: "Small loan, high trust score", icon: "🟢", amount: 20000, overrideTrust: 85, guarantorCount: 0 },
  { name: "Medium Risk Standard", description: "Average loan with 1 guarantor", icon: "🟡", amount: 100000, overrideTrust: 55, guarantorCount: 1 },
  { name: "High Exposure Test", description: "Large loan, low trust, stress test", icon: "🔴", amount: 500000, overrideTrust: 25, guarantorCount: 0 },
  { name: "Max Guarantor Support", description: "Large loan backed by 3 guarantors", icon: "🛡️", amount: 300000, overrideTrust: 60, guarantorCount: 3 },
  { name: "New Member First Loan", description: "Small loan for new member profile", icon: "🆕", amount: 10000, overrideTrust: 40, guarantorCount: 0 },
  { name: "Board-Level Review", description: "Very large loan triggering board approval", icon: "🏛️", amount: 750000, overrideTrust: 70, guarantorCount: 2 },
];

// ─── Scenario Controls (reusable) ──────────────────────

interface ScenarioControlsProps {
  label: string;
  scenario: ScenarioState;
  onChange: (s: ScenarioState) => void;
  members: any[];
  compact?: boolean;
  customPresets?: CustomPreset[];
  onDeletePreset?: (id: string) => void;
  onEditPreset?: (preset: CustomPreset) => void;
  onSavePreset?: () => void;
  onCloneBuiltIn?: (preset: PresetTemplate) => void;
  onReorderPresets?: (orderedIds: string[]) => void;
}

function ScenarioControls({ label, scenario, onChange, members, compact, customPresets = [], onDeletePreset, onEditPreset, onSavePreset, onCloneBuiltIn, onReorderPresets }: ScenarioControlsProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const selectedMember = members.find((m: any) => m.id === scenario.memberId);
  const availableGuarantors = members.filter(
    (m: any) => m.id !== scenario.memberId && m.status === "active"
  );

  const toggleGuarantor = (id: string) => {
    const next = scenario.guarantors.includes(id)
      ? scenario.guarantors.filter((g) => g !== id)
      : [...scenario.guarantors, id];
    onChange({ ...scenario, guarantors: next });
  };

  const applyPreset = (preset: PresetTemplate) => {
    const autoGuarantors = availableGuarantors.slice(0, preset.guarantorCount).map((g: any) => g.id);
    onChange({
      ...scenario,
      amount: preset.amount,
      overrideTrust: preset.overrideTrust,
      guarantors: autoGuarantors,
    });
    toast.info(`Preset "${preset.name}" applied`);
  };

  const applyCustomPreset = (p: CustomPreset) => {
    const autoGuarantors = availableGuarantors.slice(0, p.guarantor_count).map((g: any) => g.id);
    onChange({
      ...scenario,
      amount: Number(p.amount),
      overrideTrust: p.override_trust,
      guarantors: autoGuarantors,
    });
    toast.info(`Preset "${p.name}" applied`);
  };

  const allPresets = [...PRESET_TEMPLATES];

  return (
    <div className="space-y-4">
      {/* Built-in Preset Templates */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Built-in Presets</p>
        <div className="flex gap-1.5 flex-wrap">
          {allPresets.map((p) => (
            <Tooltip key={p.name}>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-0.5">
                  <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 gap-1 rounded-r-none"
                    onClick={() => applyPreset(p)}>
                    <span>{p.icon}</span> {p.name}
                  </Button>
                  {onCloneBuiltIn && (
                    <Button variant="outline" size="sm" className="text-[10px] h-7 px-1 rounded-l-none border-l-0"
                      onClick={(e) => { e.stopPropagation(); onCloneBuiltIn(p); }}
                      title="Clone as custom preset">
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs space-y-1.5 p-3">
                <p className="font-semibold">{p.icon} {p.name}</p>
                <p className="text-muted-foreground">{p.description}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t text-[10px]">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">KES {p.amount.toLocaleString()}</span>
                  <span className="text-muted-foreground">Trust Score:</span>
                  <span className="font-medium">{p.overrideTrust ?? "Actual"}</span>
                  <span className="text-muted-foreground">Guarantors:</span>
                  <span className="font-medium">{p.guarantorCount === 0 ? "None" : p.guarantorCount}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Custom Presets */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Custom Presets</p>
          {onSavePreset && scenario.memberId && (
            <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5 ml-auto gap-1" onClick={onSavePreset}>
              <Plus className="h-3 w-3" /> Save Current
            </Button>
          )}
        </div>
        {customPresets.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">No custom presets yet — configure a scenario and click "Save Current"</p>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {customPresets.map((p) => (
              <Tooltip key={p.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`inline-flex items-center gap-0.5 rounded transition-all duration-150 ${
                      dragOverId === p.id ? "ring-2 ring-primary/60 bg-primary/10 scale-105" : ""
                    } ${draggingId === p.id ? "opacity-40" : ""} ${justDroppedId === p.id ? "animate-scale-in" : ""}`}
                    draggable={!!onReorderPresets}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("preset-id", p.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(p.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverId(p.id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromId = e.dataTransfer.getData("preset-id");
                      setDraggingId(null);
                      setDragOverId(null);
                      if (!fromId || fromId === p.id || !onReorderPresets) return;
                      const ids = customPresets.map((cp) => cp.id);
                      const fromIdx = ids.indexOf(fromId);
                      const toIdx = ids.indexOf(p.id);
                      if (fromIdx === -1 || toIdx === -1) return;
                      ids.splice(fromIdx, 1);
                      ids.splice(toIdx, 0, fromId);
                      onReorderPresets(ids);
                      setJustDroppedId(fromId);
                      setTimeout(() => setJustDroppedId(null), 300);
                    }}
                  >
                    {onReorderPresets && (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 cursor-grab"
                        aria-label={`Reorder ${p.name}. Use arrow keys to move.`}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                          e.preventDefault();
                          const ids = customPresets.map((cp) => cp.id);
                          const idx = ids.indexOf(p.id);
                          const swapIdx = e.key === "ArrowUp" ? idx - 1 : idx + 1;
                          if (swapIdx < 0 || swapIdx >= ids.length) return;
                          [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
                          onReorderPresets(ids);
                        }}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 gap-1 rounded-r-none"
                      onClick={() => applyCustomPreset(p)}>
                      <span>{p.icon}</span> {p.name}
                    </Button>
                    <div className="flex">
                      {onEditPreset && (
                        <Button variant="outline" size="sm" className="text-[10px] h-7 px-1 rounded-none border-l-0"
                          onClick={(e) => { e.stopPropagation(); onEditPreset(p); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {onDeletePreset && (
                        <Button variant="outline" size="sm" className="text-[10px] h-7 px-1 rounded-l-none border-l-0 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); onDeletePreset(p.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs space-y-1.5 p-3">
                  <p className="font-semibold">{p.icon} {p.name}</p>
                  {p.description && <p className="text-muted-foreground">{p.description}</p>}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t text-[10px]">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-medium">KES {Number(p.amount).toLocaleString()}</span>
                    <span className="text-muted-foreground">Trust Score:</span>
                    <span className="font-medium">{p.override_trust ?? "Actual"}</span>
                    <span className="text-muted-foreground">Guarantors:</span>
                    <span className="font-medium">{p.guarantor_count === 0 ? "None" : p.guarantor_count}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs font-semibold">{label}</Badge>
        <Button variant="ghost" size="sm" className="text-xs h-6 ml-auto" onClick={() => onChange(defaultScenario())}>
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>

      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
        <div className="space-y-1.5">
          <Label className="text-xs">Member</Label>
          <Select value={scenario.memberId} onValueChange={(v) => onChange({ ...scenario, memberId: v, guarantors: [], overrideTrust: null })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose member" /></SelectTrigger>
            <SelectContent>
              {members.filter((m: any) => m.status === "active").map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.member_id} — {m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Loan Amount (KES)</Label>
          <Input type="number" min={1000} max={5000000} value={scenario.amount} className="h-9 text-sm"
            onChange={(e) => onChange({ ...scenario, amount: Number(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Amount slider */}
      <div className="space-y-1">
        <Slider value={[scenario.amount]} onValueChange={([v]) => onChange({ ...scenario, amount: v })}
          min={1000} max={1000000} step={5000} className="py-1" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>KES 1K</span>
          <span className="font-medium">KES {scenario.amount.toLocaleString()}</span>
          <span>KES 1M</span>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-1.5 flex-wrap">
        {[20000, 50000, 100000, 200000, 300000].map((amt) => (
          <Button key={amt} variant="outline" size="sm" className="text-[10px] h-6 px-2"
            onClick={() => onChange({ ...scenario, amount: amt })}>
            {amt >= 1000 ? `${amt / 1000}K` : amt}
          </Button>
        ))}
      </div>

      {/* Member snapshot */}
      {selectedMember && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border p-2">
              <p className="text-[10px] text-muted-foreground">Savings</p>
              <p className="font-semibold">KES {Number(selectedMember.savings).toLocaleString()}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] text-muted-foreground">Shares</p>
              <p className="font-semibold">KES {Number(selectedMember.shares).toLocaleString()}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] text-muted-foreground">Loan Balance</p>
              <p className="font-semibold">KES {Number(selectedMember.loan_balance).toLocaleString()}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] text-muted-foreground">Risk Score</p>
              <p className="font-semibold">{selectedMember.risk_score ?? "N/A"}</p>
            </div>
          </div>

          {/* Trust override */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Trust Score Override</Label>
              <Badge variant="outline" className="text-[10px]">
                {scenario.overrideTrust !== null ? scenario.overrideTrust : selectedMember.risk_score ?? 50}
              </Badge>
            </div>
            <Slider value={[scenario.overrideTrust ?? selectedMember.risk_score ?? 50]}
              onValueChange={([v]) => onChange({ ...scenario, overrideTrust: v })}
              min={0} max={100} step={1} className="py-1" />
            {scenario.overrideTrust !== null && (
              <Button variant="ghost" size="sm" className="text-[10px] h-5" onClick={() => onChange({ ...scenario, overrideTrust: null })}>
                Reset to actual
              </Button>
            )}
          </div>

          {/* Guarantor table */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Guarantors</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{scenario.guarantors.length} selected</Badge>
            </div>
            <div className="max-h-[180px] overflow-y-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 p-1"></TableHead>
                    <TableHead className="text-xs p-1">Name</TableHead>
                    <TableHead className="text-xs text-right p-1">Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableGuarantors.map((g: any) => {
                    const sel = scenario.guarantors.includes(g.id);
                    return (
                      <TableRow key={g.id} className={cn("cursor-pointer", sel && "bg-primary/5")} onClick={() => toggleGuarantor(g.id)}>
                        <TableCell className="p-1">
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center",
                            sel ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                            {sel && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs p-1">{g.name}</TableCell>
                        <TableCell className="text-xs text-right p-1">KES {Number(g.savings).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Evaluation helper ─────────────────────────────────

function useEvaluation(scenario: ScenarioState, members: any[], saccoCapital: number, totalLoansIssued: number): LoanSafetyResult | null {
  return useMemo(() => {
    const member = members.find((m: any) => m.id === scenario.memberId);
    if (!member || scenario.amount <= 0) return null;

    const guarantorData = scenario.guarantors
      .map((gId) => {
        const g = members.find((m: any) => m.id === gId);
        return g ? { id: g.id, name: g.name, savings: Number(g.savings), risk_score: g.risk_score } : null;
      })
      .filter(Boolean) as LoanSafetyInput["guarantors"];

    return evaluateLoanSafety({
      member: {
        savings: Number(member.savings),
        shares: Number(member.shares),
        loan_balance: Number(member.loan_balance),
        risk_score: member.risk_score,
        trust_score: scenario.overrideTrust ?? member.risk_score ?? 50,
      },
      requestedLoan: scenario.amount,
      guarantors: guarantorData,
      saccoCapital,
      totalLoansIssued,
    });
  }, [scenario, members, saccoCapital, totalLoansIssued]);
}

// ─── Main Page ─────────────────────────────────────────

export default function LoanSimulator() {
  const { data: members = [], isLoading } = useMembers();
  const { data: loansData = [] } = useLoans();
  const { data: history = [], save, remove, isSaving } = useSimulationHistory();
  const { data: customPresets = [], addPreset, updatePreset, removePreset, reorderPresets, isAdding, isUpdating } = useSimulationPresets();
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [tab, setTab] = useState<"simulator" | "history">("simulator");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNotes, setSaveNotes] = useState("");
  const [viewRecord, setViewRecord] = useState<SimulationRecord | null>(null);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CustomPreset | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  const [presetIcon, setPresetIcon] = useState("⚙️");
  const [presetAmount, setPresetAmount] = useState(50000);
  const [presetTrust, setPresetTrust] = useState<number | null>(null);
  const [presetGuarantorCount, setPresetGuarantorCount] = useState(0);

  const [scenarioA, setScenarioA] = useState<ScenarioState>(defaultScenario());
  const [scenarioB, setScenarioB] = useState<ScenarioState>(defaultScenario());

  const saccoCapital = useMemo(
    () => members.reduce((s: number, m: any) => s + Number(m.savings) + Number(m.shares), 0),
    [members]
  );
  const totalLoansIssued = useMemo(
    () => loansData
      .filter((l: any) => ["active", "disbursed", "approved"].includes(l.status))
      .reduce((s: number, l: any) => s + Number(l.balance), 0),
    [loansData]
  );

  const resultA = useEvaluation(scenarioA, members, saccoCapital, totalLoansIssued);
  const resultB = useEvaluation(scenarioB, members, saccoCapital, totalLoansIssued);

  const buildScenarioMeta = (s: ScenarioState) => {
    const m = members.find((mem: any) => mem.id === s.memberId);
    return {
      memberName: m?.name ?? "Unknown",
      memberId: m?.member_id ?? "—",
      amount: s.amount,
      trustScore: s.overrideTrust ?? m?.risk_score ?? 50,
      guarantorNames: s.guarantors.map((gId) => {
        const g = members.find((mem: any) => mem.id === gId);
        return g?.name ?? "Unknown";
      }),
    };
  };

  const handleExportSingle = () => {
    if (!resultA) return;
    exportSimulationSingle(buildScenarioMeta(scenarioA), resultA, saccoCapital, totalLoansIssued);
  };

  const handleExportComparison = () => {
    if (!resultA || !resultB) return;
    exportSimulationComparison(
      buildScenarioMeta(scenarioA), resultA,
      buildScenarioMeta(scenarioB), resultB,
      saccoCapital, totalLoansIssued,
    );
  };

  const handleSave = async () => {
    if (!resultA) return;
    try {
      await save({
        mode,
        scenario_a: { ...scenarioA, meta: buildScenarioMeta(scenarioA) },
        scenario_b: mode === "compare" && resultB ? { ...scenarioB, meta: buildScenarioMeta(scenarioB) } : undefined,
        result_a: resultA,
        result_b: mode === "compare" ? resultB : undefined,
        notes: saveNotes || undefined,
      });
      toast.success("Simulation saved to history");
      setSaveDialogOpen(false);
      setSaveNotes("");
    } catch {
      toast.error("Failed to save simulation");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      toast.success("Simulation deleted");
      if (viewRecord?.id === id) setViewRecord(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleReload = (record: SimulationRecord) => {
    const sa = record.scenario_a as any;
    setScenarioA({ memberId: sa.memberId, amount: sa.amount, guarantors: sa.guarantors ?? [], overrideTrust: sa.overrideTrust ?? null });
    if (record.mode === "compare" && record.scenario_b) {
      const sb = record.scenario_b as any;
      setScenarioB({ memberId: sb.memberId, amount: sb.amount, guarantors: sb.guarantors ?? [], overrideTrust: sb.overrideTrust ?? null });
      setMode("compare");
    } else {
      setMode("single");
    }
    setTab("simulator");
    toast.info("Scenario loaded from history");
  };

  const resetPresetDialog = () => {
    setEditingPreset(null);
    setPresetName("");
    setPresetDesc("");
    setPresetIcon("⚙️");
    setPresetAmount(scenarioA.amount);
    setPresetTrust(scenarioA.overrideTrust);
    setPresetGuarantorCount(scenarioA.guarantors.length);
  };

  const openPresetDialogForNew = () => {
    resetPresetDialog();
    setPresetAmount(scenarioA.amount);
    setPresetTrust(scenarioA.overrideTrust);
    setPresetGuarantorCount(scenarioA.guarantors.length);
    setPresetDialogOpen(true);
  };

  const openPresetDialogForEdit = (preset: CustomPreset) => {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetDesc(preset.description ?? "");
    setPresetIcon(preset.icon);
    setPresetAmount(Number(preset.amount));
    setPresetTrust(preset.override_trust);
    setPresetGuarantorCount(preset.guarantor_count);
    setPresetDialogOpen(true);
  };

  const openPresetDialogForClone = (preset: PresetTemplate) => {
    resetPresetDialog();
    setPresetName(`${preset.name} (Copy)`);
    setPresetDesc(preset.description);
    setPresetIcon(preset.icon);
    setPresetAmount(preset.amount);
    setPresetTrust(preset.overrideTrust);
    setPresetGuarantorCount(preset.guarantorCount);
    setPresetDialogOpen(true);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    try {
      if (editingPreset) {
        await updatePreset({
          id: editingPreset.id,
          name: presetName.trim(),
          description: presetDesc.trim() || undefined,
          amount: presetAmount,
          override_trust: presetTrust,
          guarantor_count: presetGuarantorCount,
          icon: presetIcon,
        });
        toast.success(`Preset "${presetName}" updated`);
      } else {
        await addPreset({
          name: presetName.trim(),
          description: presetDesc.trim() || undefined,
          amount: presetAmount,
          override_trust: presetTrust,
          guarantor_count: presetGuarantorCount,
          icon: presetIcon,
        });
        toast.success(`Preset "${presetName}" saved`);
      }
      setPresetDialogOpen(false);
      resetPresetDialog();
    } catch {
      toast.error(editingPreset ? "Failed to update preset" : "Failed to save preset");
    }
  };

  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);

  const confirmDeletePreset = async () => {
    if (!deletePresetId) return;
    try {
      await removePreset(deletePresetId);
      toast.success("Preset deleted");
    } catch {
      toast.error("Failed to delete preset");
    } finally {
      setDeletePresetId(null);
    }
  };

  const handleDeletePreset = (id: string) => {
    setDeletePresetId(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            Loan Safety Simulator
          </h1>
          <p className="text-muted-foreground text-sm">
            Test the 4-layer algorithm — no real applications created
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "simulator" ? "default" : "outline"} size="sm" className="gap-1.5"
            onClick={() => setTab("simulator")}>
            <FlaskConical className="h-4 w-4" /> Simulator
          </Button>
          <Button variant={tab === "history" ? "default" : "outline"} size="sm" className="gap-1.5"
            onClick={() => setTab("history")}>
            <History className="h-4 w-4" /> History
            {history.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{history.length}</Badge>}
          </Button>
        </div>
      </div>

      {/* ──── HISTORY TAB ──── */}
      {tab === "history" && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <History className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No saved simulations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Run a simulation and save it to build your history</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> Simulation History
                </CardTitle>
                <CardDescription>{history.length} saved simulation{history.length !== 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Mode</TableHead>
                        <TableHead className="text-xs">Member</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Decision</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((rec) => {
                        const sa = rec.scenario_a as any;
                        const ra = rec.result_a as any;
                        return (
                          <TableRow key={rec.id}>
                            <TableCell className="text-xs">{format(new Date(rec.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{rec.mode === "compare" ? "Compare" : "Single"}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {sa?.meta?.memberName ?? "—"}
                              {rec.mode === "compare" && rec.scenario_b && (
                                <span className="text-muted-foreground"> vs {(rec.scenario_b as any)?.meta?.memberName ?? "—"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-medium">KES {Number(sa?.amount ?? 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-[10px]",
                                ra?.decision === "APPROVE" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" :
                                ra?.decision === "REDUCE" ? "bg-amber-500/10 text-amber-700 border-amber-200" :
                                "bg-destructive/10 text-destructive border-destructive/20"
                              )} variant="outline">
                                {ra?.decision ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{rec.notes || "—"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewRecord(rec)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleReload(rec)}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(rec.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* View Record Detail Dialog */}
          <Dialog open={!!viewRecord} onOpenChange={(o) => !o && setViewRecord(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">Simulation Detail</DialogTitle>
                <DialogDescription>
                  {viewRecord && format(new Date(viewRecord.created_at), "dd MMM yyyy HH:mm")}
                  {viewRecord?.notes && ` — ${viewRecord.notes}`}
                </DialogDescription>
              </DialogHeader>
              {viewRecord && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Member:</span> {(viewRecord.scenario_a as any)?.meta?.memberName}</div>
                    <div><span className="text-muted-foreground">Amount:</span> KES {Number((viewRecord.scenario_a as any)?.amount ?? 0).toLocaleString()}</div>
                    <div><span className="text-muted-foreground">Decision:</span> <Badge variant="outline">{(viewRecord.result_a as any)?.decision}</Badge></div>
                    <div><span className="text-muted-foreground">Mode:</span> {viewRecord.mode}</div>
                  </div>
                  {(viewRecord.result_a as any)?.reasons && (
                    <div>
                      <p className="text-xs font-semibold mb-1">Reasons (Scenario A):</p>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {((viewRecord.result_a as any).reasons as string[]).map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viewRecord.mode === "compare" && viewRecord.result_b && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Member B:</span> {(viewRecord.scenario_b as any)?.meta?.memberName}</div>
                        <div><span className="text-muted-foreground">Amount B:</span> KES {Number((viewRecord.scenario_b as any)?.amount ?? 0).toLocaleString()}</div>
                        <div><span className="text-muted-foreground">Decision B:</span> <Badge variant="outline">{(viewRecord.result_b as any)?.decision}</Badge></div>
                      </div>
                      {(viewRecord.result_b as any)?.reasons && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Reasons (Scenario B):</p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            {((viewRecord.result_b as any).reasons as string[]).map((r, i) => (
                              <li key={i}>• {r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => viewRecord && handleReload(viewRecord)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Load into Simulator
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ──── SIMULATOR TAB ──── */}
      {tab === "simulator" && (
        <>
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button variant={mode === "single" ? "default" : "outline"} size="sm" className="gap-1.5"
              onClick={() => setMode("single")}>
              <LayoutDashboard className="h-4 w-4" /> Single
            </Button>
            <Button variant={mode === "compare" ? "default" : "outline"} size="sm" className="gap-1.5"
              onClick={() => setMode("compare")}>
              <Columns2 className="h-4 w-4" /> Compare
            </Button>
          </div>

          {/* SACCO Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">SACCO Capital</p>
              <p className="text-lg font-bold font-heading">KES {saccoCapital.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Total Loans Issued</p>
              <p className="text-lg font-bold font-heading">KES {totalLoansIssued.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Current Exposure</p>
              <p className="text-lg font-bold font-heading">
                {saccoCapital > 0 ? ((totalLoansIssued / saccoCapital) * 100).toFixed(1) : 0}%
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Active Members</p>
              <p className="text-lg font-bold font-heading">{members.filter((m: any) => m.status === "active").length}</p>
            </CardContent></Card>
          </div>

          {/* ──── SINGLE MODE ──── */}
          {mode === "single" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">Simulation Parameters</CardTitle>
                    <CardDescription>Adjust inputs and watch the algorithm respond in real-time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScenarioControls label="Scenario" scenario={scenarioA} onChange={setScenarioA} members={members} customPresets={customPresets} onDeletePreset={handleDeletePreset} onEditPreset={openPresetDialogForEdit} onSavePreset={openPresetDialogForNew} onCloneBuiltIn={openPresetDialogForClone} onReorderPresets={reorderPresets} />
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <TrendingUp className="h-4 w-4" /> LIVE ALGORITHM RESPONSE
                </div>
                {resultA ? (
                  <LoanSafetyPanel result={resultA} requestedLoan={scenarioA.amount} />
                ) : (
                  <Card><CardContent className="py-12 text-center">
                    <FlaskConical className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">Select a member and set a loan amount</p>
                  </CardContent></Card>
                )}
                <div className="rounded-lg border border-dashed p-3 text-center space-y-2">
                  <p className="text-[10px] text-muted-foreground">⚡ Simulation only — no loans are created</p>
                  {resultA && (
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportSingle}>
                        <Download className="h-3.5 w-3.5" /> Export PDF
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setSaveDialogOpen(true)} disabled={isSaving}>
                        <Save className="h-3.5 w-3.5" /> Save to History
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──── COMPARE MODE ──── */}
          {mode === "compare" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scenario A */}
              <div className="space-y-4">
                <Card className="border-primary/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-heading text-base flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">A</div>
                      Scenario A
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScenarioControls label="A" scenario={scenarioA} onChange={setScenarioA} members={members} compact customPresets={customPresets} onDeletePreset={handleDeletePreset} onEditPreset={openPresetDialogForEdit} onSavePreset={openPresetDialogForNew} onCloneBuiltIn={openPresetDialogForClone} onReorderPresets={reorderPresets} />
                  </CardContent>
                </Card>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> RESULT A
                </div>
                {resultA ? (
                  <LoanSafetyPanel result={resultA} requestedLoan={scenarioA.amount} />
                ) : (
                  <Card><CardContent className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">Configure Scenario A above</p>
                  </CardContent></Card>
                )}
              </div>

              {/* Scenario B */}
              <div className="space-y-4">
                <Card className="border-chart-2/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-heading text-base flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-chart-2 text-primary-foreground flex items-center justify-center text-xs font-bold">B</div>
                      Scenario B
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScenarioControls label="B" scenario={scenarioB} onChange={setScenarioB} members={members} compact customPresets={customPresets} onDeletePreset={handleDeletePreset} onEditPreset={openPresetDialogForEdit} onSavePreset={openPresetDialogForNew} onCloneBuiltIn={openPresetDialogForClone} onReorderPresets={reorderPresets} />
                  </CardContent>
                </Card>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> RESULT B
                </div>
                {resultB ? (
                  <LoanSafetyPanel result={resultB} requestedLoan={scenarioB.amount} />
                ) : (
                  <Card><CardContent className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">Configure Scenario B above</p>
                  </CardContent></Card>
                )}
              </div>

              {/* Comparison Summary */}
              {resultA && resultB && (
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <Columns2 className="h-5 w-5 text-primary" /> Side-by-Side Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead className="text-center">
                              <Badge variant="outline" className="text-[10px]">A</Badge>
                            </TableHead>
                            <TableHead className="text-center">
                              <Badge variant="outline" className="text-[10px]">B</Badge>
                            </TableHead>
                            <TableHead className="text-center">Difference</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            { label: "Decision", a: resultA.decision, b: resultB.decision, diff: null },
                            { label: "Loan Amount", a: `KES ${scenarioA.amount.toLocaleString()}`, b: `KES ${scenarioB.amount.toLocaleString()}`, diff: scenarioB.amount - scenarioA.amount },
                            { label: "Safe Loan Limit", a: `KES ${resultA.layer1.safeLoanLimit.toLocaleString()}`, b: `KES ${resultB.layer1.safeLoanLimit.toLocaleString()}`, diff: resultB.layer1.safeLoanLimit - resultA.layer1.safeLoanLimit },
                            { label: "Risk Score", a: String(resultA.layer2.riskScore), b: String(resultB.layer2.riskScore), diff: resultB.layer2.riskScore - resultA.layer2.riskScore },
                            { label: "Risk Level", a: resultA.layer2.riskLevel, b: resultB.layer2.riskLevel, diff: null },
                            { label: "Guarantors", a: `${resultA.layer3.providedCount}/${resultA.layer3.requiredCount}`, b: `${resultB.layer3.providedCount}/${resultB.layer3.requiredCount}`, diff: null },
                            { label: "Guarantor Coverage", a: `KES ${resultA.layer3.totalGuarantorSavings.toLocaleString()}`, b: `KES ${resultB.layer3.totalGuarantorSavings.toLocaleString()}`, diff: resultB.layer3.totalGuarantorSavings - resultA.layer3.totalGuarantorSavings },
                            { label: "Projected Exposure", a: `${(resultA.layer4.projectedExposure * 100).toFixed(1)}%`, b: `${(resultB.layer4.projectedExposure * 100).toFixed(1)}%`, diff: null },
                            { label: "Capital Safety", a: resultA.layer4.status, b: resultB.layer4.status, diff: null },
                          ].map((row) => (
                            <TableRow key={row.label}>
                              <TableCell className="text-sm font-medium">{row.label}</TableCell>
                              <TableCell className="text-center text-sm">{row.a}</TableCell>
                              <TableCell className="text-center text-sm">{row.b}</TableCell>
                              <TableCell className="text-center text-sm">
                                {row.diff !== null ? (
                                  <span className={cn("font-semibold",
                                    row.diff > 0 ? "text-emerald-600" : row.diff < 0 ? "text-destructive" : "text-muted-foreground"
                                  )}>
                                    {row.diff > 0 ? "+" : ""}{typeof row.diff === "number" && Math.abs(row.diff) >= 1000
                                      ? `KES ${row.diff.toLocaleString()}`
                                      : row.diff}
                                  </span>
                                ) : (
                                  <span className={cn("text-xs",
                                    row.a === row.b ? "text-muted-foreground" : "text-amber-600 font-semibold"
                                  )}>
                                    {row.a === row.b ? "Same" : "Different"}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="lg:col-span-2 rounded-lg border border-dashed p-3 text-center space-y-2">
                <p className="text-[10px] text-muted-foreground">⚡ Simulation only — no loans are created or modified</p>
                {resultA && resultB && (
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportComparison}>
                      <Download className="h-3.5 w-3.5" /> Export Comparison PDF
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setSaveDialogOpen(true)} disabled={isSaving}>
                      <Save className="h-3.5 w-3.5" /> Save to History
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Save Simulation</DialogTitle>
            <DialogDescription>Add optional notes for committee review</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Mode:</span> {mode === "compare" ? "Comparison" : "Single"}</p>
              <p><span className="text-muted-foreground">Decision:</span> {resultA?.decision ?? "—"}</p>
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea placeholder="e.g. Testing increased amount for member X…" value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)} className="mt-1.5" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={isSaving}>
              <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save/Edit Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={(o) => { if (!o) { setPresetDialogOpen(false); resetPresetDialog(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{editingPreset ? "Edit Custom Preset" : "Save Custom Preset"}</DialogTitle>
            <DialogDescription>{editingPreset ? "Update the preset name, parameters, and icon" : "Save the current scenario parameters as a reusable preset template"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Preset Name *</Label>
              <Input placeholder="e.g. Conservative low-risk" value={presetName}
                onChange={(e) => setPresetName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Input placeholder="Brief description of this scenario" value={presetDesc}
                onChange={(e) => setPresetDesc(e.target.value)} className="mt-1" />
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Amount (KES)</Label>
                <Input type="number" min={1000} value={presetAmount}
                  onChange={(e) => setPresetAmount(Number(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Trust Score Override</Label>
                <div className="flex gap-1.5 mt-1 items-center">
                  <Input type="number" min={0} max={100} value={presetTrust ?? ""}
                    placeholder="Actual"
                    onChange={(e) => setPresetTrust(e.target.value ? Number(e.target.value) : null)} />
                  {presetTrust !== null && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] shrink-0" onClick={() => setPresetTrust(null)}>
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Guarantor Count</Label>
                <Input type="number" min={0} max={10} value={presetGuarantorCount}
                  onChange={(e) => setPresetGuarantorCount(Number(e.target.value) || 0)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Icon</Label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {["⚙️", "🟢", "🟡", "🔴", "🛡️", "🆕", "🏛️", "💰", "📊", "🎯", "⚡", "🔒"].map((ic) => (
                  <Button key={ic} variant={presetIcon === ic ? "default" : "outline"} size="sm"
                    className="h-8 w-8 p-0 text-base" onClick={() => setPresetIcon(ic)}>
                    {ic}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setPresetDialogOpen(false); resetPresetDialog(); }}>Cancel</Button>
            <Button size="sm" className="gap-1.5" onClick={handleSavePreset} disabled={(isAdding || isUpdating) || !presetName.trim()}>
              <Save className="h-3.5 w-3.5" /> {(isAdding || isUpdating) ? "Saving…" : editingPreset ? "Update Preset" : "Save Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Preset Confirmation */}
      <AlertDialog open={!!deletePresetId} onOpenChange={(o) => { if (!o) setDeletePresetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The preset will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePreset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
