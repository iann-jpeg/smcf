import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, Edit, Trash2, Download, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

// Mock data - will be replaced with API calls
const mockShareholders = [
  {
    id: 'SH-001',
    name: 'John Kiprotich',
    email: 'john.kiprotich@example.com',
    phone: '+254712345678',
    category: 'Staff',
    sharesOwned: 150,
    shareValue: 150000,
    joinDate: '2020-01-15',
    status: 'Active',
    certificateNo: 'CERT-2020-001',
    beneficiary: 'Mary Kiprotich'
  },
  {
    id: 'SH-002',
    name: 'Jane Kipchoge',
    email: 'jane.kipchoge@example.com',
    phone: '+254723456789',
    category: 'Supplier',
    sharesOwned: 85,
    shareValue: 85000,
    joinDate: '2020-03-20',
    status: 'Active',
    certificateNo: 'CERT-2020-002',
    beneficiary: 'Joseph Kipchoge'
  },
  {
    id: 'SH-003',
    name: 'Peter Mwangi',
    email: 'peter.mwangi@example.com',
    phone: '+254734567890',
    category: 'Member',
    sharesOwned: 120,
    shareValue: 120000,
    joinDate: '2021-06-10',
    status: 'Active',
    certificateNo: 'CERT-2021-001',
    beneficiary: 'Ruth Mwangi'
  },
  {
    id: 'SH-004',
    name: 'Samuel Kiplagat',
    email: 'samuel.kiplagat@example.com',
    phone: '+254745678901',
    category: 'Director',
    sharesOwned: 200,
    shareValue: 200000,
    joinDate: '2019-09-05',
    status: 'Active',
    certificateNo: 'CERT-2019-001',
    beneficiary: 'David Kiplagat'
  },
  {
    id: 'SH-005',
    name: 'Grace Ochieng',
    email: 'grace.ochieng@example.com',
    phone: '+254756789012',
    category: 'Staff',
    sharesOwned: 95,
    shareValue: 95000,
    joinDate: '2022-01-12',
    status: 'Inactive',
    certificateNo: 'CERT-2022-015',
    beneficiary: 'Lucy Ochieng'
  },
  {
    id: 'SH-006',
    name: 'Robert Kimani',
    email: 'robert.kimani@example.com',
    phone: '+254767890123',
    category: 'Supplier',
    sharesOwned: 140,
    shareValue: 140000,
    joinDate: '2020-08-18',
    status: 'Pending',
    certificateNo: 'CERT-PENDING',
    beneficiary: 'Patricia Kimani'
  }
];

export function ShareholdersTab({ searchQuery }) {
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [selectedShareholder, setSelectedShareholder] = useState(null);

  const filteredShareholders = useMemo(() => {
    return mockShareholders.filter(shareholder => {
      const matchesSearch = !searchQuery || 
        shareholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shareholder.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shareholder.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = status === 'all' || shareholder.status.toLowerCase() === status.toLowerCase();
      const matchesCategory = category === 'all' || shareholder.category.toLowerCase() === category.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [searchQuery, status, category]);

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'inactive':
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with New Shareholder Button */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Shareholders Directory</CardTitle>
          <CardDescription>Manage and view all shareholders</CardDescription>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Shareholder
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shareholders Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">
                Showing {filteredShareholders.length} of {mockShareholders.length} shareholders
              </p>
            </div>
            <Badge variant="outline">{filteredShareholders.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Value (KES)</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShareholders.map((shareholder) => (
                  <TableRow key={shareholder.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-sm font-semibold">{shareholder.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{shareholder.name}</p>
                        <p className="text-sm text-gray-600">{shareholder.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{shareholder.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{shareholder.sharesOwned}</TableCell>
                    <TableCell className="text-right">{shareholder.shareValue.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(shareholder.joinDate).toLocaleDateString('en-KE')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(shareholder.status)}
                        <Badge className={getStatusBadgeColor(shareholder.status)} variant="secondary">
                          {shareholder.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="gap-1" title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1" title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1" title="Certificate">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Stats Footer */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total in View</p>
            <p className="text-2xl font-bold">{filteredShareholders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Shares</p>
            <p className="text-2xl font-bold">
              {filteredShareholders.reduce((sum, s) => sum + s.sharesOwned, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-2xl font-bold">
              KES {(filteredShareholders.reduce((sum, s) => sum + s.shareValue, 0) / 1000000).toFixed(1)}M
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Avg Holdings</p>
            <p className="text-2xl font-bold">
              {Math.round(filteredShareholders.reduce((sum, s) => sum + s.sharesOwned, 0) / filteredShareholders.length) || 0}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
