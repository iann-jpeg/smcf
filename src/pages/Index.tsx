import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Users, Shield, TrendingUp, Smartphone, Clock } from 'lucide-react';
import smcfLogo from '@/assets/smcf-logo.png';
import AuthDialog from '@/components/AuthDialog';
import Dashboard from '@/components/Dashboard';
import OrganizationDialog from '@/components/OrganizationDialog';

const Index = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [showOrganization, setShowOrganization] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogin = (role: 'admin' | 'member', userData: any) => {
    setUserRole(role);
    setCurrentUser(userData);
    setShowAuth(false);
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentUser(null);
  };

  if (userRole && currentUser) {
    return <Dashboard userRole={userRole} userData={currentUser} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={smcfLogo} alt="SMCF Logo" className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-bold text-primary">SMCF</h1>
              <p className="text-xs text-muted-foreground">Smart Money Cash Flow</p>
            </div>
          </div>
          <Button onClick={() => setShowAuth(true)} variant="default">
            Login / Register
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="animate-fade-in-up">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Digital Table Banking
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Automated KES 204 contributions every 5 days. <br />
              Secure M-Pesa integration. Real-time tracking.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" onClick={() => setShowAuth(true)} className="text-lg py-6 px-8">
                Join SMCF Today
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg py-6 px-8"
                onClick={() => setShowOrganization(true)}
              >
                Learn More
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="text-center hover:shadow-financial transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-financial-success mb-2">KES 204</div>
                <div className="text-muted-foreground">Every 5 Days</div>
              </CardContent>
            </Card>
            <Card className="text-center hover:shadow-financial transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary mb-2">100%</div>
                <div className="text-muted-foreground">Automated</div>
              </CardContent>
            </Card>
            <Card className="text-center hover:shadow-financial transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-accent mb-2">Secure</div>
                <div className="text-muted-foreground">M-Pesa Integration</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h3 className="text-3xl font-bold text-center mb-12">Why Choose SMCF?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Wallet,
                title: "M-Pesa Integration",
                description: "Seamless payments via M-Pesa STK Push. Direct payouts to your mobile money account."
              },
              {
                icon: Users,
                title: "Group Management",
                description: "Hierarchical member system with automated disbursements based on contribution order."
              },
              {
                icon: Shield,
                title: "Secure & Transparent",
                description: "OTP authentication, encrypted transactions, and complete audit trails for all activities."
              },
              {
                icon: TrendingUp,
                title: "Real-time Tracking",
                description: "Live payment status, contribution history, and upcoming payout notifications."
              },
              {
                icon: Smartphone,
                title: "Mobile Responsive",
                description: "Works perfectly on any device - desktop, tablet, or smartphone."
              },
              {
                icon: Clock,
                title: "Automated Reminders",
                description: "SMS and web notifications for payment deadlines and payout confirmations."
              }
            ].map((feature, index) => (
              <Card key={index} className="hover:shadow-financial transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <feature.icon className="w-12 h-12 text-primary mb-4" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-3xl font-bold text-center mb-12">How SMCF Works</h3>
          <div className="space-y-8">
            {[
              {
                step: 1,
                title: "Register & Join",
                description: "Sign up with your M-Pesa number and receive your unique SMCF member ID."
              },
              {
                step: 2,
                title: "Contribute KES 204",
                description: "Every 5 days, contribute KES 204 via secure M-Pesa paybill 6938069 or STK Push payment."
              },
              {
                step: 3,
                title: "Automated Payout",
                description: "When all members contribute, the total amount is sent to the next member in line."
              },
              {
                step: 4,
                title: "Track Progress",
                description: "Monitor your payment history, upcoming payouts, and group status in real-time."
              }
            ].map((step, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="flex items-center gap-6 p-6">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground flex-shrink-0">
                    {step.step}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold mb-2">{step.title}</h4>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={smcfLogo} alt="SMCF Logo" className="w-8 h-8" />
            <span className="text-xl font-bold">SMCF</span>
          </div>
          <p className="text-muted-foreground mb-4">
            Smart Money Cash Flow - Digital Table Banking Platform
          </p>
          <p className="text-sm text-muted-foreground">
            Secure • Automated • Transparent • Kenyan-Made
          </p>
        </div>
      </footer>

      {/* Auth Dialog */}
      <AuthDialog 
        open={showAuth} 
        onOpenChange={setShowAuth}
        onLogin={handleLogin}
      />

      {/* Organization Dialog */}
      <OrganizationDialog 
        open={showOrganization}
        onOpenChange={setShowOrganization}
      />
    </div>
  );
};

export default Index;