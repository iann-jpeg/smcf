import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Smartphone, 
  Shield, 
  CheckCircle, 
  Clock,
  AlertCircle,
  CreditCard,
  Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentSuccess: () => void;
  amount: number;
  memberData: any;
  cycle: number; 
}

const PaymentDialog = ({
  open,
  onOpenChange,
  onPaymentSuccess,
  amount,
  memberData
}: PaymentDialogProps) => {
  const { toast } = useToast();
  const [paymentStep, setPaymentStep] = useState<'confirm' | 'processing' | 'pin' | 'success'>('confirm');
  const [pin, setPin] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // ...existing code...
import API_BASE from '@/lib/api';

const handleInitiatePayment = async () => {
  setPaymentStep('processing');
  setIsProcessing(true);

  try {
  const response = await fetch(`${API_BASE}/api/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: memberData.phone,
        amount: amount
      }),
    });

    const data = await response.json();

    if (response.ok && data.ResponseCode === "0") {
      setIsProcessing(false);
      setPaymentStep('pin');
      toast({
        title: "STK Push Sent",
        description: "Check your phone for the M-Pesa prompt and enter your PIN.",
      });
    } else {
      setIsProcessing(false);
      setPaymentStep('confirm');
      toast({
        title: "Payment Error",
        description: data.error?.errorMessage || "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    }
  } catch (error) {
    setIsProcessing(false);
    setPaymentStep('confirm');
    toast({
      title: "Network Error",
      description: "Could not connect to payment server.",
      variant: "destructive",
    });
  }
};
// ...existing code...

  const handlePinSubmit = () => {
    if (!pin || pin.length < 4) {
      toast({
        title: "Invalid PIN",
        description: "Please enter your M-Pesa PIN",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      setPaymentStep('success');
      
      // Wait a bit then call success callback
      setTimeout(() => {
        onPaymentSuccess();
        resetDialog();
      }, 2000);
    }, 3000);
  };

  const resetDialog = () => {
    setPaymentStep('confirm');
    setPin('');
    setIsProcessing(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300); // Reset after dialog animation
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-financial-success" />
            M-Pesa Payment
          </DialogTitle>
          <DialogDescription>
            Secure payment via M-Pesa STK Push
          </DialogDescription>
        </DialogHeader>

        {paymentStep === 'confirm' && (
          <div className="space-y-6">
            {/* Payment Details */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member ID:</span>
                  <span className="font-semibold">{memberData.memberId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone Number:</span>
                  <span className="font-semibold">{memberData.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contribution Amount:</span>
                  <span className="text-xl font-bold text-financial-success">
                    KES {amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction Fee:</span>
                  <span className="text-sm text-muted-foreground">FREE</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="font-semibold">Total to Pay:</span>
                  <span className="text-xl font-bold text-primary">
                    KES {amount.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Security Notice */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Secure Payment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your payment is processed securely through M-Pesa's encrypted STK Push service. 
                No sensitive information is stored on our servers.
              </p>
            </div>

            <Button 
              onClick={handleInitiatePayment} 
              className="w-full" 
              variant="mpesa"
              size="lg"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pay KES {amount} via M-Pesa
            </Button>
          </div>
        )}

        {paymentStep === 'processing' && (
          <div className="space-y-6 text-center">
            <div className="animate-financial-pulse">
              <Smartphone className="w-16 h-16 text-financial-success mx-auto mb-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Initiating Payment</h3>
              <p className="text-muted-foreground mb-4">
                Sending STK Push to {memberData.phone}...
              </p>
              <Progress value={50} className="h-2" />
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Please wait while we send the payment request to your phone
              </p>
            </div>
          </div>
        )}

        {paymentStep === 'pin' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-financial-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-financial-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Enter M-Pesa PIN</h3>
              <p className="text-muted-foreground">
                You should have received an M-Pesa prompt on {memberData.phone}
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-pin">M-Pesa PIN</Label>
                    <Input
                      id="mpesa-pin"
                      type="password"
                      placeholder="Enter your M-Pesa PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      maxLength={4}
                      className="text-center text-xl tracking-widest"
                    />
                  </div>
                  
                  <div className="bg-financial-warning/10 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-financial-warning" />
                      <span className="text-sm font-medium">Security Reminder</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Never share your M-Pesa PIN with anyone. SMCF will never ask for your PIN.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handlePinSubmit} 
              className="w-full" 
              variant="financial"
              size="lg"
              disabled={isProcessing || pin.length < 4}
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Payment
                </>
              )}
            </Button>
          </div>
        )}

        {paymentStep === 'success' && (
          <div className="space-y-6 text-center">
            <div className="animate-scale-in">
              <div className="w-20 h-20 bg-financial-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-financial-success" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-financial-success mb-2">
                Payment Successful!
              </h3>
              <p className="text-muted-foreground mb-4">
                Your KES {amount} contribution has been received
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <span className="font-mono">MP{Date.now().toString().slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold">KES {amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-financial-success/10 p-4 rounded-lg">
              <p className="text-sm text-financial-success">
                SMS receipt sent to {memberData.phone}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;