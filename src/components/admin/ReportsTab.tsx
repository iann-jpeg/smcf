import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const ReportsTab = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports & Exports</CardTitle>
        <CardDescription>Generate exportable financial and activity reports</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Exports: Savings history, Loan summaries, Income vs Expenditure</div>
          <div className="flex gap-2 mt-4">
            <button className="btn">Export CSV</button>
            <button className="btn">Export PDF</button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportsTab;
