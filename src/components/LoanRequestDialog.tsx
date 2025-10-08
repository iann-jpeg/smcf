import { useEffect, useMemo, useState } from 'react';
import API_BASE from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface LoanRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId?: string;
  memberPhone?: string;
  onSubmitted?: () => void;
}

const LoanRequestDialog = ({ open, onOpenChange, memberId, memberPhone, onSubmitted }: LoanRequestDialogProps) => {
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [interest, setInterest] = useState('5');
  const [phone, setPhone] = useState(memberPhone || '');
  const [errors, setErrors] = useState<{[k:string]: string}>({});
  const { toast } = useToast();

  // validation assumptions
  const MIN_AMOUNT = 1000;
  const MAX_AMOUNT = 500000;
  const MIN_TERM = 1; // months
  const MAX_TERM = 60; // months
  const MIN_INTEREST = 0.1;
  const MAX_INTEREST = 100;

  useEffect(() => { setPhone(memberPhone || ''); }, [memberPhone]);

  const handleSubmit = async () => {
    const errs: any = {};
    const amt = Number(amount);
    const trm = Number(term);
    const ir = Number(interest);
    if (!phone) errs.phone = 'Phone is required';
    if (!amount || isNaN(amt)) errs.amount = 'Enter a valid amount';
    else if (amt < MIN_AMOUNT) errs.amount = `Minimum amount is KES ${MIN_AMOUNT.toLocaleString()}`;
    else if (amt > MAX_AMOUNT) errs.amount = `Maximum amount is KES ${MAX_AMOUNT.toLocaleString()}`;
    if (!term || isNaN(trm)) errs.term = 'Enter a valid term (months)';
    else if (trm < MIN_TERM || trm > MAX_TERM) errs.term = `Term must be between ${MIN_TERM} and ${MAX_TERM} months`;
    if (!interest || isNaN(ir)) errs.interest = 'Enter valid interest rate';
    else if (ir < MIN_INTEREST || ir > MAX_INTEREST) errs.interest = `Interest must be between ${MIN_INTEREST}% and ${MAX_INTEREST}%`;

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast({ title: 'Validation error', description: 'Please correct the highlighted fields', variant: 'destructive' });
      return;
    }
    try {
      const body = {
        member_id: memberId,
        phone: phone,
        amount: amt,
        term_months: trm,
        interest_rate: ir,
        status: 'requested'
      };
      const res = await fetch(`${API_BASE}/api/loans`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast({ title: 'Loan Requested', description: `Loan request for KES ${data.amount} submitted` });
      onOpenChange(false);
      setAmount(''); setTerm(''); setInterest('5');
      if (onSubmitted) onSubmitted();
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not submit loan request', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Loan</DialogTitle>
          <DialogDescription>Fill in the details below and submit your loan request to the admin.</DialogDescription>
        </DialogHeader>
        <Card>
          <CardContent className="space-y-3">
            <div>
              <Label>Phone (M-Pesa)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +254712345678" />
              {errors.phone && <div className="text-xs text-destructive mt-1">{errors.phone}</div>}
            </div>

            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5,000" min={1000} />
              {errors.amount && <div className="text-xs text-destructive mt-1">{errors.amount}</div>}
            </div>

            <div>
              <Label>Term (months)</Label>
              <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. 6" min={1} max={60} />
              {errors.term && <div className="text-xs text-destructive mt-1">{errors.term}</div>}
            </div>

            <div>
              <Label>Interest Rate (%)</Label>
              <Input type="number" value={interest} onChange={(e) => setInterest(e.target.value)} step="0.1" min="0.1" />
              {errors.interest && <div className="text-xs text-destructive mt-1">{errors.interest}</div>}
            </div>

            <div className="text-sm text-muted-foreground">
              Estimated monthly repayment: <strong>{useMemo(() => {
                const P = Number(amount) || 0;
                const r = (Number(interest) || 0) / 100 / 12;
                const n = Number(term) || 1;
                if (!P || n <= 0) return '—';
                // amortized loan payment
                const payment = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
                return `KES ${Math.round(payment).toLocaleString()}`;
              }, [amount, term, interest])}</strong>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} variant="default">Submit Request</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default LoanRequestDialog;
