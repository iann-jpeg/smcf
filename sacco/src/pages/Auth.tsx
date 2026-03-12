import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { storeAuth } from "@/hooks/useAuth";

const API_URL = import.meta.env.VITE_SACCO_API_URL || "http://localhost:5000/api";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tab, setTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);

  // Use backend REST API for login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        toast.error(data.message || "Login failed");
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
        // Backend returns a token on register — log in directly
        storeAuth(data.data.token, data.data.user);
        toast.success("Account created! Welcome to SMCF SACCO.");
        navigate("/");
      }
    } catch (error) {
      setLoading(false);
      toast.error("Network error – check your connection");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div
        className="absolute inset-0 opacity-10 bg-cover bg-center auth-bg-image"
      />
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center space-y-4">
          <img src="/favicon.png" alt="SMCF SACCO" className="mx-auto w-16 h-16 rounded-xl" />
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
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@smcf.co.ke" />
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
    </div>
  );
}
