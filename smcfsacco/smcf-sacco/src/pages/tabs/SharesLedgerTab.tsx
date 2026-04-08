import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Download, Printer, Plus } from 'lucide-react';

// Mock shares transactions data
const mockTransactions = [
  {
    id: 'TXN-0001',
    date: '2024-01-15',
    shareholderId: 'SH-001',
    shareholderName: 'John Kiprotich',
    transactionType: 'Purchase',
    quantity: 50,
    pricePerShare: 1000,
    amount: 50000,
    description: 'Initial share purchase',
    status: 'Completed'
  },
  {
    id: 'TXN-0002',
    date: '2024-01-20',
    shareholderId: 'SH-002',
    shareholderName: 'Jane Kipchoge',
    transactionType: 'Purchase',
    quantity: 35,
    pricePerShare: 1000,
    amount: 35000,
    description: 'Share purchase - Staff benefit',
    status: 'Completed'
  },
  {
    id: 'TXN-0003',
    date: '2024-02-05',
    shareholderId: 'SH-003',
    shareholderName: 'Peter Mwangi',
    transactionType: 'Purchase',
    quantity: 60,
    pricePerShare: 1000,
    amount: 60000,
    description: 'Member share purchase',
    status: 'Completed'
  },
  {
    id: 'TXN-0004',
    date: '2024-02-14',
    shareholderId: 'SH-001',
    shareholderName: 'John Kiprotich',
    transactionType: 'Transfer',
    quantity: 20,
    pricePerShare: 1000,
    amount: 20000,
    description: 'Transfer to Mary Kiprotich',
    status: 'Completed'
  },
  {
    id: 'TXN-0005',
    date: '2024-03-01',
    shareholderId: 'SH-004',
    shareholderName: 'Samuel Kiplagat',
    transactionType: 'Dividend',
    quantity: 0,
    pricePerShare: 0,
    amount: 15000,
    description: '2023 Final Dividend - 75 per share',
    status: 'Completed'
  },
  {
    id: 'TXN-0006',
    date: '2024-03-10',
    shareholderId: 'SH-005',
    shareholderName: 'Grace Ochieng',
    transactionType: 'Redemption',
    quantity: 30,
    pricePerShare: 1000,
    amount: 30000,
    description: 'Share redemption upon exit',
    status: 'Pending'
  },
  {
    id: 'TXN-0007',
    date: '2024-03-20',
    shareholderId: 'SH-006',
    shareholderName: 'Robert Kimani',
    transactionType: 'Purchase',
    quantity: 70,
    pricePerShare: 1000,
    amount: 70000,
    description: 'Supplier share subscription',
    status: 'Completed'
  },
  {
    id: 'TXN-0008',
    date: '2024-04-05',
    shareholderId: 'SH-002',
    shareholderName: 'Jane Kipchoge',
    transactionType: 'Purchase',
    quantity: 15,
    pricePerShare: 1000,
    amount: 15000,
    description: 'Additional share purchase',
    status: 'Completed'
  }
];

export function SharesLedgerTab({ dateFilter, searchQuery }) {
  const [transactionType, setTransactionType] = useState('all');

  const filteredTransactions = useMemo(() => {
    return mockTransactions.filter(txn => {
      const matchesSearch = !searchQuery || 
        txn.shareholderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.shareholderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = transactionType === 'all' || txn.transactionType === transactionType;

      const txnDate = new Date(txn.date);
      const fromDate = dateFilter.from ? new Date(dateFilter.from) : null;
      const toDate = dateFilter.to ? new Date(dateFilter.to) : null;
      
      const matchesFromDate = !fromDate || txnDate >= fromDate;
      const matchesToDate = !toDate || txnDate <= toDate;

      return matchesSearch && matchesType && matchesFromDate && matchesToDate;
    });
  }, [searchQuery, transactionType, dateFilter]);

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'Purchase':
        return <ArrowDown className="h-4 w-4 text-blue-600" />;
      case 'Sale':
        return <ArrowUp className="h-4 w-4 text-red-600" />;
      case 'Transfer':
        return <ArrowUp className="h-4 w-4 text-purple-600" />;
      case 'Dividend':
        return <ArrowDown className="h-4 w-4 text-green-600" />;
      case 'Redemption':
        return <ArrowUp className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'Purchase':
        return 'bg-blue-100 text-blue-800';
      case 'Sale':
        return 'bg-red-100 text-red-800';
      case 'Transfer':
        return 'bg-purple-100 text-purple-800';
      case 'Dividend':
        return 'bg-green-100 text-green-800';
      case 'Redemption':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalTransactionValue = filteredTransactions.reduce((sum, txn) => sum + txn.amount, 0);
  const totalQuantity = filteredTransactions.reduce((sum, txn) => sum + txn.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Share Transactions Ledger</CardTitle>
          <CardDescription>All share purchases, transfers, dividends and redemptions</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Transaction
          </Button>
        </div>
      </div>

      {/* Filter Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Transaction Type</label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                  <SelectItem value="Sale">Sale</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Dividend">Dividend</SelectItem>
                  <SelectItem value="Redemption">Redemption</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {filteredTransactions.length} of {mockTransactions.length} transactions
            </p>
            <Badge variant="outline">{filteredTransactions.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Shareholder</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Price/Share</TableHead>
                  <TableHead className="text-right">Amount (KES)</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id} className="hover:bg-gray-50">
                    <TableCell className="text-sm">
                      {new Date(txn.date).toLocaleDateString('en-KE')}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">{txn.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{txn.shareholderName}</p>
                        <p className="text-sm text-gray-600">{txn.shareholderId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(txn.transactionType)}
                        <Badge className={getTransactionColor(txn.transactionType)} variant="secondary">
                          {txn.transactionType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {txn.quantity > 0 ? txn.quantity : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {txn.pricePerShare > 0 ? `${txn.pricePerShare.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {txn.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {txn.description}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={txn.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                      >
                        {txn.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Transactions</p>
            <p className="text-3xl font-bold mt-1">{filteredTransactions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Share Quantity</p>
            <p className="text-3xl font-bold mt-1">{totalQuantity.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Transaction Value</p>
            <p className="text-3xl font-bold mt-1">KES {(totalTransactionValue / 1000000).toFixed(1)}M</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
