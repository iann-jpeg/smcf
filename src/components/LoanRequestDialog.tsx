import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CreditScoreCard from "@/components/CreditScoreCard";
import LoanTermsAgreement from "@/components/LoanTermsAgreement";
import GuarantorSelector from "@/components/GuarantorSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface LoanRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId?: string;
  memberPhone?: string;
  onSubmitted?: () => void;
}

const LoanRequestDialog = ({
  open,
  onOpenChange,
  memberId,
  memberPhone,
  onSubmitted,
}: LoanRequestDialogProps) => {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [term] = useState("1"); // Fixed: 1 month
  const [interest] = useState("10"); // Fixed: 10%
  const [phone, setPhone] = useState(memberPhone || "");
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAcceptanceId, setTermsAcceptanceId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTab, setCurrentTab] = useState("credit-score");
  const [selectedGuarantors, setSelectedGuarantors] = useState<string[]>([]);
  const { toast } = useToast();

  // validation assumptions
  const MAX_AMOUNT = 500000;
  const MIN_TERM = 1; // months
  const MAX_TERM = 60; // months
  const MIN_INTEREST = 0.1;
  const MAX_INTEREST = 100;

  useEffect(() => {
    setPhone(memberPhone || "");
    // Reset state when dialog opens
    if (open) {
      setTermsAccepted(false);
      setTermsAcceptanceId(null);
      setCurrentTab("credit-score");
      setSelectedGuarantors([]);
    }
  }, [memberPhone, open]);

  // Handle terms acceptance
  const handleTermsAcceptance = async (accepted: boolean) => {
    setTermsAccepted(accepted);
    
    if (accepted && !termsAcceptanceId) {
      try {
        // Log acceptance to backend
        const res = await fetch(`${API_BASE}/api/loans/accept-terms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            policyVersion: "SMCF-LOAN-POLICY-2026-01",
            userAgent: navigator.userAgent,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setTermsAcceptanceId(data.data.acceptanceId);
          toast({
            title: "Terms Accepted",
            description: "Your acceptance has been recorded. You may now proceed with your application.",
          });
        } else {
          throw new Error(data.error || "Failed to record acceptance");
        }
      } catch (e: any) {
        console.error("Error recording terms acceptance:", e);
        setTermsAccepted(false);
        toast({
          title: "Error",
          description: "Failed to record terms acceptance. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async () => {
    const errs: any = {};
    const amt = Number(amount);
    const trm = Number(term);
    const ir = Number(interest);
    
    if (!termsAccepted || !termsAcceptanceId) {
      toast({
        title: "Terms Not Accepted",
        description: "You must accept the loan terms and conditions before submitting your application.",
        variant: "destructive",
      });
      return;
    }
    
    if (!phone) errs.phone = "Phone is required";
    if (!purpose || purpose.trim().length === 0)
      errs.purpose = "Purpose is required";
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = "Enter a valid amount";
    else if (amt > MAX_AMOUNT)
      errs.amount = `Maximum amount is KES ${MAX_AMOUNT.toLocaleString()}`;
    if (!term || isNaN(trm)) errs.term = "Enter a valid term (months)";
    else if (trm < MIN_TERM || trm > MAX_TERM)
      errs.term = `Term must be between ${MIN_TERM} and ${MAX_TERM} months`;
    if (!interest || isNaN(ir)) errs.interest = "Enter valid interest rate";
    else if (ir < MIN_INTEREST || ir > MAX_INTEREST)
      errs.interest = `Interest must be between ${MIN_INTEREST}% and ${MAX_INTEREST}%`;

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast({
        title: "Validation error",
        description: "Please correct the highlighted fields",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const body = {
        amount: amt,
        purpose: purpose.trim(),
        interest_rate: ir,
        termsAcceptanceId: termsAcceptanceId,
        guarantor_ids: selectedGuarantors,
      };
      const res = await fetch(`${API_BASE}/api/loans/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit loan request");
      }

      toast({
        title: "Loan Requested",
        description: `Loan request for KES ${amt.toLocaleString()} submitted successfully`,
      });
      onOpenChange(false);
      setAmount("");
      setPurpose("");
      setTermsAccepted(false);
      setTermsAcceptanceId(null);
      if (onSubmitted) onSubmitted();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Could not submit loan request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base sm:text-lg">
            Request a Loan
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Check your credit score and submit your loan request
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="credit-score">Credit Score</TabsTrigger>
            <TabsTrigger value="terms">
              Terms & Conditions
              {termsAccepted && <CheckCircle className="ml-1 w-3 h-3 text-financial-success" />}
            </TabsTrigger>
            <TabsTrigger value="loan-form" disabled={!termsAccepted}>
              Application
            </TabsTrigger>
            <TabsTrigger value="guarantors" disabled={!amount || Number(amount) <= 0}>
              Guarantors
              {selectedGuarantors.length >= 2 && <CheckCircle className="ml-1 w-3 h-3 text-financial-success" />}
            </TabsTrigger>
          </TabsList>

          {/* Credit Score Tab */}
          <TabsContent value="credit-score" className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Before applying:</strong> Review your credit score to understand your loan eligibility. 
                A score of 70+ is recommended for approval.
              </p>
            </div>
            <CreditScoreCard showTitle={true} />
            <div className="flex justify-end">
              <Button onClick={() => setCurrentTab("terms")}>
                Continue to Terms & Conditions →
              </Button>
            </div>
          </TabsContent>

          {/* Terms & Conditions Tab */}
          <TabsContent value="terms" className="space-y-4">
            <LoanTermsAgreement 
              onAcceptanceChange={handleTermsAcceptance}
              isAccepted={termsAccepted}
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentTab("credit-score")}>
                ← Back to Credit Score
              </Button>
              <Button 
                onClick={() => setCurrentTab("loan-form")}
                disabled={!termsAccepted}
              >
                {termsAccepted ? (
                  <>Continue to Application →</>
                ) : (
                  <>Accept Terms to Continue</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Loan Form Tab */}
          <TabsContent value="loan-form">
            {!termsAccepted && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg mb-4">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ You must accept the Terms & Conditions before filling out this form.
                </p>
              </div>
            )}
            <Card>
              <CardContent className="space-y-3 pt-3 sm:pt-4">
                <div>
                  <Label>Loan Amount (KES)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5,000"
                    min={1000}
                  />
                  {errors.amount && (
                    <div className="text-xs text-destructive mt-1">
                      {errors.amount}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Purpose of Loan</Label>
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Business capital, Emergency, etc."
                  />
                  {errors.purpose && (
                    <div className="text-xs text-destructive mt-1">
                      {errors.purpose}
                    </div>
                  )}
                </div>

                {/* Fixed loan terms info */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Loan Term:</span>
                    <span className="font-medium">1 Month</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Interest Rate:</span>
                    <span className="font-medium">10%</span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Total repayment amount:{" "}
                  <strong>
                    {useMemo(() => {
                      const P = Number(amount) || 0;
                      if (!P) return "—";
                      // Simple calculation: Principal + 10% interest
                      const totalRepayment = P + (P * 0.10);
                      return `KES ${Math.round(totalRepayment).toLocaleString()}`;
                    }, [amount])}
                  </strong>
                </div>

                {termsAccepted && (
                  <div className="bg-financial-success/10 border border-financial-success/20 p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-financial-success flex-shrink-0" />
                    <span className="text-xs text-financial-success font-medium">
                      Terms accepted - Application ready for submission
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentTab("terms")}>
                    ← Back to Terms
                  </Button>
                  <Button 
                    onClick={() => setCurrentTab("guarantors")}
                    disabled={!amount || Number(amount) <= 0}
                  >
                    Continue to Guarantors →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guarantors Tab */}
          <TabsContent value="guarantors" className="space-y-4">
            <GuarantorSelector
              loanAmount={Number(amount) || 0}
              selectedGuarantors={selectedGuarantors}
              onSelectionChange={setSelectedGuarantors}
              minRequired={2}
            />
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentTab("loan-form")}>
                ← Back to Application
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!termsAccepted || isSubmitting || selectedGuarantors.length < 2}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  `Submit Request (${selectedGuarantors.length}/2 guarantors selected)`
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default LoanRequestDialog;
