import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth, storeAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, UserCog, Settings, Trash2, Plus, KeyRound, Loader2 } from "lucide-react";

type AppRole = "admin" | "credit_officer" | "credit_committee" | "treasurer" | "auditor" | "member";

interface SystemConfig {
  interestRate: number;
  interestModel: "reducing" | "flat";
  processingFee: number;
  penaltyRate: number;
  autoApproveLimit: number;
  committeeThreshold: number;
  maxGuaranteeMultiplier: number;
  minGuarantors: number;
  minLiquidityRatio: number;
}

const ALL_ROLES: AppRole[] = ["admin", "credit_officer", "credit_committee", "treasurer", "auditor", "member"];

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin": return "destructive";
    case "credit_officer": return "default";
    case "credit_committee": return "secondary";
    case "treasurer": return "outline";
    case "auditor": return "secondary";
    default: return "outline";
  }
};

const BASE = (import.meta.env.VITE_SACCO_API_URL as string) || "http://localhost:5000/api";

export default function SettingsPage() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin");
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>("member");
  const [selectedUserId, setSelectedUserId] = useState("");

  // ─── System config ──────────────────────────────────────────────────────────
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["system-config"],
    queryFn: async () => {
      const res = await api.get("/config");
      return res as SystemConfig;
    },
  });

  const [cfg, setCfg] = useState<SystemConfig | null>(null);
  // Sync fetched config into local state (only once, or when fetch arrives)
  if (configData && !cfg) setCfg(configData);

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: SystemConfig) => {
      const res = await api.put("/config", payload);
      return res as SystemConfig;
    },
    onSuccess: (saved) => {
      setCfg(saved);
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      toast.success("Configuration saved — all staff have been notified.");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  function handleSaveConfig() {
    if (!cfg) return;
    saveConfigMutation.mutate(cfg);
  }

  function cfgNum(field: keyof SystemConfig) {
    return String((cfg as any)?.[field] ?? "");
  }
  function setCfgNum(field: keyof SystemConfig, value: string) {
    setCfg((prev) => prev ? { ...prev, [field]: Number(value) } : prev);
  }

  // Fetch all users with their roles
  const { data: allUsers = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res as any[];
    },
    enabled: isAdmin,
  });

  // Derive dropdown profiles from users
  const allProfiles = allUsers.map((u: any) => ({
    user_id: String(u._id),
    full_name: u.name || u.email || "Unknown",
  }));

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const foundUser = allUsers.find((u: any) => String(u._id) === userId);
      const existingRoles: string[] = foundUser?.roles ?? [];
      if (existingRoles.includes(role)) throw new Error("User already has this role");
      const updated = await api.put(`/users/${userId}/roles`, { roles: [...existingRoles, role] });
      return { userId, updated };
    },
    onSuccess: ({ userId, updated }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("Role assigned successfully");
      setSelectedUserId("");
      // If the admin edited their own roles, refresh localStorage immediately
      if (userId === user?.id) {
        const token = localStorage.getItem("smcf_auth_token");
        if (token) storeAuth(token, { ...user!, roles: (updated as any)?.roles ?? [] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message?.includes("already has") ? "User already has this role" : "Failed to assign role");
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const foundUser = allUsers.find((u: any) => String(u._id) === userId);
      const existingRoles: string[] = foundUser?.roles ?? [];
      const updated = await api.put(`/users/${userId}/roles`, { roles: existingRoles.filter((r) => r !== role) });
      return { userId, updated };
    },
    onSuccess: ({ userId, updated }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("Role removed");
      if (userId === user?.id) {
        const token = localStorage.getItem("smcf_auth_token");
        if (token) storeAuth(token, { ...user!, roles: (updated as any)?.roles ?? [] });
      }
    },
    onError: () => toast.error("Failed to remove role"),
  });

  // Group roles by user — only include users with at least one staff role
  const STAFF_ROLES = ["admin", "credit_officer", "credit_committee", "treasurer", "auditor"];
  const userMap = new Map<string, { full_name: string; roles: string[] }>();
  allUsers.forEach((u: any) => {
    const userRoles: string[] = u.roles ?? [];
    if (userRoles.some((r) => STAFF_ROLES.includes(r))) {
      userMap.set(String(u._id), {
        full_name: u.name || u.email || "Unknown",
        roles: userRoles,
      });
    }
  });

  const [setupLoading, setSetupLoading] = useState(false);

  const handleFirstRunSetup = async () => {
    if (!user?.email) return;
    setSetupLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Setup failed");
      } else {
        // Re-fetch the updated user and refresh the stored auth
        const meRes = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("smcf_auth_token")}` },
        });
        const meData = await meRes.json();
        if (meRes.ok && meData.data) {
          storeAuth(localStorage.getItem("smcf_auth_token")!, {
            id: meData.data._id,
            email: meData.data.email,
            fullName: meData.data.fullName,
            roles: meData.data.roles,
          });
        }
        toast.success("Admin access granted! The page will reload.");
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      toast.error("Network error – check backend connection");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-bold">System Settings</h1>
        <p className="text-muted-foreground text-sm">Configure governance policies and manage user access</p>
      </div>

      {/* First-run admin setup – only visible to non-admins */}
      {!isAdmin && (
        <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <KeyRound className="h-5 w-5" /> First-time Admin Setup
            </CardTitle>
            <CardDescription>
              Your account (<strong>{user?.email}</strong>) currently has the <em>member</em> role.
              Click below to promote it to <em>admin</em> — this only works if no admin exists yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleFirstRunSetup}
              disabled={setupLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {setupLoading ? "Setting up…" : "Grant Admin Access to My Account"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-4 w-4" /> Configuration
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="roles" className="gap-1.5">
              <Shield className="h-4 w-4" /> User Roles
            </TabsTrigger>
          )}
        </TabsList>

        {/* ───── System Configuration Tab ───── */}
        <TabsContent value="config" className="space-y-6 mt-4">
          {configLoading || !cfg ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
            </div>
          ) : (
            <>
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Interest Rate Configuration</CardTitle>
              <CardDescription>Set default loan interest parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Interest Rate (%)</Label>
                  <Input type="number" value={cfgNum("interestRate")} onChange={(e) => setCfgNum("interestRate", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Default Interest Model</Label>
                  <Select value={cfg.interestModel} onValueChange={(v) => setCfg((p) => p ? { ...p, interestModel: v as "reducing" | "flat" } : p)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reducing">Reducing Balance</SelectItem>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Processing Fee (%)</Label>
                  <Input type="number" value={cfgNum("processingFee")} onChange={(e) => setCfgNum("processingFee", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Penalty Rate (%)</Label>
                  <Input type="number" value={cfgNum("penaltyRate")} onChange={(e) => setCfgNum("penaltyRate", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Approval Thresholds</CardTitle>
              <CardDescription>Loan amounts requiring multi-level approval</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Auto-Approve Limit (KES)</Label>
                  <Input type="number" value={cfgNum("autoApproveLimit")} onChange={(e) => setCfgNum("autoApproveLimit", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Committee Threshold (KES)</Label>
                  <Input type="number" value={cfgNum("committeeThreshold")} onChange={(e) => setCfgNum("committeeThreshold", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Loans above committee threshold require board review.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Guarantor Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Guarantee Multiplier (×savings)</Label>
                  <Input type="number" value={cfgNum("maxGuaranteeMultiplier")} onChange={(e) => setCfgNum("maxGuaranteeMultiplier", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Min Guarantors Per Loan</Label>
                  <Input type="number" value={cfgNum("minGuarantors")} onChange={(e) => setCfgNum("minGuarantors", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Liquidity Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Minimum Liquidity Ratio (%)</Label>
                <Input type="number" value={cfgNum("minLiquidityRatio")} onChange={(e) => setCfgNum("minLiquidityRatio", e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                New loan approvals are blocked when liquidity drops below this threshold.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={saveConfigMutation.isPending} className="gap-2">
              {saveConfigMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </div>
            </>
          )}
        </TabsContent>

        {/* ───── User Roles Tab (Admin Only) ───── */}
        {isAdmin && (
          <TabsContent value="roles" className="space-y-6 mt-4">
            {/* Assign Role Card */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <UserCog className="h-5 w-5" /> Assign Role
                </CardTitle>
                <CardDescription>Grant a role to an existing user</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <Label>User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger><SelectValue placeholder="Select user…" /></SelectTrigger>
                      <SelectContent>
                        {allProfiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.full_name ?? p.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 min-w-[180px]">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => {
                      if (!selectedUserId) { toast.error("Select a user"); return; }
                      addRoleMutation.mutate({ userId: selectedUserId, role: selectedRole });
                    }}
                    disabled={addRoleMutation.isPending}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Assign
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Current Roles Table */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Current User Roles</CardTitle>
                <CardDescription>{userMap.size} users with assigned roles</CardDescription>
              </CardHeader>
              <CardContent>
                {rolesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...userMap.entries()].map(([userId, { full_name, roles }]) => (
                        <TableRow key={userId}>
                          <TableCell className="font-medium">{full_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {roles.map((r) => (
                              <Badge key={r} variant={roleBadgeVariant(r) as any}>
                                {r.replace("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {roles
                                .filter((r) => r !== "member")
                                .map((r) => (
                                  <Button
                                    key={r}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    title={`Remove ${r}`}
                                    onClick={() => removeRoleMutation.mutate({ userId, role: r })}
                                    disabled={removeRoleMutation.isPending}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
