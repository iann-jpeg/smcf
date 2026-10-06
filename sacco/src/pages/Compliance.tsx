import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useUserActivity } from "@/hooks/useUserActivity";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Eye, Activity } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function Compliance() {
  const { data: auditLogs = [], isLoading: logsLoading } = useAuditLogs();
  const { data: activities = [], isLoading: activitiesLoading } = useUserActivity();
  const { data: members = [] } = useMembers();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const kycVerified = members.filter((m: any) => m.kyc_verified).length;
  const totalMembers = members.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Compliance & Audit</h1>
            <p className="text-muted-foreground text-sm">Immutable audit trail &mdash; no deletions allowed</p>
          </div>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link to="/admin-email">Open Admin Communications</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">KYC Verified</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-heading font-bold">{kycVerified} <span className="text-sm font-body text-muted-foreground">/ {totalMembers}</span></p></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Activity className="h-4 w-4" /> User Activity & Sessions
            </CardTitle>
            <p className="text-sm text-muted-foreground">Login, exit, action, and search activity. Search terms are not stored.</p>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? <Skeleton className="h-40 w-full" /> : activities.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No user activity recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Event</TableHead><TableHead>What happened</TableHead><TableHead>Details</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {activities.map((activity: any) => (
                      <TableRow key={activity.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{format(new Date(activity.created_at), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                        <TableCell className="min-w-[160px] text-sm">{activity.user_name || activity.user_email || "Unknown user"}</TableCell>
                        <TableCell><Badge variant={activity.event === "login" ? "default" : activity.event === "search" ? "secondary" : "outline"}>{activity.event}</Badge></TableCell>
                        <TableCell className="text-sm">{activity.action}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {activity.event === "search"
                            ? `${activity.search_categories.join(", ")} · ${activity.result_count ?? 0} results`
                            : activity.path || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{activity.ip_address || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Members</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-heading font-bold">{totalMembers}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Audit Entries</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-heading font-bold">{auditLogs.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Eye className="h-4 w-4" /> Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No audit log entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                    <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                    <TableCell className="text-sm">{log.table_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{log.record_id ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{log.ip_address ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
