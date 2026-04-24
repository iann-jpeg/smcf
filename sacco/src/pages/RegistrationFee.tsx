import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRegistrationFeeMembers, reconcileRegistrationFeeManual } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Clock3, Users, Search } from "lucide-react";
import { toast } from "sonner";

type FilterStatus = "all" | "paid" | "pending";

export default function RegistrationFee() {
  const { hasRole } = useAuth();
  const isAllowed = hasRole("admin") || hasRole("treasurer") || hasRole("credit_officer") || hasRole("auditor");
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualCode, setManualCode] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["registration-fee-members", status, search],
    queryFn: () => getRegistrationFeeMembers({ status, search: search.trim() || undefined }),
  });

  const reconcileManual = useMutation({
    mutationFn: () =>
      reconcileRegistrationFeeManual({
        phone: manualPhone.trim(),
        mpesaRef: manualCode.trim().toUpperCase(),
        amount: 100,
      }),
    onSuccess: () => {
      toast.success("Manual registration fee reconciliation completed");
      setManualPhone("");
      setManualCode("");
      queryClient.invalidateQueries({ queryKey: ["registration-fee-members"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to reconcile manual payment";
      toast.error(message);
    },
  });

  const members = useMemo(() => data?.members ?? [], [data]);
  const summary = data?.summary || { totalMembers: 0, paid: 0, pending: 0 };

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const needle = search.trim().toLowerCase();
    return members.filter((m) =>
      [m.name, m.memberId, m.phone || "", m.registrationFeeMpesaCode || ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [members, search]);

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Registration Fee</h1>
        <p className="text-sm text-muted-foreground">Track one-time KES 100 registration fee payment for all members.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-700" /> Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{summary.paid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock3 className="h-4 w-4 text-green-600" /> Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{summary.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual Reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <Label>Member Phone</Label>
            <Input placeholder="07xx... or 2547..." value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>M-Pesa Code</Label>
            <Input placeholder="ABC123XYZ" value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => reconcileManual.mutate()}
              disabled={reconcileManual.isPending || !manualPhone.trim() || !manualCode.trim()}
              className="w-full"
            >
              {reconcileManual.isPending ? "Reconciling..." : "Reconcile KES 100"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <Button variant={status === "all" ? "default" : "outline"} size="sm" onClick={() => setStatus("all")}>All</Button>
              <Button variant={status === "paid" ? "default" : "outline"} size="sm" onClick={() => setStatus("paid")}>Paid</Button>
              <Button variant={status === "pending" ? "default" : "outline"} size="sm" onClick={() => setStatus("pending")}>Pending</Button>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search member name, phone, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member Name</TableHead>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>M-Pesa Code</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading registration fee data...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No members found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="font-mono text-xs">{m.memberId}</TableCell>
                      <TableCell>{m.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={m.registrationFeePaid ? "default" : "outline"}>
                          {m.registrationFeePaid ? "Paid" : "Not Paid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.registrationFeeMpesaCode || "-"}</TableCell>
                      <TableCell>{m.registrationFeeDate ? new Date(m.registrationFeeDate).toLocaleString() : "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
