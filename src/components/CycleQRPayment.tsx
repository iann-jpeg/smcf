import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Loader2, CheckCircle } from "lucide-react";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

interface CycleQRPaymentProps {
  onPaymentSuccess?: () => void;
  contributionAmount?: number;
}

const CycleQRPayment = ({ onPaymentSuccess, contributionAmount = 224 }: CycleQRPaymentProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [qrData, setQrData] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedMember, setScannedMember] = useState<any>(null);
  const { toast } = useToast();

  const handleScanQR = () => {
    try {
      const parsedData = JSON.parse(qrData);
      
      if (parsedData.type !== "SMCF_WALLET_DEPOSIT") {
        throw new Error("Invalid QR code type");
      }

      setScannedMember(parsedData);
      toast({
        title: "QR Code Scanned",
        description: `Paying to organization via ${parsedData.memberName}`,
      });
    } catch (error) {
      toast({
        title: "Invalid QR Code",
        description: "This is not a valid SMCF payment QR code",
        variant: "destructive",
      });
    }
  };

  const handleMakePayment = async () => {
    if (!scannedMember) {
      toast({
        title: "Missing Information",
        description: "Please scan the organization QR code",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Make cycle payment via QR
      const response = await fetch(`${API_BASE}/api/payments/qr-cycle-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          organizationMemberId: scannedMember.userId,
          amount: contributionAmount,
          qrData: scannedMember,
        }),
      });

      console.log("QR Cycle Payment Response Status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("QR Cycle Payment Error:", errorText);
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("QR Cycle Payment Response:", data);

      if (data.success) {
        toast({
          title: "Payment Successful! 🎉",
          description: `KES ${contributionAmount} cycle contribution recorded`,
        });
        setShowDialog(false);
        setQrData("");
        setScannedMember(null);
        onPaymentSuccess?.();
      } else {
        throw new Error(data.error || "Payment failed");
      }
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Unable to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        variant="outline"
        size="lg"
        className="w-full border-2 border-blue-500 text-blue-700 hover:bg-blue-50">
        <QrCode className="w-5 h-5 mr-2" />
        Pay via QR Code
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Cycle Contribution via QR</DialogTitle>
            <DialogDescription>
              Scan the organization's QR code to make your KES {contributionAmount} payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <QrCode className="w-4 h-4" />
                <span className="font-semibold">Contribution Amount</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                KES {contributionAmount.toLocaleString()}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-data">Organization QR Code Data</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-data"
                  placeholder="Paste organization QR code data here"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleScanQR}
                  variant="secondary"
                  disabled={!qrData}>
                  Scan
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get the QR code data from the organization admin or payment coordinator
              </p>
            </div>

            {scannedMember && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-semibold">Organization Verified</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Paying to:</strong> {scannedMember.memberName}</p>
                  <p><strong>Member ID:</strong> {scannedMember.memberId}</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleMakePayment}
              className="w-full"
              disabled={!scannedMember || isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                `Pay KES ${contributionAmount}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CycleQRPayment;
