import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_SACCO_API_URL || "http://localhost:5000/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to send reset email");
        return;
      }

      setSubmitted(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      toast.error("Network error – check your connection");
    } finally {
      setLoading(false);
    }
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
                  Enter your email address and we’ll send you a link to reset your password.
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                Back to Login
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <span className="h-6 w-6 text-green-600">✓</span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  Reset link sent to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
