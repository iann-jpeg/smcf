import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ApprovalsTab = () => {
  const [pending, setPending] = useState<any[]>([]);

  const fetchPending = async () => {
    try {
      const res = await fetch('/api/loans');
      const data = await res.json();
      setPending(data.filter((d: any) => d.status === 'requested'));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchPending(); }, []);

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Transactions and requests that need approval</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending items</div>
          ) : (
            pending.map(p => (
              <div key={p._id || p.id} className="p-3 border rounded-md mb-2">
                <div className="font-medium">{p.member_id || p.member}</div>
                <div className="text-sm text-muted-foreground">{p.amount} • {p.status}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm">Approve</Button>
                  <Button size="sm" variant="destructive">Reject</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalsTab;
