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
  const [transferFee, setTransferFee] = useState(0);
  const { toast } = useToast();

  // Calculate transfer fee based on amount
  const calculateFee = (amt: number) => {
    if (amt < 100) return 0;
    if (amt < 500) return 5;
    if (amt < 1000) return 10;
    if (amt < 2000) return 20;
    if (amt < 5000) return 30;
    if (amt < 10000) return 40;
    if (amt < 20000) return 50;
    if (amt < 50000) return 70;
    if (amt <= 100000) return 100;
    return 100;
  };

  // Update fee when amount changes
  const handleAmountChange = (value: string) => {
    setAmount(value);
    const amountNum = parseFloat(value);
    if (!isNaN(amountNum) && amountNum > 0) {
      setTransferFee(calculateFee(amountNum));
    } else {
      setTransferFee(0);
    }
  };

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
        const feeMsg = data.data?.transferFee > 0 
          ? ` (Fee: KES ${data.data.transferFee})` 
          : '';
        toast({
          title: "Payment Successful! 🎉",
          description: `KES ${amountNum.toLocaleString()} sent to ${scannedMember.memberName}${feeMsg}`,
        });
        setShowDialog(false);
        setQrData("");
        setAmount("");
        setScannedMember(null);
        setTransferFee(0);
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
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={!scannedMember}
              />
              {transferFee > 0 && amount && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-amber-700 font-medium">Transfer Fee:</span>
                    <span className="text-amber-900 font-bold">KES {transferFee}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-amber-200">
                    <span className="text-amber-700 font-semibold">Total Deducted:</span>
                    <span className="text-amber-900 font-bold">
                      KES {(parseFloat(amount) + transferFee).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {parseFloat(amount) > 0 && parseFloat(amount) < 100 && (
                <p className="text-xs text-green-600">
                  ✓ Free transfer (under KES 100)
                </p>
              )}
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
