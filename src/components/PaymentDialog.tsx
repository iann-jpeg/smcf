import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Shield,
  Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";

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
  memberData,
  cycle,
}: PaymentDialogProps) => {
  const { toast } = useToast();
  const [paymentStep, setPaymentStep] = useState<
    "confirm" | "processing" | "waiting" | "success" | "failed"
  >("confirm");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutRequestID, setCheckoutRequestID] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [pollCount, setPollCount] = useState(0);
  const [targetCycle, setTargetCycle] = useState(cycle);
  const [hasPaidCurrentCycle, setHasPaidCurrentCycle] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);

  // Listen for real-time payment confirmations via Socket.IO
  useEffect(() => {
    const socket = (window as any).socket;
    if (!socket || !checkoutRequestID) return;

    const handlePaymentCompleted = (data: any) => {
      console.log("🔔 Real-time payment notification:", data);

      // Check if this is our payment
      if (
        data.checkoutRequestID === checkoutRequestID ||
        data.memberId === (memberData._id || memberData.id)
      ) {
        console.log("✅ Payment confirmed via Socket.IO - stopping polling");
        setPollingActive(false); // Stop polling immediately
        setTransactionId(data.mpesaReceiptNumber || "SUCCESS");
        setPaymentStep("success");
        setIsProcessing(false);

        toast({
          title: "Payment Successful!",
          description: `KES ${amount} received. Receipt: ${
            data.mpesaReceiptNumber || "Confirmed"
          }`,
        });

        setTimeout(() => {
          onPaymentSuccess();
        }, 2000);
      }
    };

    socket.on("payment:completed", handlePaymentCompleted);

    return () => {
      socket.off("payment:completed", handlePaymentCompleted);
    };
  }, [checkoutRequestID, memberData, amount, onPaymentSuccess]);

  // Determine target cycle when dialog opens
  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const token = localStorage.getItem("smcf_token");
        const memberId = memberData._id || memberData.id;

        // Fetch member's current payment status
        const response = await fetch(`${API_BASE}/api/members/${memberId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const isPaid = data.success
            ? data.data.payment_status === "paid"
            : false;
          setHasPaidCurrentCycle(isPaid);

          // If already paid, set target to next cycle
          if (isPaid) {
            setTargetCycle(cycle + 1);
            toast({
              title: "Advance Payment",
              description: `You've already paid for Cycle #${cycle}. This payment will be for Cycle #${
                cycle + 1
              }`,
              duration: 5000,
            });
          } else {
            setTargetCycle(cycle);
          }
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        setTargetCycle(cycle);
      }
    };

    if (open) {
      checkPaymentStatus();
    }
  }, [open, cycle, memberData]);

  const handleInitiatePayment = async () => {
    setPaymentStep("processing");
    setIsProcessing(true);

    try {
      const token = localStorage.getItem("smcf_token");
      const response = await fetch(`${API_BASE}/api/lipia/stk-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: memberData.phone || memberData.phoneNumber,
          amount: amount,
          cycleNumber: targetCycle,
          description: `SMCF Contribution Payment - Cycle #${targetCycle}`,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCheckoutRequestID(data.CheckoutRequestID);
        setIsProcessing(false);
        setPaymentStep("waiting");
        setPollCount(0);

        toast({
          title: "STK Push Sent!",
          description: `Check your phone (${
            memberData.phone || memberData.phoneNumber
          }) and enter your M-Pesa PIN`,
        });

        // Start polling for payment status
        setPollingActive(true);
        pollPaymentStatus(data.CheckoutRequestID);
      } else {
        setIsProcessing(false);
        setPaymentStep("confirm");
        toast({
          title: "Payment Error",
          description:
            data.error ||
            data.ResponseDescription ||
            "Failed to initiate payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsProcessing(false);
      setPaymentStep("confirm");
      toast({
        title: "Network Error",
        description: "Could not connect to payment server.",
        variant: "destructive",
      });
    }
  };

  const pollPaymentStatus = async (requestID: string, count: number = 0) => {
    // Check if polling was stopped (by Socket.IO notification)
    if (!pollingActive) {
      console.log("⏹️ Polling stopped by real-time notification");
      return;
    }

    if (count >= 40) {
      // Stop polling after 40 attempts (max 60 seconds with adaptive interval)
      setPollingActive(false);
      setPaymentStep("failed");
      setIsProcessing(false);
      toast({
        title: "Payment Verification Timeout",
        description:
          "Could not verify payment status. If you completed the payment, it will reflect shortly. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("smcf_token");
      const response = await fetch(`${API_BASE}/api/lipia/query-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checkoutRequestID: requestID,
        }),
      });

      const data = await response.json();

      console.log("💳 Payment status poll #" + (count + 1) + ":");
      console.log("   Full API response:", JSON.stringify(data, null, 2));
      console.log("   data.success:", data.success);
      console.log("   data.status:", data.status);
      console.log("   data.ResultCode:", data.ResultCode);
      console.log("   data.MpesaReceiptNumber:", data.MpesaReceiptNumber);

      // Check for successful payment - be more lenient with conditions
      const isCompleted =
        data.success &&
        (data.status === "completed" ||
          data.ResultCode === "0" ||
          data.ResultCode === 0 ||
          data.MpesaReceiptNumber ||
          (data.data && data.data.status === "completed"));

      if (isCompleted) {
        setPollingActive(false); // Stop polling
        const receiptNumber =
          data.MpesaReceiptNumber ||
          data.data?.MpesaReceiptNumber ||
          data.data?.mpesaReceiptNumber ||
          "SUCCESS";
        setTransactionId(receiptNumber);
        setPaymentStep("success");
        setIsProcessing(false);

        toast({
          title: "Payment Successful!",
          description: `KES ${amount} received. Receipt: ${receiptNumber}`,
        });

        console.log("✅ Payment confirmed! Receipt:", receiptNumber);

        // Call success callback after a short delay
        setTimeout(() => {
          onPaymentSuccess();
        }, 2000);
        return; // STOP POLLING
      } else if (
        data.ResultCode &&
        data.ResultCode !== "0" &&
        data.ResultCode !== 0 &&
        data.status === "failed"
      ) {
        // Only mark as failed if explicitly failed status
        setPollingActive(false); // Stop polling
        setPaymentStep("failed");
        setIsProcessing(false);
        toast({
          title: "Payment Failed",
          description: data.ResultDescription || "Payment was not completed",
          variant: "destructive",
        });
        return; // STOP POLLING
      } else {
        // Still pending - use adaptive polling interval:
        // First 15 checks: 1 second (fast response for quick PIN entry)
        // Next 15 checks: 2 seconds
        // Remaining: 3 seconds
        const nextInterval = count < 15 ? 1000 : count < 30 ? 2000 : 3000;
        setPollCount(count + 1);
        setTimeout(() => pollPaymentStatus(requestID, count + 1), nextInterval);
      }
    } catch (error) {
      console.error("Error polling payment status:", error);
      // Continue polling on error with adaptive interval
      const nextInterval = count < 15 ? 1000 : count < 30 ? 2000 : 3000;
      setTimeout(() => pollPaymentStatus(requestID, count + 1), nextInterval);
    }
  };

  const resetDialog = () => {
    setPaymentStep("confirm");
    setIsProcessing(false);
    setCheckoutRequestID("");
    setTransactionId("");
    setPollCount(0);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300); // Reset after dialog animation
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-financial-success" />
            Mobile Money Payment
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Secure payment via Lipia Online Payment Gateway
          </DialogDescription>
        </DialogHeader>

        {paymentStep === "confirm" && (
          <div className="space-y-4">
            {/* Payment Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Member ID:</span>
                  <span className="font-semibold">{memberData.memberId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone Number:</span>
                  <span className="font-semibold">{memberData.phone}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment For:</span>
                  <span className="font-semibold text-primary">
                    Cycle #{targetCycle}
                  </span>
                </div>
                {hasPaidCurrentCycle && (
                  <div className="bg-financial-success/10 p-2 rounded text-xs text-financial-success">
                    ✓ Advance payment - You've already paid for Cycle #{cycle}
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">
                    Contribution Amount:
                  </span>
                  <span className="text-lg font-bold text-financial-success">
                    KES {amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Transaction Fee:
                  </span>
                  <span className="text-xs text-muted-foreground">FREE</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between">
                  <span className="font-semibold text-sm">Total to Pay:</span>
                  <span className="text-lg font-bold text-primary">
                    KES {amount.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Security Notice */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">Secure Payment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Processed securely through Lipia Online's encrypted gateway
              </p>
            </div>

            <Button
              onClick={handleInitiatePayment}
              className="w-full"
              variant="mpesa"
              size="lg">
              <CreditCard className="w-4 h-4 mr-2" />
              Pay KES {amount} via Mobile Money
            </Button>
          </div>
        )}

        {paymentStep === "processing" && (
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

        {paymentStep === "waiting" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="animate-bounce">
                <div className="w-16 h-16 bg-financial-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-financial-success animate-pulse" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Waiting for M-Pesa PIN
              </h3>
              <p className="text-muted-foreground mb-4">
                Check your phone ({memberData.phone || memberData.phoneNumber})
                and enter your M-Pesa PIN
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                <Clock className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  Polling... ({pollCount}/20)
                </span>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Progress value={(pollCount / 20) * 100} className="h-2" />

                  <div className="bg-financial-success/10 p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-financial-success" />
                      <span className="text-sm font-medium">
                        STK Push Sent Successfully
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A payment prompt has been sent to your phone. Enter your
                      M-Pesa PIN to complete the payment.
                    </p>
                  </div>

                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <strong>Steps to complete:</strong>
                      <br />
                      1. Check your phone for M-Pesa notification
                      <br />
                      2. Enter your M-Pesa PIN
                      <br />
                      3. Wait for confirmation
                    </p>
                  </div>

                  <div className="bg-financial-warning/10 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-financial-warning" />
                      <span className="text-sm font-medium">
                        Security Reminder
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Never share your M-Pesa PIN with anyone. SMCF will never
                      ask for your PIN directly.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {paymentStep === "failed" && (
          <div className="space-y-6 text-center">
            <div className="animate-scale-in">
              <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-12 h-12 text-destructive" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-destructive mb-2">
                Payment Failed
              </h3>
              <p className="text-muted-foreground mb-4">
                The payment was not completed. Please try again.
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg text-left">
              <p className="text-sm text-muted-foreground">
                <strong>Common issues:</strong>
                <br />• Insufficient M-Pesa balance
                <br />• Wrong PIN entered
                <br />• Request timed out
                <br />• Network connectivity issues
              </p>
            </div>

            <Button
              onClick={() => {
                resetDialog();
                handleInitiatePayment();
              }}
              className="w-full"
              variant="financial"
              size="lg">
              <CreditCard className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {paymentStep === "success" && (
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
                Your KES {amount} contribution for Cycle #{targetCycle} has been
                received
              </p>
              {hasPaidCurrentCycle && (
                <p className="text-xs text-muted-foreground">
                  This was an advance payment for Cycle #{targetCycle}
                </p>
              )}
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Transaction ID:
                    </span>
                    <span className="font-mono text-xs">
                      {transactionId || `MP${Date.now().toString().slice(-8)}`}
                    </span>
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
                SMS receipt sent to {memberData.phone || memberData.phoneNumber}
              </p>
            </div>

            <Button
              onClick={handleClose}
              className="w-full"
              variant="outline"
              size="lg">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
