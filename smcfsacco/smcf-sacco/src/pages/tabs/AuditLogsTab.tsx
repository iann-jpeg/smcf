import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Clock, AlertCircle, CheckCircle2, Edit, Eye } from 'lucide-react';

const auditLogs = [
  {
    id: 'LOG-002547',
    timestamp: '2025-03-15 14:30:22',
    user: 'admin@smcf.co.ke',
    action: 'Share Purchase',
    entity: 'Shareholder SH-003',
    details: 'Approved 60 share purchase by Peter Mwangi',
    status: 'Completed',
    ipAddress: '197.232.45.120'
  },
  {
    id: 'LOG-002546',
    timestamp: '2025-03-15 13:15:45',
    user: 'finance@smcf.co.ke',
    action: 'Dividend Declaration',
    entity: 'Dividend DIV-2025-01',
    details: 'Declared dividend of KES 8,950,000 for fiscal year 2024',
    status: 'Completed',
    ipAddress: '197.232.45.121'
  },
  {
    id: 'LOG-002545',
    timestamp: '2025-03-15 12:00:30',
    user: 'compliance@smcf.co.ke',
    action: 'Policy Update',
    entity: 'Document: Share Issuance Policy',
    details: 'Updated share issuance policy version 1.5 to 1.6',
    status: 'Completed',
    ipAddress: '197.232.45.119'
  },
  {
    id: 'LOG-002544',
    timestamp: '2025-03-15 10:45:12',
    user: 'operations@smcf.co.ke',
    action: 'Certificate Issued',
    entity: 'Certificate CERT-2025-015',
    details: 'Issued share certificate to SAM Samuel Kiplagat',
    status: 'Completed',
    ipAddress: '197.232.45.118'
  },
  {
    id: 'LOG-002543',
    timestamp: '2025-03-14 16:22:08',
    user: 'admin@smcf.co.ke',
    action: 'Beneficiary Update',
    entity: 'Shareholder SH-001',
    details: 'Updated beneficiary information for John Kiprotich',
    status: 'Completed',
    ipAddress: '197.232.45.117'
  },
  {
    id: 'LOG-002542',
    timestamp: '2025-03-14 15:10:33',
    user: 'audit@smcf.co.ke',
    action: 'Access Denied',
    entity: 'Dividend Report',
    details: 'Unauthorized attempt to access confidential dividends report',
    status: 'Blocked',
    ipAddress: '192.168.1.105'
  },
  {
    id: 'LOG-002541',
    timestamp: '2025-03-14 14:05:19',
    user: 'finance@smcf.co.ke',
    action: 'Reserve Fund Allocation',
    entity: 'Reserve Fund',
    details: 'Allocated KES 85,000 to statutory reserve',
    status: 'Completed',
    ipAddress: '197.232.45.116'
  },
  {
    id: 'LOG-002540',
    timestamp: '2025-03-14 13:20:45',
    user: 'operations@smcf.co.ke',
    action: 'Member Exit',
    entity: 'Shareholder SH-005',
    details: 'Processed exit request for Grace Ochieng',
    status: 'Completed',
    ipAddress: '197.232.45.115'
  }
];

export function AuditLogsTab() {
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLogs = auditLogs.filter(log => {
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesAction && matchesStatus;
  });

  const getActionIcon = (action) => {
    switch (action) {
      case 'Access Denied':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Blocked':
        return 'bg-red-100 text-red-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <CardTitle>Audit Logs & Activity Trail</CardTitle>
        <CardDescription>Complete audit trail of all system activities and changes</CardDescription>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Action Type</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="Share Purchase">Share Purchase</SelectItem>
                  <SelectItem value="Dividend Declaration">Dividend Declaration</SelectItem>
                  <SelectItem value="Certificate Issued">Certificate Issued</SelectItem>
                  <SelectItem value="Member Exit">Member Exit</SelectItem>
                  <SelectItem value="Access Denied">Access Denied</SelectItem>
                  <SelectItem value="Policy Update">Policy Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {filteredLogs.length} of {auditLogs.length} log entries
            </p>
            <Badge variant="outline">{filteredLogs.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-sm font-semibold">{log.id}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {log.timestamp}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{log.user}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="font-medium text-gray-900">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{log.entity}</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-xs">{log.details}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(log.status)} variant="secondary">
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 font-mono">{log.ipAddress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Activities (Today)</p>
            <p className="text-3xl font-bold mt-1">{filteredLogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Successful Operations</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {filteredLogs.filter(l => l.status === 'Completed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Security Incidents</p>
            <p className="text-3xl font-bold text-red-600 mt-1">
              {filteredLogs.filter(l => l.status === 'Blocked').length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
