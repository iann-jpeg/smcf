import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { AlertCircle, Loader2, Save, Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";

const EarlyWithdrawalSettings = () => {
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [penaltyType, setPenaltyType] = useState<"fixed" | "dynamic">("dynamic");
  const [basePenalty, setBasePenalty] = useState(10);
  const [dynamicRates, setDynamicRates] = useState({
    over_75_percent: 20,
    over_50_percent: 15,
    over_25_percent: 10,
    under_25_percent: 5,
  });
  const [creditPenalty, setCreditPenalty] = useState(10);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/savings/admin/early-withdrawal-settings`, {
        headers: { ...authService.getAuthHeaders() },
      });

      const data = await res.json();

      if (data.success) {
        setSettings(data.data);
        setEnabled(data.data.enabled || false);
        setPenaltyType(data.data.penalty_type || "dynamic");
        setBasePenalty(data.data.base_penalty || 10);
        setDynamicRates(data.data.dynamic_rates || {
          over_75_percent: 20,
          over_50_percent: 15,
          over_25_percent: 10,
          under_25_percent: 5,
        });
        setCreditPenalty(data.data.credit_penalty || 10);
      }
    } catch (error: any) {
      toast({
        title: "Error Loading Settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/savings/admin/early-withdrawal-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          early_withdrawal_enabled: enabled,
          early_withdrawal_penalty_type: penaltyType,
          early_withdrawal_base_penalty: basePenalty,
          dynamic_rates: dynamicRates,
          early_withdrawal_credit_penalty: creditPenalty,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Settings Saved",
          description: "Early withdrawal settings updated successfully",
        });
        fetchSettings();
      } else {
        throw new Error(data.error || "Failed to save settings");
      }
    } catch (error: any) {
      toast({
        title: "Error Saving Settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Early Withdrawal Settings</CardTitle>
              <CardDescription>
                Configure early withdrawal penalties for locked deposits
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Early Withdrawals */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled" className="text-base">
                Enable Early Withdrawals
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow members to withdraw locked deposits before maturity with penalties
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Early Withdrawal Enabled</p>
                    <p>
                      Members can now request early withdrawal from locked deposits. 
                      Penalties will be applied and funds redirected to the group reserve account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Penalty Type */}
              <div className="space-y-2">
                <Label htmlFor="penaltyType">Penalty Type</Label>
                <Select value={penaltyType} onValueChange={(val: "fixed" | "dynamic") => setPenaltyType(val)}>
                  <SelectTrigger id="penaltyType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Percentage</SelectItem>
                    <SelectItem value="dynamic">Dynamic (Based on Time Remaining)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {penaltyType === "fixed" 
                    ? "Same penalty percentage regardless of time remaining"
                    : "Higher penalties for withdrawals with more time remaining"
                  }
                </p>
              </div>

              {/* Base Penalty (for fixed type) */}
              {penaltyType === "fixed" && (
                <div className="space-y-2">
                  <Label htmlFor="basePenalty">Fixed Penalty Percentage</Label>
                  <Input
                    id="basePenalty"
                    type="number"
                    min="0"
                    max="50"
                    value={basePenalty}
                    onChange={(e) => setBasePenalty(parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Penalty applied to all early withdrawals (0-50%)
                  </p>
                </div>
              )}

              {/* Dynamic Rates */}
              {penaltyType === "dynamic" && (
                <div className="space-y-4">
                  <Label>Dynamic Penalty Rates</Label>
                  <p className="text-sm text-muted-foreground -mt-2">
                    Set penalty percentages based on how much of the lock period remains
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="over75" className="text-sm">
                        &gt;75% Time Remaining
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="over75"
                          type="number"
                          min="0"
                          max="50"
                          value={dynamicRates.over_75_percent}
                          onChange={(e) =>
                            setDynamicRates({
                              ...dynamicRates,
                              over_75_percent: parseFloat(e.target.value),
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="over50" className="text-sm">
                        &gt;50% Time Remaining
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="over50"
                          type="number"
                          min="0"
                          max="50"
                          value={dynamicRates.over_50_percent}
                          onChange={(e) =>
                            setDynamicRates({
                              ...dynamicRates,
                              over_50_percent: parseFloat(e.target.value),
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="over25" className="text-sm">
                        &gt;25% Time Remaining
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="over25"
                          type="number"
                          min="0"
                          max="50"
                          value={dynamicRates.over_25_percent}
                          onChange={(e) =>
                            setDynamicRates({
                              ...dynamicRates,
                              over_25_percent: parseFloat(e.target.value),
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="under25" className="text-sm">
                        &lt;25% Time Remaining
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="under25"
                          type="number"
                          min="0"
                          max="50"
                          value={dynamicRates.under_25_percent}
                          onChange={(e) =>
                            setDynamicRates({
                              ...dynamicRates,
                              under_25_percent: parseFloat(e.target.value),
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
                    <p className="text-blue-800">
                      💡 <strong>Example:</strong> If a member has 9 months remaining on a 12-month lock 
                      (75% remaining), the penalty will be {dynamicRates.over_75_percent}%.
                    </p>
                  </div>
                </div>
              )}

              {/* Credit Score Penalty */}
              <div className="space-y-2">
                <Label htmlFor="creditPenalty">Credit Score Penalty</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="creditPenalty"
                    type="number"
                    min="0"
                    max="50"
                    value={creditPenalty}
                    onChange={(e) => setCreditPenalty(parseFloat(e.target.value))}
                  />
                  <span className="text-sm text-muted-foreground">points</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Points deducted from member's savings credibility score per early withdrawal
                </p>
              </div>

              {/* Reserve Balance Info */}
              {settings && settings.reserve_balance !== undefined && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-green-900">
                        Group Reserve Balance
                      </p>
                      <p className="text-xs text-green-700">
                        Accumulated from penalties and other sources
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      KES {settings.reserve_balance.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EarlyWithdrawalSettings;
