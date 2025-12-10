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

interface QRScannerProps {
  onScanSuccess?: () => void;
}

const QRScanner = ({ onScanSuccess }: QRScannerProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [qrData, setQrData] = useState("");
  const [amount, setAmount] = useState("");
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
        description: `Ready to send to ${parsedData.memberName}`,
      });
    } catch (error) {
      toast({
        title: "Invalid QR Code",
        description: "This is not a valid SMCF payment QR code",
        variant: "destructive",
      });
    }
  };

  const handleSendPayment = async () => {
    if (!scannedMember || !amount) {
      toast({
        title: "Missing Information",
        description: "Please scan QR code and enter amount",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Send payment to recipient's wallet
      const response = await fetch(`${API_BASE}/api/savings/qr-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          recipientId: scannedMember.userId,
          recipientMemberId: scannedMember.memberId,
          amount: amountNum,
          qrData: scannedMember,
        }),
      });

      console.log("QR Transfer Response Status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("QR Transfer Error:", errorText);
        throw new Error(`Request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("QR Transfer Response:", data);

      if (data.success) {
        toast({
          title: "Payment Successful! 🎉",
          description: `KES ${amountNum.toLocaleString()} sent to ${scannedMember.memberName}`,
        });
        setShowDialog(false);
        setQrData("");
        setAmount("");
        setScannedMember(null);
        onScanSuccess?.();
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
        className="flex items-center gap-2">
        <QrCode className="w-4 h-4" />
        Scan QR to Pay
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Member QR Code</DialogTitle>
            <DialogDescription>
              Paste the QR code data to send money to another member's wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr-data">QR Code Data</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-data"
                  placeholder="Paste QR code data here"
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
                Use the member's "Copy Data" button to get their QR code data
              </p>
            </div>

            {scannedMember && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-semibold">QR Code Verified</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> {scannedMember.memberName}</p>
                  <p><strong>Member ID:</strong> {scannedMember.memberId}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!scannedMember}
              />
            </div>

            <Button
              onClick={handleSendPayment}
              className="w-full"
              disabled={!scannedMember || !amount || isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Send KES ${amount || "0"}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QRScanner;
