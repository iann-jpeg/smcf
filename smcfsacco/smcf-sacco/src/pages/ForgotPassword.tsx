import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const API_URL = (() => {
  const raw = String(import.meta.env.VITE_SACCO_API_URL || "").trim();
  return raw.endsWith("/api") ? raw : `${raw.replace(/\/+$/, "")}/api`;
})();
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    if (resendCooldownSeconds > 0) {
      toast.error(`Please wait ${resendCooldownSeconds}s before requesting another reset.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Math.max(1, Number(data?.retryAfterSeconds || DEFAULT_RESEND_COOLDOWN_SECONDS));
          setResendCooldownSeconds(retryAfter);
          toast.error(data.message || `Please wait ${retryAfter}s before trying again.`);
          return;
        }
        toast.error(data.message || "Failed to send reset email");
        return;
      }

      setResendCooldownSeconds(DEFAULT_RESEND_COOLDOWN_SECONDS);
      setSubmitted(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      setLoading(false);
      toast.error("Network error – check your connection");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldownSeconds > 0) {
      toast.error(`Please wait ${resendCooldownSeconds}s before requesting another reset.`);
      return;
    }
    handleSubmit(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 opacity-10 bg-cover bg-center auth-bg-image" />
      
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center space-y-4">
          <img 
            src={`${import.meta.env.BASE_URL}favicon.png`} 
            alt="SMCF SACCO" 
            className="mx-auto w-16 h-16 rounded-xl" 
          />
          <div>
            <CardTitle className="text-2xl font-heading">
              <span className="text-[#C9A227]">SMC</span>
              <span className="text-[#2D7A36]">F</span> SACCO
            </CardTitle>
            <CardDescription>Reset Your Password</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>

              <Button 
                type="button"
                variant="outline" 
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <br />
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left">
                <p className="text-xs text-blue-900">
                  <strong>Tip:</strong> The reset link will expire in 24 hours. If you don't see the email in a few minutes, 
                  check your spam folder.
                </p>
              </div>

              <Button 
                type="button"
                variant="outline" 
                className="w-full"
                disabled={resendCooldownSeconds > 0}
                onClick={handleResendEmail}
              >
                {resendCooldownSeconds > 0 
                  ? `Resend in ${resendCooldownSeconds}s`
                  : "Resend Reset Link"
                }
              </Button>

              <Button 
                type="button"
                variant="ghost" 
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
