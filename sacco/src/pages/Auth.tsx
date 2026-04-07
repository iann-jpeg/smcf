import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { storeAuth } from "@/hooks/useAuth";

const API_URL = (() => {
  const raw = String(import.meta.env.VITE_SACCO_API_URL || "").trim();
  return raw.endsWith("/api") ? raw : `${raw.replace(/\/+$/, "")}/api`;
})();
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tab, setTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  
  // Email verification states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [fallbackCode, setFallbackCode] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  // Check if there's a verification token in URL
  const tokenFromUrl = searchParams.get('token');
  if (tokenFromUrl && !verificationToken && !showVerificationModal) {
    setVerificationToken(tokenFromUrl);
    setShowVerificationModal(true);
  }

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendCooldownSeconds]);

  // Use backend REST API for login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const identifierValue = email.trim();
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifierValue,
          email: identifierValue,
          memberId: identifierValue,
          password,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        if (data.requiresEmailVerification) {
          toast.error("Please verify your email before logging in");
          setVerificationEmail(data.email || email);
          setShowVerificationModal(true);
          setTab("signup");
        } else {
          toast.error(data.message || "Login failed");
        }
      } else {
        storeAuth(data.data.token, data.data.user);
        toast.success("Login successful!");
        navigate("/");
      }
    } catch (error) {
      setLoading(false);
      toast.error("Network error – check your connection");
    }
  };

  // Use backend REST API for signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        toast.error(data.message || "Signup failed");
      } else {
        // Show verification modal
        if (data.requiresEmailVerification || data?.data?.requiresEmailVerification) {
          setVerificationEmail((data?.data?.user?.email || email || "").trim());
          const tokenFromApi = String(data?.data?.verificationToken || data?.verificationToken || "").trim();
          if (tokenFromApi) {
            setFallbackCode(tokenFromApi);
            setVerificationToken(tokenFromApi);
          } else {
            setFallbackCode("");
          }
          setShowVerificationModal(true);
          toast.success(data?.message || "Account created! Please verify your email.");
          // Clear form
          setPassword("");
          setFullName("");
        }
      }
    } catch (error) {
      setLoading(false);
      toast.error("Network error – check your connection");
    }
  };

  // Verify email with token
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    setVerifyingEmail(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.message || "Verification failed");
      } else {
        toast.success("Email verified successfully!");
        setShowVerificationModal(false);
        setVerificationToken("");
        setVerificationEmail("");
        
        // Redirect to login tab
        setTab("login");
        setEmail(verificationEmail || "");
      }
    } catch (error) {
      toast.error("Verification failed – check your connection");
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Resend verification email
  const handleResendVerificationEmail = async () => {
    if (!verificationEmail.trim()) {
      toast.error("Email address is required");
      return;
    }

    if (resendCooldownSeconds > 0) {
      toast.error(`Please wait ${resendCooldownSeconds}s before requesting another code.`);
      return;
    }

    setResendingEmail(true);
    try {
      const res = await fetch(`${API_URL}/auth/resend-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Math.max(1, Number(data?.retryAfterSeconds || DEFAULT_RESEND_COOLDOWN_SECONDS));
          setResendCooldownSeconds(retryAfter);
          toast.error(data.message || `Please wait ${retryAfter}s before requesting another code.`);
          return;
        }

        toast.error(data.message || "Failed to resend email");
      } else {
        setResendCooldownSeconds(DEFAULT_RESEND_COOLDOWN_SECONDS);
        const tokenFromApi = String(data?.data?.verificationToken || data?.verificationToken || "").trim();
        if (tokenFromApi) {
          setFallbackCode(tokenFromApi);
          setVerificationToken(tokenFromApi);
          toast.success("Email service unavailable. Use the one-time code shown in the dialog.");
        } else {
          setFallbackCode("");
          toast.success("Verification email sent! Check your inbox.");
        }
      }
    } catch (error) {
      toast.error("Failed to resend – check your connection");
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 opacity-10 bg-cover bg-center auth-bg-image" />
      
      {/* Main Auth Card */}
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center space-y-4">
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="SMCF SACCO" className="mx-auto w-16 h-16 rounded-xl" />
          <div>
            <CardTitle className="text-2xl font-heading"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO</CardTitle>
            <CardDescription>Empowering Members Through Financial Excellence</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-identifier">Email or Member ID</Label>
                  <Input
                    id="login-identifier"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com or SMCF-0001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="pr-10" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>

              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Minimum 6 characters" minLength={6} className="pr-10" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-2">
              <div className="flex justify-center mb-2">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <CardTitle>Verify Your Email</CardTitle>
              <CardDescription>
                We sent a verification code to<br />
                <span className="font-semibold text-foreground">{verificationEmail}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleVerifyEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verify-token">Verification Code</Label>
                  <Input
                    id="verify-token"
                    type="text"
                    placeholder="Paste the code from your email"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value)}
                    disabled={tokenFromUrl ? true : false}
                  />
                  {tokenFromUrl && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Code from email detected
                    </p>
                  )}
                  {fallbackCode && (
                    <p className="text-xs text-amber-600">
                      Email delivery is currently unavailable. Use this one-time code: <span className="font-mono font-semibold">{fallbackCode}</span>
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifyingEmail || !verificationToken.trim()}
                >
                  {verifyingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Email
                </Button>
              </form>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  Didn't receive the code?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendVerificationEmail}
                  disabled={resendingEmail || resendCooldownSeconds > 0}
                >
                  {resendingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {resendCooldownSeconds > 0 ? `Resend in ${resendCooldownSeconds}s` : "Resend Code"}
                </Button>
                {resendCooldownSeconds > 0 && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    You can request another code when the timer ends.
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowVerificationModal(false);
                  setVerificationToken("");
                  setVerificationEmail("");
                  setFallbackCode("");
                }}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
