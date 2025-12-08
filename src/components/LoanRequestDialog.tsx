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
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
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
  const { toast } = useToast();

  // validation assumptions
  const MIN_AMOUNT = 1000;
  const MAX_AMOUNT = 500000;
  const MIN_TERM = 1; // months
  const MAX_TERM = 60; // months
  const MIN_INTEREST = 0.1;
  const MAX_INTEREST = 100;

  useEffect(() => {
    setPhone(memberPhone || "");
  }, [memberPhone]);

  const handleSubmit = async () => {
    const errs: any = {};
    const amt = Number(amount);
    const trm = Number(term);
    const ir = Number(interest);
    if (!phone) errs.phone = "Phone is required";
    if (!purpose || purpose.trim().length === 0)
      errs.purpose = "Purpose is required";
    if (!amount || isNaN(amt)) errs.amount = "Enter a valid amount";
    else if (amt < MIN_AMOUNT)
      errs.amount = `Minimum amount is KES ${MIN_AMOUNT.toLocaleString()}`;
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
    try {
      const body = {
        amount: amt,
        purpose: purpose.trim(),
        interest_rate: ir,
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
      if (onSubmitted) onSubmitted();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Could not submit loan request",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base sm:text-lg">
            Request a Loan
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Fill in the details below and submit your loan request to the admin.
          </DialogDescription>
        </DialogHeader>
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

            <div className="flex gap-2">
              <Button onClick={handleSubmit} variant="default">
                Submit Request
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default LoanRequestDialog;
