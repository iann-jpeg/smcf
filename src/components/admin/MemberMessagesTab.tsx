import { useEffect, useState } from "react";
import { Loader2, MailOpen } from "lucide-react";
import io from "socket.io-client";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNotification } from "@/hooks/use-notification";

interface MemberMessage {
  _id: string;
  created_at?: string;
  createdAt?: string;
  sender_name: string;
  sender_contact?: string;
  source: string;
  subject: string;
  message: string;
  status: "new" | "read";
}

export default function MemberMessagesTab() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MemberMessage[]>([]);
  const { notifyInfo } = useNotification();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/member-messages`, {
        headers: { ...authService.getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || "Failed to load messages");
      setMessages(Array.isArray(data?.data) ? data.data : []);
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : "Failed to load member messages";
      toast.error(messageText);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const socket = io(API_BASE, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socket.on("member-message:new", (incoming: MemberMessage) => {
      setMessages((prev) => [incoming, ...prev.filter((m) => m._id !== incoming._id)]);
      notifyInfo(
        "New Member Activity",
        `${incoming.sender_name} sent: ${incoming.subject}`,
        { messageId: incoming._id, source: incoming.source }
      );
    });

    socket.on("member-message:read", (payload: { _id: string; status: "read" }) => {
      setMessages((prev) => prev.map((m) => (m._id === payload._id ? { ...m, status: "read" } : m)));
    });

    return () => {
      socket.off("member-message:new");
      socket.off("member-message:read");
      socket.disconnect();
    };
  }, [notifyInfo]);

  const markRead = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/member-messages/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authService.getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || "Failed to mark as read");
      setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, status: "read", read_at: new Date().toISOString() } : m)));
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : "Failed to mark as read";
      toast.error(messageText);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Messages Inbox</CardTitle>
        <CardDescription>Messages submitted from member dashboard, members section, and landing page.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading messages...</div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No member messages yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((m) => (
                <TableRow key={m._id}>
                  <TableCell className="text-xs">{new Date(m.created_at || m.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{m.sender_name}</div>
                    <div className="text-xs text-muted-foreground">{m.sender_contact || "No contact"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{m.source}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{m.subject}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{m.message}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === "new" ? "destructive" : "secondary"}>{m.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {m.status === "new" ? (
                      <Button size="sm" variant="outline" onClick={() => markRead(m._id)}>
                        <MailOpen className="h-3.5 w-3.5 mr-1" /> Mark Read
                      </Button>
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
  );
}
