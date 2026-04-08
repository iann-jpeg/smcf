import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Download, Eye, CheckCircle2, Clock } from 'lucide-react';

// Mock dividend data
const dividendDeclarations = [
  {
    id: 'DIV-2025-01',
    year: 2025,
    period: 'Full Year 2024',
    declaredDate: '2025-03-15',
    recordDate: '2025-03-20',
    paymentDate: '2025-04-10',
    totalAmount: 8950000,
    sharesOutstanding: 45680,
    dividendPerShare: 196,
    status: 'Approved',
    approvedBy: 'Board of Directors'
  },
  {
    id: 'DIV-2024-02',
    year: 2024,
    period: 'H2 2023',
    declaredDate: '2024-06-20',
    recordDate: '2024-06-25',
    paymentDate: '2024-07-15',
    totalAmount: 1600000,
    sharesOutstanding: 44320,
    dividendPerShare: 36,
    status: 'Paid',
    approvedBy: 'Board of Directors'
  },
  {
    id: 'DIV-2024-01',
    year: 2024,
    period: 'H1 2023',
    declaredDate: '2024-01-18',
    recordDate: '2024-01-25',
    paymentDate: '2024-02-15',
    totalAmount: 1250000,
    sharesOutstanding: 42580,
    dividendPerShare: 29,
    status: 'Paid',
    approvedBy: 'Board of Directors'
  },
  {
    id: 'DIV-2023-02',
    year: 2023,
    period: 'H2 2022',
    declaredDate: '2023-09-10',
    recordDate: '2023-09-15',
    paymentDate: '2023-10-05',
    totalAmount: 1100000,
    sharesOutstanding: 40000,
    dividendPerShare: 27.5,
    status: 'Paid',
    approvedBy: 'Board of Directors'
  }
];

const dividendPayments = [
  { id: 'PAY-001', shareholderId: 'SH-001', shareholderName: 'John Kiprotich', shares: 150, dividendId: 'DIV-2025-01', amount: 29400, paymentDate: '2025-04-10', status: 'Paid' },
  { id: 'PAY-002', shareholderId: 'SH-002', shareholderName: 'Jane Kipchoge', shares: 85, dividendId: 'DIV-2025-01', amount: 16660, paymentDate: '2025-04-10', status: 'Paid' },
  { id: 'PAY-003', shareholderId: 'SH-003', shareholderName: 'Peter Mwangi', shares: 120, dividendId: 'DIV-2025-01', amount: 23520, paymentDate: '2025-04-10', status: 'Paid' },
  { id: 'PAY-004', shareholderId: 'SH-004', shareholderName: 'Samuel Kiplagat', shares: 200, dividendId: 'DIV-2025-01', amount: 39200, paymentDate: '2025-04-11', status: 'Processing' },
  { id: 'PAY-005', shareholderId: 'SH-006', shareholderName: 'Robert Kimani', shares: 140, dividendId: 'DIV-2025-01', amount: 27440, paymentDate: '2025-04-12', status: 'Pending' }
];

export function DividendsTab() {
  const [activeTab, setActiveTab] = useState('declarations');

  const totalDeclaredAmount = dividendDeclarations.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalPaidAmount = dividendPayments
    .filter(p => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Dividend Management</CardTitle>
          <CardDescription>Declare, approve, and manage dividend distributions to shareholders</CardDescription>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Declare Dividend
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Declared (All Time)</p>
            <p className="text-3xl font-bold">KES {(totalDeclaredAmount / 1000000).toFixed(1)}M</p>
            <Badge className="mt-2 bg-blue-100 text-blue-800">4 declarations</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Latest Dividend</p>
            <p className="text-3xl font-bold">KES {dividendDeclarations[0].dividendPerShare}</p>
            <p className="text-xs text-gray-600 mt-1">Per share • {dividendDeclarations[0].period}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">YTD Paid Out</p>
            <p className="text-3xl font-bold">KES {(totalPaidAmount / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-green-600 mt-1">to {dividendPayments.filter(p => p.status === 'Paid').length} shareholders</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="declarations">Dividend Declarations</TabsTrigger>
          <TabsTrigger value="payments">Payment Status</TabsTrigger>
        </TabsList>

        {/* Dividend Declarations Tab */}
        <TabsContent value="declarations" className="space-y-4">
          <Card>
            <CardHeader>
              <p className="text-sm text-gray-600">
                {dividendDeclarations.length} dividend declarations on record
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Declared Date</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead className="text-right">Per Share (KES)</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dividendDeclarations.map((dividend) => (
                      <TableRow key={dividend.id} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-sm font-semibold">{dividend.id}</TableCell>
                        <TableCell className="font-medium">{dividend.period}</TableCell>
                        <TableCell>{new Date(dividend.declaredDate).toLocaleDateString('en-KE')}</TableCell>
                        <TableCell>{new Date(dividend.paymentDate).toLocaleDateString('en-KE')}</TableCell>
                        <TableCell className="text-right font-bold">{dividend.dividendPerShare.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {dividend.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={dividend.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
                            variant="secondary"
                          >
                            {dividend.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Status Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <p className="text-sm text-gray-600">
                {dividendPayments.length} payments tracked for current dividend cycle
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Shareholder</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dividendPayments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.shareholderName}</p>
                            <p className="text-xs text-gray-600">{payment.shareholderId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{payment.shares}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {payment.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>{new Date(payment.paymentDate).toLocaleDateString('en-KE')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {payment.status === 'Paid' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            {payment.status === 'Processing' && <Clock className="h-4 w-4 text-blue-600" />}
                            <Badge 
                              className={
                                payment.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                payment.status === 'Processing' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }
                              variant="secondary"
                            >
                              {payment.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
