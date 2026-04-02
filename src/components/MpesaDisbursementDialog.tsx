import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import {
  ArrowRight,
  CheckCircle,
  Loader2,
  Phone,
  Shield,
  User,
} from "lucide-react";
import { useState } from "react";

interface MpesaDisbursementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Array<{
    _id?: string;
    id?: string;
    name: string;
    phone: string;
    status?: string;
    payment_status?: string;
  }>;
}

const MpesaDisbursementDialog = ({
  open,
  onOpenChange,
  members,
}: MpesaDisbursementDialogProps) => {
  const [step, setStep] = useState<
    "setup" | "confirm" | "processing" | "waiting" | "success" | "failed"
  >("setup");
  const [selectedMember, setSelectedMember] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [disbursementId, setDisbursementId] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const { toast } = useToast();

  const selectedMemberData = members.find(
    (m) => (m._id || m.id) === selectedMember
  );

  const handleProceedToConfirm = () => {
    if (!selectedMember || !amount) {
      toast({
        title: "Missing Information",
        description: "Please select a member and enter amount",
        variant: "destructive",
      });
      return;
    }
    setStep("confirm");
  };

  const handleInitiateDisbursement = async () => {
    setIsProcessing(true);
    setStep("processing");

    try {
      // Initiate disbursement - sends STK to admin's phone
      const token = localStorage.getItem("smcf_token");

      const requestBody = {
        recipientPhone: selectedMemberData?.phone,
        amount: parseInt(amount),
        recipientId: selectedMemberData?._id || selectedMemberData?.id,
        notes: `SMCF Payout to ${selectedMemberData?.name}`,
      };

      console.log("💰 Initiating disbursement:", {
        url: `${API_BASE}/api/lipia/send-money`,
        body: requestBody,
        hasToken: !!token,
      });

      const response = await fetch(`${API_BASE}/api/lipia/send-money`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      console.log("💰 Disbursement API Response:", {
        status: response.status,
        ok: response.ok,
        data,
      });

      if (response.ok && data.success) {
        // Check if disbursement is already completed (direct processing)
        if (data.status === "completed") {
          setTransactionId(data.mpesaReceiptNumber || data.transactionReference);
          setIsProcessing(false);
          setStep("success");

          toast({
            title: "Disbursement Successful!",
            description: `KES ${amount} sent to ${selectedMemberData?.name}`,
          });
        } else {
          // Old flow: STK sent to admin (fallback)
          setTransactionReference(data.transactionReference);
          setDisbursementId(data.disbursementId);
          setAdminPhone(data.adminPhone);
          setIsProcessing(false);
          setStep("waiting");

          toast({
            title: "Authorization Required",
            description: `STK Push sent to admin ${data.adminPhone}. Please enter PIN to authorize.`,
          });

          // Start polling for status
          pollDisbursementStatus(data.transactionReference, data.disbursementId);
        }
      } else {
        console.error("❌ Disbursement failed:", data);
        setIsProcessing(false);
        setStep("failed");
        toast({
          title: "Failed to Initiate",
          description:
            data.error || "Failed to initiate disbursement. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("❌ Disbursement error:", error);
      setIsProcessing(false);
      setStep("failed");
      toast({
        title: "Network Error",
        description: error.message || "Could not connect to server.",
        variant: "destructive",
      });
    }
  };

  const pollDisbursementStatus = async (
    reference: string,
    disbId: string,
    attempts = 0
  ) => {
    const maxAttempts = 20; // Poll for up to 60 seconds (3s x 20)

    if (attempts >= maxAttempts) {
      setStep("failed");
      toast({
        title: "Authorization Timeout",
        description: "Admin did not authorize the disbursement in time.",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("smcf_token");
      const response = await fetch(`${API_BASE}/api/lipia/check-disbursement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionReference: reference,
          disbursementId: disbId,
        }),
      });

      const data = await response.json();

      if (data.status === "completed") {
        setTransactionId(data.mpesaReceiptNumber || reference);
        setStep("success");
        toast({
          title: "Disbursement Successful!",
          description: `KES ${amount} sent to ${selectedMemberData?.name}`,
        });
      } else if (data.status === "failed") {
        setStep("failed");
        toast({
          title: "Disbursement Failed",
          description: data.error || "Payment was cancelled or failed.",
          variant: "destructive",
        });
      } else {
        // Still pending, poll again
        setTimeout(
          () => pollDisbursementStatus(reference, disbId, attempts + 1),
          3000
        );
      }
    } catch (error) {
      console.error("Polling error:", error);
      // Retry even on network errors
      setTimeout(
        () => pollDisbursementStatus(reference, disbId, attempts + 1),
        3000
      );
    }
  };

  const resetDialog = () => {
    setStep("setup");
    setSelectedMember("");
    setAmount("");
    setIsProcessing(false);
    setTransactionId("");
    setTransactionReference("");
    setDisbursementId("");
    setAdminPhone("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-mpesa-green" />
            Send Mobile Money Payment
          </DialogTitle>
          <DialogDescription>
            {step === "setup" && "Select member and enter amount to disburse"}
            {step === "confirm" && "Confirm payment details before sending"}
            {step === "processing" && "Sending authorization request..."}
            {step === "waiting" && "Waiting for admin authorization via STK"}
            {step === "success" && "Payment sent successfully!"}
            {step === "failed" && "Payment transfer failed"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Setup */}
        {step === "setup" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Select Recipient</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem
                      key={member._id || member.id}
                      value={member._id || member.id || ""}>
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
              variant="mpesa">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "confirm" && selectedMemberData && (
          <div className="space-y-4">
            <Card className="bg-mpesa-green/5 border-mpesa-green/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <div className="text-right">
                      <div className="font-medium">
                        {selectedMemberData.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedMemberData.phone}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Amount:
                    </span>
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
                    Funds will be sent directly to member's M-Pesa account via
                    Lipia Online.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("setup")}>
                Back
              </Button>
              <Button
                onClick={handleInitiateDisbursement}
                className="flex-1"
                variant="mpesa"
                disabled={isProcessing}>
                Send Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-mpesa-green/10 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-mpesa-green animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold">Sending Authorization</h3>
                <p className="text-sm text-muted-foreground">
                  Sending STK Push to admin for authorization...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Waiting for Admin Authorization */}
        {step === "waiting" && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Phone className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">Authorization Required</h3>
                <p className="text-sm text-muted-foreground">
                  STK Push sent to admin {adminPhone}
                </p>
                <p className="text-sm font-medium text-amber-600 mt-2">
                  Please check your phone and enter M-Pesa PIN
                </p>
              </div>
            </div>

            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold">
                      KES {parseInt(amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipient:</span>
                    <span>{selectedMemberData?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span>{selectedMemberData?.phone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="flex gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Secure Payment</p>
                  <p className="text-blue-700">
                    Funds will be sent after authorization. This may take up to
                    60 seconds.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Waiting for authorization...</span>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === "success" && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-financial-success/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-financial-success" />
              </div>
              <div>
                <h3 className="font-semibold text-financial-success">
                  Transfer Successful!
                </h3>
                <p className="text-sm text-muted-foreground">
                  KES {parseInt(amount).toLocaleString()} has been sent to{" "}
                  {selectedMemberData?.name}
                </p>
              </div>
            </div>

            <Card className="bg-financial-success/5 border-financial-success/20">
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Transaction ID:
                    </span>
                    <span className="font-mono">
                      {transactionId || `LP${Date.now().toString().slice(-8)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipient:</span>
                    <span>{selectedMemberData?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold">
                      KES {parseInt(amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleClose} className="w-full" variant="mpesa">
              Done
            </Button>
          </div>
        )}

        {/* Step 6: Failed */}
        {step === "failed" && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive">
                  Transfer Failed
                </h3>
                <p className="text-sm text-muted-foreground">
                  The disbursement could not be completed. Please try again.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                className="flex-1"
                variant="mpesa">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MpesaDisbursementDialog;
