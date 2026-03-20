import { useState } from "react";
import { Mail, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MemberMessageComposerProps {
  mode: "authenticated" | "public";
  source: "member-dashboard" | "members-section" | "landing-page";
  title?: string;
  compact?: boolean;
}

interface MemberMessageRequest {
  source: "member-dashboard" | "members-section" | "landing-page";
  subject: string;
  message: string;
  sender_name?: string;
  sender_contact?: string;
}

export default function MemberMessageComposer({ mode, source, title = "Send Message to Admin", compact = false }: MemberMessageComposerProps) {
  const [senderName, setSenderName] = useState("");
  const [senderContact, setSenderContact] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const payload: MemberMessageRequest = {
      source,
      subject: subject.trim(),
      message: message.trim(),
    };

    if (mode === "public") {
      payload.sender_name = senderName.trim();
      payload.sender_contact = senderContact.trim();
      if (!payload.sender_name) {
        toast.error("Please enter your name");
        return;
      }
    }

    if (!payload.subject || !payload.message) {
      toast.error("Subject and message are required");
      return;
    }

    setSending(true);
    try {
      const endpoint = mode === "public" ? `${API_BASE}/api/member-messages/public` : `${API_BASE}/api/member-messages`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (mode === "authenticated") {
        Object.assign(headers, authService.getAuthHeaders());
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to send message");
      }

      toast.success("Message sent to admin");
      setSubject("");
      setMessage("");
      if (mode === "public") {
        setSenderName("");
        setSenderContact("");
      }
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : "Failed to send message";
      toast.error(messageText);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> {title}
        </CardTitle>
        <CardDescription>Write directly to the admin team. They will review your message in the admin inbox.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === "public" && (
          <>
            <div className="space-y-1">
              <Label>Your Name</Label>
              <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="e.g. Jane Doe" />
            </div>
            <div className="space-y-1">
              <Label>Contact (Phone or Email)</Label>
              <Input value={senderContact} onChange={(e) => setSenderContact(e.target.value)} placeholder="e.g. 07xx xxx xxx" />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={180} placeholder="Message subject" />
        </div>

        <div className="space-y-1">
          <Label>Message</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            className={compact ? "min-h-[120px]" : "min-h-[180px]"}
            placeholder="Type your message to the admin team..."
          />
        </div>

        <Button type="button" onClick={submit} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send Message
        </Button>
      </CardContent>
    </Card>
  );
}
