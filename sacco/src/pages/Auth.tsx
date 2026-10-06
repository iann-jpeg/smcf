import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff, CheckCircle2, Mail, ShieldCheck, WalletCards, UsersRound, Target } from "lucide-react";
import { toast } from "sonner";
import { storeAuth } from "@/hooks/useAuth";
import { fetchFromSaccoApi } from "@/lib/saccoApiBase";

const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_LOGIN_COOLDOWN_SECONDS = 30;

const getRetryAfterSeconds = (res: Response, data: unknown, fallbackSeconds: number): number => {
  const fromBody = Number((data as { retryAfterSeconds?: number })?.retryAfterSeconds);
  if (Number.isFinite(fromBody) && fromBody > 0) {
    return Math.ceil(fromBody);
  }

  const headerValue = res.headers.get("retry-after") || res.headers.get("ratelimit-reset");
  const headerNumber = Number(headerValue);
  if (Number.isFinite(headerNumber) && headerNumber > 0) {
    if (headerNumber > 1000000000) {
      return Math.max(1, Math.ceil(headerNumber - Date.now() / 1000));
    }
    return Math.ceil(headerNumber);
  }

  return fallbackSeconds;
};

const getLoginErrorMessage = (status: number, data: Record<string, unknown>): string => {
  const rawMessage = String(data.message || data.error || "").trim();
  const lower = rawMessage.toLowerCase();

  if (status === 400) {
    if (lower.includes("username and password required") || lower.includes("email and password required")) {
      return "Email and password are required.";
    }
    return rawMessage || "Invalid login request. Please check your email and password.";
  }

  if (status === 401) {
    return rawMessage || "Invalid email or password.";
  }

  if (status === 403) {
    return rawMessage || "Login request was blocked. Please try again.";
  }

  if (/captcha/i.test(rawMessage)) {
    return "Invalid email or password.";
  }

  return rawMessage || "Login failed";
};

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tab, setTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginCooldownSeconds, setLoginCooldownSeconds] = useState(0);
  
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

  useEffect(() => {
    if (loginCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setLoginCooldownSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loginCooldownSeconds]);

  // Use backend REST API for login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginCooldownSeconds > 0) {
      toast.error(`Please wait ${loginCooldownSeconds}s before trying again.`);
      return;
    }
    setLoading(true);
    try {
      const identifierValue = email.trim();
      const res = await fetchFromSaccoApi(`/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identifierValue,
          username: identifierValue,
          identifier: identifierValue,
          password,
        }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfterSeconds = getRetryAfterSeconds(res, data, DEFAULT_LOGIN_COOLDOWN_SECONDS);
          setLoginCooldownSeconds(retryAfterSeconds);
          toast.error(String((data as { message?: string }).message || `Too many requests. Please wait ${retryAfterSeconds}s before trying again.`));
          return;
        }
        if ((data as { requiresEmailVerification?: boolean }).requiresEmailVerification) {
          toast.error("Please verify your email before logging in");
          setVerificationEmail(String((data as { email?: string }).email || email));
          setShowVerificationModal(true);
          setTab("signup");
        } else {
          toast.error(getLoginErrorMessage(res.status, data as Record<string, unknown>));
        }
      } else {
        const rawUser = data?.data?.user || data?.user || {};
        const token = data?.data?.token || data?.token;
        const normalizedUser = {
          id: String(rawUser.id || rawUser._id || rawUser.userId || ""),
          email: String(rawUser.email || identifierValue),
          fullName: rawUser.fullName || rawUser.name || undefined,
          roles: Array.isArray(rawUser.roles)
            ? rawUser.roles.map((role: unknown) => String(role))
            : rawUser.role
              ? [String(rawUser.role)]
              : ["member"],
          sessionId: String(data?.data?.sessionId || ""),
        };

        if (!token || !normalizedUser.id) {
          toast.error("Login response was invalid. Please try again.");
          return;
        }

        storeAuth(String(token), normalizedUser);
        toast.success("Login successful!");
        navigate("/");
      }
    } catch (error) {
      toast.error("Network error – check your connection");
    } finally {
      setLoading(false);
    }
  };

  // Use backend REST API for signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetchFromSaccoApi(`/auth/register`, {
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
      const res = await fetchFromSaccoApi(`/auth/verify-email`, {
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
      const res = await fetchFromSaccoApi(`/auth/resend-verification-email`, {
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
    <div className="auth-gateway min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-background">
      <div className="auth-gateway__glow auth-gateway__glow--green" aria-hidden="true" />
      <div className="auth-gateway__glow auth-gateway__glow--gold" aria-hidden="true" />
      <svg className="auth-gateway__network" viewBox="0 0 900 700" fill="none" aria-hidden="true">
        <path d="M25 570C180 540 205 405 340 430S510 550 625 355 755 150 880 115" />
        <path d="M70 640C220 555 275 600 390 505S560 280 715 300 800 210 890 180" />
        <g className="auth-gateway__nodes">
          <circle cx="25" cy="570" r="5" /><circle cx="340" cy="430" r="5" /><circle cx="625" cy="355" r="5" /><circle cx="880" cy="115" r="5" />
          <circle cx="390" cy="505" r="4" /><circle cx="715" cy="300" r="4" />
        </g>
      </svg>
      <div className="auth-gateway__grid" aria-hidden="true" />
      <div className="auth-gateway__content relative z-10 w-full max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_420px]">
          <section className="auth-gateway__story hidden lg:block" aria-label="SMCF SACCO">
            <div className="mb-6 flex items-center gap-3">
              <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" className="h-12 w-12 rounded-xl shadow-lg" />
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">SMCF SACCO</span>
            </div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#D4A72C]">Your financial journey</p>
            <h1 className="max-w-lg text-5xl font-semibold leading-tight text-white xl:text-6xl">
              Your money.<br />Your goals.<br /><span className="text-emerald-300">Your future.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-white/70">
              Manage your savings, participate in cycles, grow your financial goals and stay connected to your SMCF journey.
            </p>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-xs text-white/65">
              <div className="auth-gateway__feature"><WalletCards className="mb-2 h-4 w-4 text-emerald-300" />Smart saving</div>
              <div className="auth-gateway__feature"><UsersRound className="mb-2 h-4 w-4 text-[#D4A72C]" />Community</div>
              <div className="auth-gateway__feature"><Target className="mb-2 h-4 w-4 text-emerald-300" />Shared growth</div>
            </div>
          </section>

          <div className="relative">
            <div className="auth-gateway__float auth-gateway__float--top hidden sm:flex"><span>Financial growth</span><span className="text-emerald-600">●</span></div>
            <div className="auth-gateway__float auth-gateway__float--bottom hidden sm:flex"><span>Secure access</span><ShieldCheck className="h-4 w-4 text-emerald-700" /></div>
      
      {/* Main Auth Card */}
      <Card className="auth-gateway__card w-full max-w-md relative z-10">
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
                  <Label htmlFor="login-identifier">Email</Label>
                  <Input
                    id="login-identifier"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || loginCooldownSeconds > 0}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading
                    ? "Signing In..."
                    : loginCooldownSeconds > 0
                      ? `Try again in ${loginCooldownSeconds}s`
                      : "Sign In"}
                </Button>
                <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  Secure access to your SMCF account
                </p>

              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="John Doe"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      autoComplete="new-password"
                      className="pr-10"
                    />
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
          </div>
        </div>
        <footer className="mt-8 text-center text-xs text-white/55 lg:text-left">
          <span>© 2026 SMART MOVES DEVELOPMENT AGENCY</span>
          <span className="mx-2 hidden sm:inline">·</span>
          <span className="block sm:inline">Powering Grassroots Financial Freedom</span>
        </footer>
      </div>

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
