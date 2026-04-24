import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Mail, Send, TestTubeDiagonal, Loader2, MailOpen } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  normalizeMember,
  getAdminCommsHealthStatus,
  getAdminMemberMessages,
  getMainSmcfBridgeMessages,
  getAdminEmailBroadcastHistory,
  markAdminMemberMessageRead,
  sendAdminEmailBroadcast,
  type AdminCommsHealthStatus,
  type AdminEmailBroadcastResponse,
  type MemberMessageItem,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { playNotificationSound } from "@/lib/sound";

type RecipientDirectoryItem = {
  id: string;
  memberId: string;
  memberCode: string;
  name: string;
  email: string;
  source: "member-profile" | "signup-account";
};

export default function AdminEmail() {
  const maskEmail = (value?: string | null): string => {
    if (!value) return "";
    const [local, domain] = value.split("@");
    if (!domain) return value;
    const maskedLocal = local.length <= 2
      ? `${local.charAt(0)}*`
      : `${local.charAt(0)}${"*".repeat(Math.max(1, local.length - 2))}${local.charAt(local.length - 1)}`;
    const domainParts = domain.split(".");
    const domainName = domainParts[0] || "";
    const maskedDomain = domainName.length <= 2
      ? `${domainName.charAt(0)}*`
      : `${domainName.charAt(0)}${"*".repeat(Math.max(1, domainName.length - 2))}${domainName.charAt(domainName.length - 1)}`;
    const suffix = domainParts.length > 1 ? `.${domainParts.slice(1).join(".")}` : "";
    return `${maskedLocal}@${maskedDomain}${suffix}`;
  };
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [templateMode, setTemplateMode] = useState<"plain" | "branded">("plain");
  const [recipientMode, setRecipientMode] = useState<"filters" | "manual">("filters");
  const [filters, setFilters] = useState({
    staffOnly: false,
    activeMembersOnly: false,
    verifiedUsersOnly: false,
  });
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [recipientSearch, setRecipientSearch] = useState("");
  const [lastResult, setLastResult] = useState<AdminEmailBroadcastResponse | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const seededMessageIdsRef = useRef(false);

  const showMessageActivityToast = (subjectText: string, description: string) => {
    const text = subjectText.toLowerCase();
    if (text.includes("urgent") || text.includes("failed") || text.includes("error")) {
      toast.error("New member activity", { description });
      return;
    }
    if (text.includes("loan") || text.includes("withdraw") || text.includes("payment")) {
      toast.warning("New member activity", { description });
      return;
    }
    toast.info("New member activity", { description });
  };

  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["admin-email-history"],
    queryFn: getAdminEmailBroadcastHistory,
  });

  const { data: recipientMembers = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ["admin-email-recipient-members"],
    queryFn: async () => {
      const res = await api.get("/members");
      const arr = Array.isArray(res) ? res : (res as any)?.data ?? [];
      const items: RecipientDirectoryItem[] = [];
      const seen = new Set<string>();

      const pushEmail = (
        memberDbId: string,
        memberCode: string,
        name: string,
        emailValue: unknown,
        source: RecipientDirectoryItem["source"]
      ) => {
        const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
        if (!memberDbId || !email || !email.includes("@")) return;
        const key = `${memberDbId}:${email}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          id: key,
          memberId: memberDbId,
          memberCode,
          name,
          email,
          source,
        });
      };

      arr.forEach((raw: any) => {
        const m = normalizeMember(raw);
        const memberDbId = String(m.id || m._id || "").trim();
        const memberCode = String(m.member_id || raw?.memberId || raw?.member_id || "").trim();
        const name = String(raw?.name || raw?.fullName || raw?.full_name || "Unnamed Member").trim();

        // Email captured on member profile
        pushEmail(memberDbId, memberCode, name, raw?.email, "member-profile");
        // Email used during account signup (populated via userId)
        pushEmail(memberDbId, memberCode, name, raw?.userId?.email, "signup-account");
      });

      return items;
    },
    enabled: recipientMode === "manual",
  });

  const {
    data: commsHealth,
    isLoading: commsHealthLoading,
    refetch: refetchCommsHealth,
  } = useQuery<AdminCommsHealthStatus>({
    queryKey: ["admin-comms-health"],
    queryFn: getAdminCommsHealthStatus,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: memberMessages = [], isLoading: memberMessagesLoading, refetch: refetchMemberMessages } = useQuery({
    queryKey: ["admin-member-messages"],
    queryFn: getAdminMemberMessages,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const {
    data: mainBridgeMessages = [],
    isLoading: mainBridgeLoading,
    refetch: refetchMainBridgeMessages,
  } = useQuery({
    queryKey: ["admin-main-smcf-bridge-messages"],
    queryFn: getMainSmcfBridgeMessages,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const combinedMemberMessages = useMemo(() => {
    const local = memberMessages.map((m) => ({ ...m, origin: "sacco" as const }));
    const external = mainBridgeMessages.map((m) => ({ ...m, origin: "main-smcf" as const }));

    return [...local, ...external].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [memberMessages, mainBridgeMessages]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markAdminMemberMessageRead(id),
    onSuccess: () => {
      refetchMemberMessages();
      refetchMainBridgeMessages();
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to mark message as read";
      toast.error(msg);
    },
  });

  useEffect(() => {
    const ids = new Set(combinedMemberMessages.map((m) => `${m.origin || "sacco"}:${m._id}`));

    if (!seededMessageIdsRef.current) {
      seenMessageIdsRef.current = ids;
      seededMessageIdsRef.current = true;
      return;
    }

    const newcomers = combinedMemberMessages.filter((m) => !seenMessageIdsRef.current.has(`${m.origin || "sacco"}:${m._id}`));
    if (newcomers.length === 0) {
      return;
    }

    for (const m of newcomers) {
      seenMessageIdsRef.current.add(`${m.origin || "sacco"}:${m._id}`);
    }

    const latest = newcomers[0];
    playNotificationSound();
    showMessageActivityToast(latest.subject, `${latest.senderName} sent: ${latest.subject}`);
  }, [combinedMemberMessages]);

  const filteredRecipientMembers = useMemo(() => {
    const term = recipientSearch.trim().toLowerCase();
    if (!term) return recipientMembers;
    return recipientMembers.filter((m: any) => {
      const haystack = `${m.name} ${m.email} ${m.memberId}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [recipientMembers, recipientSearch]);

  const selectedRecipientEmails = useMemo(() => {
    if (recipientMode !== "manual") return [] as string[];
    return recipientMembers
      .filter((m: any) => selectedMemberIds.has(m.id))
      .map((m: any) => m.email)
      .filter(Boolean);
  }, [recipientMode, recipientMembers, selectedMemberIds]);

  const selectedSystemMemberIds = useMemo(() => {
    if (recipientMode !== "manual") return [] as string[];
    return Array.from(
      new Set(
        recipientMembers
          .filter((m: any) => selectedMemberIds.has(m.id))
          .map((m: any) => m.memberId)
          .filter(Boolean)
      )
    );
  }, [recipientMode, recipientMembers, selectedMemberIds]);

  const canSubmit = useMemo(() => {
    if (recipientMode === "manual") {
      return (
        subject.trim().length > 0 &&
        message.trim().length > 0 &&
        selectedMemberIds.size > 0
      );
    }
    return subject.trim().length > 0 && message.trim().length > 0;
  }, [subject, message, recipientMode, selectedMemberIds]);

  const sourceLabel = (source: string) => {
    if (source === "landing-page") return "Landing Page Message Center";
    if (source === "member-dashboard") return "Member Dashboard";
    if (source === "members-section") return "Members Section";
    return source;
  };

  const runBroadcast = useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }) => {
      return sendAdminEmailBroadcast({
        subject: subject.trim(),
        message: message.trim(),
        dryRun,
        isHtml: false,
        templateMode,
        recipientMode,
        filters: recipientMode === "filters" ? filters : undefined,
        selectedMemberIds: recipientMode === "manual" ? selectedSystemMemberIds : undefined,
        manualEmails: recipientMode === "manual" ? selectedRecipientEmails : undefined,
      });
    },
    onSuccess: (payload, vars) => {
      setLastResult(payload);
      if (vars.dryRun) {
        toast.success(`Dry run complete. ${payload.recipients.dedupedTotal} deduplicated recipients found.`);
      } else {
        const sent = payload.delivery?.sent ?? 0;
        const failed = payload.delivery?.failed ?? 0;
        toast.success(`Broadcast complete: ${sent} sent, ${failed} failed.`);
        refetchHistory();
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to send admin email";
      toast.error(message);
    },
  });

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const sending = runBroadcast.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-bold">Admin Communications</h1>
        <p className="text-muted-foreground text-sm">Compose and deliver email to all user emails in the system (Users + Members, deduplicated).</p>
      </div>

      <Alert>
        <Mail className="h-4 w-4" />
        <AlertTitle>Service Status</AlertTitle>
        <AlertDescription>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">Email API:</span>
            {commsHealthLoading ? (
              <Badge variant="secondary">Checking...</Badge>
            ) : commsHealth?.emailApi.ok ? (
              <Badge className="bg-emerald-600 text-white">Online</Badge>
            ) : (
              <Badge variant="destructive">
                Offline{commsHealth?.emailApi.status ? ` (${commsHealth.emailApi.status})` : ""}
              </Badge>
            )}

            <span className="ml-2 font-medium">Bridge API:</span>
            {commsHealthLoading ? (
              <Badge variant="secondary">Checking...</Badge>
            ) : !commsHealth?.bridgeApi.configured ? (
              <Badge variant="secondary">Optional (Not Configured)</Badge>
            ) : commsHealth?.bridgeApi.ok ? (
              <Badge className="bg-emerald-600 text-white">Online</Badge>
            ) : (
              <Badge variant="secondary">
                Optional - Unavailable{commsHealth?.bridgeApi.status ? ` (${commsHealth.bridgeApi.status})` : ""}
              </Badge>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2"
              onClick={() => refetchCommsHealth()}
            >
              Refresh
            </Button>
          </div>
          {!commsHealthLoading && commsHealth && (
            <div className="mt-2 text-xs text-muted-foreground space-y-1">
              {!commsHealth.emailApi.ok && (
                <p>Email API detail: {commsHealth.emailApi.message || "No response"}</p>
              )}
              {commsHealth.bridgeApi.configured && !commsHealth.bridgeApi.ok && (
                <p>Bridge API detail: {commsHealth.bridgeApi.message || "No response"} (optional integration, does not block SACCO email send).</p>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Mail className="h-5 w-5" /> Compose Email
          </CardTitle>
          <CardDescription>
            Use dry run first to verify audience size before live delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={180}
              placeholder="e.g. SACCO Annual General Meeting Notice"
            />
            <p className="text-xs text-muted-foreground">{subject.length}/180</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={10000}
              className="min-h-[220px]"
              placeholder="Type the email message to send to all recipients..."
            />
            <p className="text-xs text-muted-foreground">{message.length}/10000</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email Template Mode</Label>
              <Select value={templateMode} onValueChange={(v) => setTemplateMode(v as "plain" | "branded")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain</SelectItem>
                  <SelectItem value="branded">Branded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recipient Mode</Label>
              <Select value={recipientMode} onValueChange={(v) => setRecipientMode(v as "filters" | "manual")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filters">Use Filters</SelectItem>
                  <SelectItem value="manual">Select Specific Recipients</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {recipientMode === "filters" && (
            <div className="space-y-2">
              <Label>Recipient Filters</Label>
              <div className="space-y-2 border rounded-md p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.staffOnly}
                    onCheckedChange={(checked) => setFilters((p) => ({ ...p, staffOnly: Boolean(checked) }))}
                  />
                  Staff only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.activeMembersOnly}
                    onCheckedChange={(checked) => setFilters((p) => ({ ...p, activeMembersOnly: Boolean(checked) }))}
                  />
                  Active members only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.verifiedUsersOnly}
                    onCheckedChange={(checked) => setFilters((p) => ({ ...p, verifiedUsersOnly: Boolean(checked) }))}
                  />
                  Verified users only
                </label>
              </div>
            </div>
          )}

          {recipientMode === "manual" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="recipient-search">Select Recipients (All System Emails)</Label>
                <Input
                  id="recipient-search"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Search by name, member ID, or email..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMemberIds(new Set(recipientMembers.map((m: any) => m.id)));
                  }}
                  disabled={recipientsLoading || recipientMembers.length === 0}
                >
                  Select All Emails
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMemberIds(new Set(filteredRecipientMembers.map((m: any) => m.id)));
                  }}
                  disabled={recipientsLoading || filteredRecipientMembers.length === 0}
                >
                  Select Visible
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMemberIds(new Set())}
                  disabled={selectedMemberIds.size === 0}
                >
                  Clear
                </Button>
                <Badge variant="secondary">Selected: {selectedMemberIds.size}</Badge>
              </div>

              <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-2">
                {recipientsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading all system emails...
                  </div>
                ) : filteredRecipientMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No system emails found.</p>
                ) : (
                  filteredRecipientMembers.map((m: any) => (
                    <label key={m.id} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={selectedMemberIds.has(m.id)}
                        onCheckedChange={(checked) => {
                          setSelectedMemberIds((prev) => {
                            const next = new Set(prev);
                            if (Boolean(checked)) {
                              next.add(m.id);
                            } else {
                              next.delete(m.id);
                            }
                            return next;
                          });
                        }}
                      />
                      <span className="leading-tight">
                        <span className="font-medium">{m.name}</span>
                        <span className="block text-xs text-muted-foreground">{maskEmail(m.email)}</span>
                        {m.memberCode ? (
                          <span className="block text-[11px] text-muted-foreground">ID: {m.memberCode}</span>
                        ) : null}
                        <span className="block text-[11px] text-muted-foreground/80">
                          Source: {m.source === "signup-account" ? "Sign-up Account Email" : "Member Profile Email"}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!canSubmit || sending}
              onClick={() => runBroadcast.mutate({ dryRun: true })}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTubeDiagonal className="h-4 w-4 mr-2" />}
              Dry Run
            </Button>

            <Button
              type="button"
              disabled={!canSubmit || sending}
              onClick={() => {
                const confirmed = window.confirm(
                  recipientMode === "manual"
                    ? `Send this email to ${selectedMemberIds.size} selected recipient(s) now?`
                    : "Send this email to all deduplicated user emails in the system now?"
                );
                if (confirmed) runBroadcast.mutate({ dryRun: false });
              }}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastResult && (
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertTitle>{lastResult.dryRun ? "Dry Run Summary" : "Delivery Summary"}</AlertTitle>
          <AlertDescription>
            <div className="space-y-1">
              <p>From Users: {lastResult.recipients.fromUsers}</p>
              <p>From Members: {lastResult.recipients.fromMembers}</p>
              <p>Deduplicated Total: {lastResult.recipients.dedupedTotal}</p>
              {lastResult.recipients.skippedByCap > 0 && <p>Skipped by cap: {lastResult.recipients.skippedByCap}</p>}
              {lastResult.delivery && (
                <>
                  <p>Sent: {lastResult.delivery.sent}</p>
                  <p>Failed: {lastResult.delivery.failed}</p>
                </>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Sent Email History</CardTitle>
          <CardDescription>Recent admin broadcasts with filters and delivery performance.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcasts have been sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Filters</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => {
                  const filterTags = [
                    item.filters?.staffOnly ? "staff" : null,
                    item.filters?.activeMembersOnly ? "active members" : null,
                    item.filters?.verifiedUsersOnly ? "verified users" : null,
                  ].filter(Boolean);

                  return (
                    <TableRow key={item._id}>
                      <TableCell className="text-xs">{new Date(item.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.subject}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{item.messagePreview}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.templateMode === "branded" ? "default" : "secondary"}>{item.templateMode}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {filterTags.length > 0 ? filterTags.join(", ") : "none"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.delivery.sent}/{item.recipients.attempted} sent
                        {item.delivery.failed > 0 ? `, ${item.delivery.failed} failed` : ""}
                      </TableCell>
                      <TableCell className="text-xs">{item.createdBy?.fullName || item.createdBy?.email || "admin"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Member Messages Inbox</CardTitle>
          <CardDescription>
            Delivery inbox for messages sent from the landing page message center and member dashboards (including Main SMCF bridge feed).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(memberMessagesLoading || mainBridgeLoading) ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading member messages...
            </div>
          ) : combinedMemberMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No member messages yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedMemberMessages.map((msg: MemberMessageItem & { origin: "sacco" | "main-smcf" }) => (
                  <TableRow key={`${msg.origin}:${msg._id}`}>
                    <TableCell className="text-xs">{new Date(msg.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{msg.senderName}</div>
                      <div className="text-xs text-muted-foreground">{msg.senderContact || "No contact"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={msg.origin === "main-smcf" ? "outline" : "secondary"}>
                        {msg.origin === "main-smcf" ? "Main SMCF" : "SACCO"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{sourceLabel(msg.source)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{msg.subject}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{msg.message}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={msg.status === "new" ? "destructive" : "secondary"}>{msg.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {msg.status === "new" && msg.origin === "sacco" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markReadMutation.mutate(msg._id)}
                          disabled={markReadMutation.isPending}
                        >
                          <MailOpen className="h-3.5 w-3.5 mr-1" /> Mark Read
                        </Button>
                      ) : msg.status === "new" && msg.origin === "main-smcf" ? (
                        <span className="text-xs text-muted-foreground">Read in Main SMCF admin</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Read</span>
                      )}
                    </TableCell>
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
