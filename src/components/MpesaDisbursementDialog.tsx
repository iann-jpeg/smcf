import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Wallet, 
  User, 
  ArrowRight, 
  Shield,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MpesaDisbursementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
  }>;
}

const MpesaDisbursementDialog = ({ 
  open, 
  onOpenChange, 
  members 
}: MpesaDisbursementDialogProps) => {
  const [step, setStep] = useState<'setup' | 'confirm' | 'pin' | 'processing' | 'success'>('setup');
  const [selectedMember, setSelectedMember] = useState('');
  const [amount, setAmount] = useState('');
  const [adminMpesaNumber, setAdminMpesaNumber] = useState('');
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const selectedMemberData = members.find(m => m.id === selectedMember);

  const handleProceedToConfirm = () => {
    if (!selectedMember || !amount || !adminMpesaNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    setStep('confirm');
  };

  const handleInitiateDisbursement = () => {
    setStep('pin');
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      toast({
        title: "Invalid PIN",
        description: "Please enter your 4-digit M-Pesa PIN",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setStep('processing');

        setIsProcessing(true);
    setStep('processing');

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE}/api/mpesa/stkpush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: adminMpesaNumber,
          amount: amount
        }),
      });

      const data = await response.json();

      if (response.ok && data.ResponseCode === "0") {
        setTimeout(() => {
          setStep('success');
          setIsProcessing(false);
          toast({
            title: "Disbursement Successful",
            description: `KES ${amount} sent to ${selectedMemberData?.name}`,
          });
        }, 3000);
      } else {
        setIsProcessing(false);
        setStep('pin');
        toast({
          title: "Payment Error",
          description: data.error?.errorMessage || "Failed to initiate payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsProcessing(false);
      setStep('pin');
      toast({
        title: "Network Error",
        description: "Could not connect to payment server.",
        variant: "destructive",
      });
    }
  }; // <-- Add this closing brace to end handlePinSubmit

  const resetDialog = () => {
    setStep('setup');
    setSelectedMember('');
    setAmount('');
    setAdminMpesaNumber('');
    setPin('');
    setIsProcessing(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-mpesa-green" />
            Send M-Pesa Payment
          </DialogTitle>
          <DialogDescription>
            {step === 'setup' && 'Set up payment details for disbursement'}
            {step === 'confirm' && 'Confirm payment details before sending'}
            {step === 'pin' && 'Enter your M-Pesa PIN to authorize'}
            {step === 'processing' && 'Processing your M-Pesa transfer...'}
            {step === 'success' && 'Payment sent successfully!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Setup */}
        {step === 'setup' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-mpesa">Your M-Pesa Number</Label>
              <Input
                id="admin-mpesa"
                placeholder="+254XXXXXXXXX"
                value={adminMpesaNumber}
                onChange={(e) => setAdminMpesaNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient">Select Recipient</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <span>{member.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {member.phone}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleProceedToConfirm}
              className="w-full"
              variant="mpesa"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

       
        {step === 'confirm' && selectedMemberData && (
          <div className="space-y-4">
            <Card className="bg-mpesa-green/5 border-mpesa-green/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <div className="flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    <span className="font-medium">{adminMpesaNumber}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-center py-2">
                  <ArrowRight className="w-6 h-6 text-mpesa-green" />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <div className="text-right">
                      <div className="font-medium">{selectedMemberData.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedMemberData.phone}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <span className="text-2xl font-bold text-mpesa-green">
                      KES {parseInt(amount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <div className="flex gap-2">
                <Shield className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Confirm Details</p>
                  <p className="text-amber-700">
                    Please verify all information before proceeding. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep('setup')}
              >
                Back
              </Button>
              <Button 
                onClick={handleInitiateDisbursement}
                className="flex-1"
                variant="mpesa"
              >
                Send Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: PIN Entry */}
        {step === 'pin' && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-mpesa-green/10 rounded-full flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-mpesa-green" />
              </div>
              <h3 className="font-semibold">Enter M-Pesa PIN</h3>
              <p className="text-sm text-muted-foreground">
                Enter your 4-digit M-Pesa PIN to authorize the transfer of KES {parseInt(amount).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">M-Pesa PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl font-bold tracking-widest"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep('confirm')}
              >
                Back
              </Button>
              <Button 
                onClick={handlePinSubmit}
                className="flex-1"
                variant="mpesa"
                disabled={pin.length !== 4}
              >
                Authorize Transfer
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Processing */}
        {step === 'processing' && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-mpesa-green/10 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-mpesa-green animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold">Processing Transfer</h3>
                <p className="text-sm text-muted-foreground">
                  Sending KES {parseInt(amount).toLocaleString()} to {selectedMemberData?.name}...
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="flex gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Secure Transfer</p>
                  <p className="text-blue-700">
                    Your payment is being processed securely through M-Pesa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 'success' && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-financial-success/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-financial-success" />
              </div>
              <div>
                <h3 className="font-semibold text-financial-success">Transfer Successful!</h3>
                <p className="text-sm text-muted-foreground">
                  KES {parseInt(amount).toLocaleString()} has been sent to {selectedMemberData?.name}
                </p>
              </div>
            </div>

            <Card className="bg-financial-success/5 border-financial-success/20">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <span className="font-mono">MP{Date.now().toString().slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipient:</span>
                    <span>{selectedMemberData?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold">KES {parseInt(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handleClose}
              className="w-full"
              variant="mpesa"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MpesaDisbursementDialog;