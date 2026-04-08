import { useState } from 'react';
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
import { FileText, Download, Eye, Upload, ExternalLink } from 'lucide-react';

const documents = [
  {
    id: 1,
    title: 'SACCO Constitution',
    description: 'Main governing constitution of Smart Money Cash Flow SACCO',
    category: 'Governance',
    version: '2.1',
    lastUpdated: '2024-01-15',
    size: '2.4 MB',
    status: 'Active'
  },
  {
    id: 2,
    title: 'Share Issuance Policy',
    description: 'Policy governing share issuance, pricing, and transfer procedures',
    category: 'Shares',
    version: '1.5',
    lastUpdated: '2023-08-20',
    size: '1.8 MB',
    status: 'Active'
  },
  {
    id: 3,
    title: 'Dividend Declaration Policy',
    description: 'Guidelines and procedures for dividend declaration and distribution',
    category: 'Dividends',
    version: '2.0',
    lastUpdated: '2024-02-10',
    size: '1.2 MB',
    status: 'Active'
  },
  {
    id: 4,
    title: 'Member Code of Conduct',
    description: 'Code of conduct and ethical standards for all members',
    category: 'Ethics',
    version: '1.2',
    lastUpdated: '2023-11-05',
    size: '0.9 MB',
    status: 'Active'
  },
  {
    id: 5,
    title: 'Risk Management Framework',
    description: 'Comprehensive risk management and mitigation strategies',
    category: 'Risk',
    version: '1.8',
    lastUpdated: '2024-03-01',
    size: '3.1 MB',
    status: 'Active'
  },
  {
    id: 6,
    title: 'Internal Audit Charter',
    description: 'Charter and scope of internal audit functions',
    category: 'Audit',
    version: '1.3',
    lastUpdated: '2023-10-12',
    size: '1.5 MB',
    status: 'Review'
  },
  {
    id: 7,
    title: 'Data Protection Policy',
    description: 'Data protection and privacy policy for member information',
    category: 'Compliance',
    version: '1.6',
    lastUpdated: '2024-01-20',
    size: '1.1 MB',
    status: 'Active'
  },
  {
    id: 8,
    title: 'Beneficiary Designation Form',
    description: 'Template and guidelines for beneficiary designation',
    category: 'Forms',
    version: '1.1',
    lastUpdated: '2023-07-15',
    size: '0.5 MB',
    status: 'Active'
  }
];

const categories = ['All', 'Governance', 'Shares', 'Dividends', 'Ethics', 'Risk', 'Audit', 'Compliance', 'Forms'];

export function PoliciesDocumentsTab() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredDocuments = selectedCategory === 'All' 
    ? documents 
    : documents.filter(doc => doc.category === selectedCategory);

  const getCategoryColor = (category) => {
    const colors = {
      'Governance': 'bg-blue-100 text-blue-800',
      'Shares': 'bg-green-100 text-green-800',
      'Dividends': 'bg-purple-100 text-purple-800',
      'Ethics': 'bg-indigo-100 text-indigo-800',
      'Risk': 'bg-red-100 text-red-800',
      'Audit': 'bg-yellow-100 text-yellow-800',
      'Compliance': 'bg-orange-100 text-orange-800',
      'Forms': 'bg-pink-100 text-pink-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <CardTitle>Policies & Governance Documents</CardTitle>
          <CardDescription>Manage SACCO governance documents, policies, and procedures</CardDescription>
        </div>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Category Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {filteredDocuments.length} of {documents.length} documents
            </p>
            <Badge variant="outline">{filteredDocuments.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-sm text-gray-600">{doc.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(doc.category)} variant="secondary">
                        {doc.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{doc.version}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(doc.lastUpdated).toLocaleDateString('en-KE')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{doc.size}</TableCell>
                    <TableCell>
                      <Badge 
                        className={doc.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                        variant="secondary"
                      >
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Download">
                          <Download className="h-4 w-4" />
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

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="justify-start h-16 gap-3">
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Member Handbook</p>
                <p className="text-xs text-gray-600">Complete guide for members</p>
              </div>
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
            <Button variant="outline" className="justify-start h-16 gap-3">
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Annual Reports</p>
                <p className="text-xs text-gray-600">2020-2025 archive</p>
              </div>
              <ExternalLink className="ml-auto h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
