import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Phone, IdCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (role: 'admin' | 'member', userData: any) => void;
}

const AuthDialog = ({ open, onOpenChange, onLogin }: AuthDialogProps) => {
  const [loginData, setLoginData] = useState({
    phone: '',
    otp: '',
    name: '',
    idNumber: ''
  });
  const [otpSent, setOtpSent] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const handleSendOTP = () => {
    if (!loginData.phone) {
      toast({
        title: "Phone number required",
        description: "Please enter your M-Pesa phone number",
        variant: "destructive"
      });
      return;
    }
    
    // Simulate OTP sending
    setOtpSent(true);
    toast({
      title: "OTP Sent",
      description: `Verification code sent to ${loginData.phone}`,
    });
  };

  const handleLogin = (role: 'admin' | 'member') => {
    // Hardcode admin login
    if (role === 'admin' && loginData.phone === '0117512982') {
      const userData = {
        phone: loginData.phone,
        name: 'SMCF Administrator',
        idNumber: 'ADMIN001',
        memberId: null,
        role
      };

      onLogin(role, userData);
      
      toast({
        title: "Admin Login Successful",
        description: `Welcome ${userData.name}!`,
      });

      // Reset form
      setLoginData({ phone: '', otp: '', name: '', idNumber: '' });
      setOtpSent(false);
      setIsRegistering(false);
      return;
    }

    if (!otpSent || !loginData.otp) {
      toast({
        title: "OTP Required",
        description: "Please enter the verification code",
        variant: "destructive"
      });
      return;
    }

    if (isRegistering && (!loginData.name || !loginData.idNumber)) {
      toast({
        title: "Registration Details Required",
        description: "Please fill in all registration details",
        variant: "destructive"
      });
      return;
    }

    // Simulate successful login
    const userData = {
      phone: loginData.phone,
      name: isRegistering ? loginData.name : (role === 'admin' ? 'Admin User' : 'John Kamau'),
      idNumber: isRegistering ? loginData.idNumber : '12345678',
      memberId: role === 'member' ? `SMCF-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}` : null,
      role
    };

    onLogin(role, userData);
    
    toast({
      title: "Login Successful",
      description: `Welcome ${userData.name}!`,
    });

    // Reset form
    setLoginData({ phone: '', otp: '', name: '', idNumber: '' });
    setOtpSent(false);
    setIsRegistering(false);
  };

  const resetForm = () => {
    setLoginData({ phone: '', otp: '', name: '', idNumber: '' });
    setOtpSent(false);
    setIsRegistering(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="member" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Member
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
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
                  <Label htmlFor="member-phone">M-Pesa Phone Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="member-phone"
                      placeholder="0722123456"
                      value={loginData.phone}
                      onChange={(e) => setLoginData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={otpSent}
                    />
                    <Button 
                      onClick={handleSendOTP}
                      disabled={otpSent}
                      variant="outline"
                    >
                      {otpSent ? 'Sent' : 'Send OTP'}
                    </Button>
                  </div>
                </div>

                {otpSent && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="member-otp">Verification Code</Label>
                      <Input
                        id="member-otp"
                        placeholder="Enter 6-digit code"
                        value={loginData.otp}
                        onChange={(e) => setLoginData(prev => ({ ...prev, otp: e.target.value }))}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="new-member"
                        checked={isRegistering}
                        onChange={(e) => setIsRegistering(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="new-member" className="text-sm">
                        I'm a new member (Register)
                      </Label>
                    </div>

                    {isRegistering && (
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="member-name">Full Name</Label>
                          <Input
                            id="member-name"
                            placeholder="John Kamau"
                            value={loginData.name}
                            onChange={(e) => setLoginData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="member-id">ID Number</Label>
                          <Input
                            id="member-id"
                            placeholder="12345678"
                            value={loginData.idNumber}
                            onChange={(e) => setLoginData(prev => ({ ...prev, idNumber: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}

                    <Button 
                      className="w-full"
                      onClick={() => handleLogin('member')}
                      variant="financial"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      {isRegistering ? 'Register & Login' : 'Login as Member'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="space-y-4">
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
                  <div className="flex gap-2">
                    <Input
                      id="admin-phone"
                      placeholder="0722123456"
                      value={loginData.phone}
                      onChange={(e) => setLoginData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={otpSent}
                    />
                    <Button 
                      onClick={handleSendOTP}
                      disabled={otpSent}
                      variant="outline"
                    >
                      {otpSent ? 'Sent' : 'Send OTP'}
                    </Button>
                  </div>
                </div>

                {otpSent && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="admin-otp">Verification Code</Label>
                      <Input
                        id="admin-otp"
                        placeholder="Enter 6-digit code"
                        value={loginData.otp}
                        onChange={(e) => setLoginData(prev => ({ ...prev, otp: e.target.value }))}
                      />
                    </div>

                    <Button 
                      className="w-full"
                      onClick={() => handleLogin('admin')}
                      variant="gold"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Login as Admin
                    </Button>
                  </>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Admin access requires authorized phone number
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