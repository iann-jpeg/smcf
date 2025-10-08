import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const LoansTab = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchLoans = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/api/loans`);
      const data = await res.json();
      setLoans(data);
    } catch (e) {
      console.error('Fetch loans error', e);
    }
  };

  useEffect(() => { fetchLoans(); const t = setInterval(fetchLoans, 15000); return () => clearInterval(t); }, []);

  const approve = async (id: string) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/api/loans/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() }) });
      const updated = await res.json();
      toast({ title: 'Loan Approved', description: `Loan ${id} approved` });
      setLoans(prev => prev.map(l => l._id === id ? updated : l));
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not approve loan', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
          <CardDescription>Manage loan requests and statuses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <div />
              <div className="flex gap-2">
                <Button size="sm" onClick={fetchLoans}>Refresh</Button>
              </div>
            </div>
            {loans.length === 0 && <div className="text-sm text-muted-foreground">No loans found</div>}
            {loans.map((loan) => (
              <div key={loan._id || loan.id} className="p-3 border rounded-md flex items-center justify-between">
                <div>
                  <div className="font-medium">{loan.member_name || (loan.member_id && loan.member_id.name) || loan.phone || loan.member}</div>
                  <div className="text-sm text-muted-foreground">KES {loan.amount} • {loan.status} • {loan.term_months} months</div>
                  <div className="text-xs text-muted-foreground">Phone: {loan.phone}</div>
                </div>
                <div className="flex gap-2">
                  {loan.status === 'requested' && (
                    <Button size="sm" onClick={() => approve(loan._id || loan.id)}>Approve</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoansTab;
