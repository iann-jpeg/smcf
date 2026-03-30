import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_SACCO_API_URL || "http://localhost:5000/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("Reset token is missing. Please use the link from your email.");
      return;
    }

    if (!newPassword.trim()) {
      setError("Password is required");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to reset password. Please try again.");
        return;
      }

      setSubmitted(true);
      toast.success("Password reset successfully!");
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error) {
      setError("Network error – check your connection");
      toast.error("Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
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
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-red-100 p-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-red-900">Invalid Reset Link</h3>
                <p className="text-sm text-muted-foreground">
                  The password reset link is missing or invalid.
                </p>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/auth")}>Back to Login</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <CardDescription>Create New Password</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Enter a new password for your account. Make sure it's at least 6 characters long.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !newPassword || !confirmPassword}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/auth")}>Back to Login</Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-green-900">Password Reset Successful</h3>
                <p className="text-sm text-muted-foreground">
                  Your password has been successfully reset. You can now log in with your new password.
                </p>
              </div>
              <Button onClick={() => navigate('/auth')} className="w-full">Back to Login</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
