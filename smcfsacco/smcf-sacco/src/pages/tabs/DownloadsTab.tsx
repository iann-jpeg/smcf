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
import { Download, FileText, Clock, CheckCircle2 } from 'lucide-react';

const downloads = [
  {
    id: 1,
    title: 'Share Certificate Template',
    type: 'Template',
    format: 'PDF',
    size: '450 KB',
    downloads: 234,
    lastUpdated: '2024-02-15',
    category: 'Templates'
  },
  {
    id: 2,
    title: 'Beneficiary Designation Form',
    type: 'Form',
    format: 'PDF',
    size: '215 KB',
    downloads: 456,
    lastUpdated: '2024-01-20',
    category: 'Forms'
  },
  {
    id: 3,
    title: 'Share Transfer Form',
    type: 'Form',
    format: 'PDF',
    size: '180 KB',
    downloads: 123,
    lastUpdated: '2024-03-01',
    category: 'Forms'
  },
  {
    id: 6,
    title: 'Real Estate Partnership Agreement',
    type: 'Form',
    format: 'PDF',
    size: '200 KB',
    downloads: 0,
    lastUpdated: new Date().toISOString().split('T')[0],
    category: 'Forms'
  },
  {
    id: 7,
    title: 'Events Unit Business Plan',
    type: 'Template',
    format: 'PDF',
    size: '220 KB',
    downloads: 0,
    lastUpdated: new Date().toISOString().split('T')[0],
    category: 'Templates'
  },
  {
    id: 8,
    title: 'Real Estate Renovation Business Plan',
    type: 'Template',
    format: 'PDF',
    size: '220 KB',
    downloads: 0,
    lastUpdated: new Date().toISOString().split('T')[0],
    category: 'Templates'
  },
  {
    id: 4,
    title: '2024 Annual Report',
    type: 'Report',
    format: 'PDF',
    size: '2.8 MB',
    downloads: 789,
    lastUpdated: '2025-03-10',
    category: 'Reports'
  },
  {
    id: 5,
    title: 'Dividend Payment Register',
    type: 'Template',
    format: 'Excel',
    size: '350 KB',
    downloads: 89,
    lastUpdated: '2024-03-15',
    category: 'Templates'
  }
];

export function DownloadsTab({ searchQuery }) {
  const filteredDownloads = searchQuery
    ? downloads.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : downloads;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Downloadable Resources</CardTitle>
              <CardDescription>Forms, templates, and reports available for download</CardDescription>
            </div>
            <Badge variant="outline">{filteredDownloads.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Downloads</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDownloads.map((download) => (
                  <TableRow key={download.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="font-medium">{download.title}</p>
                          <p className="text-xs text-gray-600">{download.category}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{download.type}</Badge>
                    </TableCell>
                    <TableCell>{download.format}</TableCell>
                    <TableCell className="text-right text-sm text-gray-600">{download.size}</TableCell>
                    <TableCell className="text-right font-medium">{download.downloads}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(download.lastUpdated).toLocaleDateString('en-KE')}
                    </TableCell>
                    <TableCell>
                      <Button variant="default" size="sm" className="gap-1">
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
