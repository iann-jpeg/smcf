import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { Phone, Shield, Users } from "lucide-react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (role: "admin" | "member", userData: any) => void;
}

const AuthDialog = ({ open, onOpenChange, onLogin }: AuthDialogProps) => {
  const [loginData, setLoginData] = useState({
    phone: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleLogin = (role: "admin" | "member") => {
    if (!loginData.phone || !loginData.password) {
      toast({
        title: "Missing credentials",
        description: "Please enter your phone number and password",
        variant: "destructive",
      });
      return;
    }

    // Call backend login endpoint
    fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: loginData.phone,
        password: loginData.password,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "Login failed");
        }
        const j = await r.json();

        // Save JWT token and user data to localStorage
        if (j.token) {
          authService.saveAuth(
            j.token,
            j.user || { phone: loginData.phone, role: j.role }
          );
        }

        onLogin(j.role || role, j.user || { phone: loginData.phone, role });
        toast({
          title: "Login Successful",
          description: `Welcome ${j.user?.name || "User"}!`,
        });
        setLoginData({ phone: "", password: "" });
      })
      .catch((err) => {
        toast({
          title: "Login Failed",
          description: err.message || "Invalid credentials",
          variant: "destructive",
        });
      });
  };

  const resetForm = () => {
    setLoginData({ phone: "", password: "" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetForm();
      }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Access SMCF Platform</DialogTitle>
          <DialogDescription>
            Choose your role and sign in securely with your M-Pesa number
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="member" className="w-full">
          <TabsList className="grid w-full grid-cols-2" style={{ display: 'none' }}>
            <TabsTrigger value="member" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Member
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2" style={{ display: 'none' }}>
              <Shield className="w-4 h-4" />
              Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="member" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Member Login</CardTitle>
                <CardDescription>
                  Access your SMCF member account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="member-phone">Phone Number</Label>
                  <Input
                    id="member-phone"
                    placeholder="254722123456"
                    value={loginData.phone}
                    onChange={(e) =>
                      setLoginData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="member-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleLogin("member")
                      }
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground focus:outline-none"
                      tabIndex={0}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleLogin("member")}
                  variant="financial">
                  <Phone className="w-4 h-4 mr-2" />
                  Login as Member
                </Button>

                <div className="text-xs text-muted-foreground text-center">
                  Contact admin if you don't have an account
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="space-y-4" style={{ display: 'none' }}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Admin/Treasurer Login</CardTitle>
                <CardDescription>
                  Access SMCF administrative controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-phone">Admin Phone Number</Label>
                  <Input
                    id="admin-phone"
                    placeholder="254722123456"
                    value={loginData.phone}
                    onChange={(e) =>
                      setLoginData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleLogin("admin")}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground focus:outline-none"
                      tabIndex={0}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleLogin("admin")}
                  variant="gold">
                  <Shield className="w-4 h-4 mr-2" />
                  Login as Admin
                </Button>

                <div className="text-xs text-muted-foreground text-center">
                  Admin access requires authorized credentials
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
