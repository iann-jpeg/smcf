import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { CheckCircle, Loader2, QrCode } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface CycleQRPaymentProps {
  onPaymentSuccess?: () => void;
  contributionAmount?: number;
}

const CycleQRPayment = ({
  onPaymentSuccess,
  contributionAmount = 224,
}: CycleQRPaymentProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [qrData, setQrData] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentState, setPaymentState] = useState<
    "idle" | "confirm" | "processing" | "waiting" | "success" | "failed"
  >("idle");
  const [checkoutRequestID, setCheckoutRequestID] = useState("");
  const [scannedMember, setScannedMember] = useState<any>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const pollingActiveRef = useRef(false);
  const { toast } = useToast();

  // Listen for real-time payment confirmations via Socket.IO
  useEffect(() => {
    const socket = (window as any).socket;
    if (!socket || !checkoutRequestID) return;

    const handlePaymentCompleted = (data: any) => {
      console.log("🔔 QR Payment: Real-time payment notification:", data);
      console.log("   Checking against checkoutRequestID:", checkoutRequestID);
      console.log("   Checking against scannedMember.userId:", scannedMember?.userId);
      console.log("   Event memberId:", data.memberId);
      console.log("   Event checkoutRequestID:", data.checkoutRequestID);

      // Check if this is our payment by checkoutRequestID or recipient's userId (ObjectId)
      if (
        data.checkoutRequestID === checkoutRequestID ||
        data.memberId === scannedMember?.userId
      ) {
        console.log("✅ QR Payment confirmed via Socket.IO - stopping polling");
        pollingActiveRef.current = false; // Stop polling immediately
        setPollingActive(false);
        setPaymentState("success");
        setIsProcessing(false);

        toast({
          title: "Payment Successful! 🎉",
          description: `KES ${contributionAmount} cycle contribution recorded for ${scannedMember.memberName}`,
        });

        // Trigger immediate refetch to update stats
        setTimeout(() => {
          onPaymentSuccess?.();
        }, 1000);

        setTimeout(() => {
          setShowDialog(false);
          setQrData("");
          setScannedMember(null);
          setPaymentState("idle");
        }, 2000);
      }
    };

    socket.on("payment:completed", handlePaymentCompleted);

    return () => {
      socket.off("payment:completed", handlePaymentCompleted);
    };
  }, [checkoutRequestID, scannedMember, contributionAmount, onPaymentSuccess]);

  const handleScanQR = () => {
    try {
      const parsedData = JSON.parse(qrData);

      if (parsedData.type !== "SMCF_WALLET_DEPOSIT") {
        throw new Error("Invalid QR code type");
      }

      setScannedMember(parsedData);
      toast({
        title: "QR Code Scanned",
        description: `Ready to pay cycle contribution for ${parsedData.memberName}`,
      });
    } catch (error) {
      toast({
        title: "Invalid QR Code",
        description: "This is not a valid SMCF payment QR code",
        variant: "destructive",
      });
    }
  };

  // Poll payment status with adaptive intervals for faster response
  const pollPaymentStatus = async (
    requestID: string,
    retryCount = 0
  ): Promise<void> => {
    // Check if polling was stopped (by Socket.IO notification)
    if (!pollingActiveRef.current) {
      console.log("⏹️ QR Payment polling stopped by real-time notification");
      return;
    }

    const maxRetries = 40; // Max 60 seconds with adaptive intervals

    if (retryCount >= maxRetries) {
      pollingActiveRef.current = false;
      setPollingActive(false);
      setPaymentState("failed");
      setIsProcessing(false);
      toast({
        title: "Payment Timeout",
        description:
          "Payment verification timed out. Please check your transaction history.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/lipia/query-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({ checkoutRequestID: requestID }),
      });

      const data = await response.json();

      console.log("💳 QR Payment status poll #" + (retryCount + 1) + ":");
      console.log("   Full API response:", JSON.stringify(data, null, 2));
      console.log("   data.success:", data.success);
      console.log("   data.status:", data.status);
      console.log("   data.ResultCode:", data.ResultCode);
      console.log("   data.MpesaReceiptNumber:", data.MpesaReceiptNumber);

      // Check for success - be more lenient
      const isCompleted =
        data.success &&
        (data.ResultCode === "0" ||
          data.ResultCode === 0 ||
          data.MpesaReceiptNumber ||
          data.status === "completed" ||
          (data.data && data.data.status === "completed"));

      if (isCompleted) {
        pollingActiveRef.current = false; // Stop polling
        setPollingActive(false);
        setPaymentState("success");
        setIsProcessing(false);

        const receiptNumber =
          data.MpesaReceiptNumber ||
          data.data?.MpesaReceiptNumber ||
          data.data?.mpesaReceiptNumber ||
          "SUCCESS";

        toast({
          title: "Payment Successful! 🎉",
          description: `KES ${contributionAmount} cycle contribution recorded. Receipt: ${receiptNumber}`,
        });

        console.log("✅ QR Payment confirmed! Receipt:", receiptNumber);

        // Trigger immediate refetch to update stats
        setTimeout(() => {
          onPaymentSuccess?.();
        }, 1000);

        setTimeout(() => {
          setShowDialog(false);
          setQrData("");
          setScannedMember(null);
          setPaymentState("idle");
        }, 2000);
        return; // STOP POLLING
      }

      // If status is explicitly failed
      if (
        data.status === "failed" ||
        (data.ResultCode &&
          data.ResultCode !== "0" &&
          data.ResultCode !== 0 &&
          data.status === "failed")
      ) {
        pollingActiveRef.current = false; // Stop polling
        setPollingActive(false);
        setPaymentState("failed");
        setIsProcessing(false);
        toast({
          title: "Payment Failed",
          description: data.ResultDescription || "Payment was not completed",
          variant: "destructive",
        });
        return; // STOP POLLING
      }

      // Continue polling with adaptive interval:
      // First 15 checks: 1 second (fast response when user enters PIN)
      // Next 15 checks: 2 seconds
      // Remaining: 3 seconds
      const nextInterval =
        retryCount < 15 ? 1000 : retryCount < 30 ? 2000 : 3000;
      setTimeout(() => {
        pollPaymentStatus(requestID, retryCount + 1);
      }, nextInterval);
    } catch (error) {
      console.error("Payment status check error:", error);
      const nextInterval =
        retryCount < 15 ? 1000 : retryCount < 30 ? 2000 : 3000;
      setTimeout(() => {
        pollPaymentStatus(requestID, retryCount + 1);
      }, nextInterval);
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
    setPaymentState("confirm");

    try {
      // Get current user's phone for STK push
      const currentUser = authService.getUser();
      
      // Make cycle payment via Lipia STK Push
      const response = await fetch(
        `${API_BASE}/api/lipia/stk-push`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            phone: currentUser?.phoneNumber || currentUser?.phone,
            amount: contributionAmount,
            cycleNumber: null, // Will be determined by backend based on recipient's status
            type: "cycle_payment",
            recipientMemberId: scannedMember.userId,
            notes: `QR Payment for ${scannedMember.memberName} (${scannedMember.memberId})`,
            description: `Cycle contribution for ${scannedMember.memberName}`,
          }),
        }
      );

      console.log("QR Cycle Payment Response Status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("QR Cycle Payment Error:", errorText);
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("QR Cycle Payment Response:", data);

      if (data.success && data.CheckoutRequestID) {
        // STK Push sent successfully
        setCheckoutRequestID(data.CheckoutRequestID);
        setPaymentState("processing");
        pollingActiveRef.current = true; // Start polling flag
        setPollingActive(true);

        toast({
          title: "STK Push Sent 📱",
          description:
            data.message || "Please enter your M-Pesa PIN on your phone",
        });

        // Start polling for payment status
        pollPaymentStatus(data.CheckoutRequestID);
      } else {
        throw new Error(data.error || "Payment initiation failed");
      }
    } catch (error: any) {
      setPaymentState("failed");
      toast({
        title: "Payment Failed",
        description: error.message || "Unable to process payment",
        variant: "destructive",
      });
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
            <DialogTitle>Pay for Another Member's Cycle</DialogTitle>
            <DialogDescription>
              Scan a member's QR code to pay their KES {contributionAmount}{" "}
              cycle contribution. You will receive the STK Push on YOUR phone.
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
                Get the QR code data from the organization admin or payment
                coordinator
              </p>
            </div>

            {scannedMember && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-semibold">Member Verified</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Paying for:</strong> {scannedMember.memberName}
                  </p>
                  <p>
                    <strong>Member ID:</strong> {scannedMember.memberId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ℹ️ STK Push will be sent to YOUR phone to complete this
                    payment
                  </p>
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
                  {paymentState === "confirm" && "Initiating Payment..."}
                  {paymentState === "processing" &&
                    "Enter M-Pesa PIN on your phone..."}
                  {paymentState === "waiting" && "Waiting for confirmation..."}
                  {paymentState === "success" && "Payment Successful!"}
                  {paymentState === "failed" && "Payment Failed"}
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
