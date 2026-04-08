# SACCO Tabs Components

This directory contains all the tab components for the SACCO Shareholders Module.

## Components Overview

### 1. OverviewTab.tsx
**Purpose**: Dashboard with key metrics and visualization  
**Features**:
- Shareholding growth trend chart
- Share distribution by category
- Dividend payment history
- KPI cards with metrics

**Props**: `stats` object with summary statistics

**State**: Uses mock data with `useState` for initialization

---

### 2. ShareholdersTab.tsx
**Purpose**: Shareholder directory with search and filtering  
**Features**:
- Comprehensive shareholder listing
- Status filtering (Active/Inactive/Pending)
- Category filtering (Staff/Supplier/Member/Director/Management)
- Search by name, email, or ID
- Export to CSV
- Action buttons (View, Edit, Certificate)
- Summary statistics

**Props**: `searchQuery` string from parent

**State**: Filters for status and category

---

### 3. SharesLedgerTab.tsx
**Purpose**: Share transaction history and ledger  
**Features**:
- Complete transaction history
- Transaction type filtering
- Date range filtering
- Transaction status tracking
- Print and export options
- Summary statistics

**Props**: `dateFilter` object and `searchQuery` string

**State**: Transaction type filter

---

### 4. DividendsTab.tsx
**Purpose**: Dividend management and tracking  
**Features**:
- Two sub-tabs: Declarations and Payments
- Dividend declaration history
- Payment status tracking
- Key metrics (total declared, latest dividend, YTD paid)
- Approve workflows
- Per-shareholder payment tracking

**State**: Active tab selection

---

### 5. ReserveFundTab.tsx
**Purpose**: Reserve fund monitoring and management  
**Features**:
- Current balance display
- Reserve growth trend chart
- Allocation breakdown with percentages
- Five allocation categories
- Monthly contribution tracking
- Historical data

**State**: Uses mock data for trends

---

### 6. PoliciesDocumentsTab.tsx
**Purpose**: Governance documents repository  
**Features**:
- Document listing with details
- Category filtering
- Version control
- View and download functionality
- 8 sample governance documents
- Document upload interface

**Props**: None

**State**: Category filter selection

---

### 7. DownloadsTab.tsx
**Purpose**: Downloadable resources and templates  
**Features**:
- Templates, forms, and reports listing
- Download statistics
- Format support (PDF, Excel)
- Resource categorization
- View and download buttons

**Props**: `searchQuery` string from parent

---

### 8. ReportsTab.tsx
**Purpose**: Reports and analytics generation  
**Features**:
- Shareholder growth trends
- 5 pre-built reports
- Custom report builder
- Multiple export formats
- Report generation interface

---

### 9. AuditLogsTab.tsx
**Purpose**: Activity audit trail and logging  
**Features**:
- Complete activity history
- Action type filtering
- Status filtering (Completed/Blocked/Pending)
- User and timestamp tracking
- IP address logging
- Security incident monitoring
- Summary statistics

**Props**: None

**State**: Action and status filters

---

## Common Patterns

### Data Filtering Pattern
```typescript
const filteredData = useMemo(() => {
  return data.filter(item => {
    // Apply multiple filter conditions
    return matchesFilter1 && matchesFilter2;
  });
}, [data, filter1, filter2]);
```

### Badge Styling Pattern
```typescript
const getStatusBadgeColor = (status) => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'inactive':
      return 'bg-gray-100 text-gray-800';
    // ... more cases
  }
};
```

### Table Structure Pattern
```typescript
<Table>
  <TableHeader className="bg-gray-50">
    <TableRow>
      {/* Headers */}
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map(item => (
      <TableRow className="hover:bg-gray-50">
        {/* Data cells */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## Import Dependencies

All tabs use these core dependencies:

```typescript
// UI Components
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Icons
import { Plus, Download, Eye, Edit, Delete } from 'lucide-react';

// React
import { useState, useMemo, useEffect } from 'react';

// Charts (where applicable)
import { 
  LineChart, Line, 
  BarChart, Bar,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
```

---

## Mock Data Location

Each tab includes mock data at the top of the file:

- **ShareholdersTab.tsx**: `mockShareholders` array
- **SharesLedgerTab.tsx**: `mockTransactions` array
- **DividendsTab.tsx**: `dividendDeclarations` and `dividendPayments`
- **PoliciesDocumentsTab.tsx**: `documents` array
- **DownloadsTab.tsx**: `downloads` array
- **ReportsTab.tsx**: `reportData` and `reports` array
- **AuditLogsTab.tsx**: `auditLogs` array

---

## Integration Checklist

For each tab, when integrating with backend:

- [ ] Replace mock data with API calls
- [ ] Setup React Query for data fetching
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Add empty states
- [ ] Setup real-time updates (if needed)
- [ ] Configure pagination (if needed)
- [ ] Add form validation
- [ ] Setup mutations for CRUD operations

---

## Performance Tips

1. **Memoization**: Wrap data filtering with `useMemo`
2. **Component Splitting**: Split large tabs into smaller components
3. **Lazy Loading**: Implement lazy loading for charts
4. **Pagination**: Add pagination for large datasets
5. **Caching**: Use React Query for automatic caching

---

## Testing Recommendations

Each tab should have:
- Unit tests for filters
- Integration tests for data display
- E2E tests for user workflows
- Visual regression tests

---

## Future Enhancements

- [ ] Real-time data updates via WebSocket
- [ ] Advanced filtering and custom views
- [ ] Bulk operations
- [ ] Print-friendly layouts
- [ ] Email report generation
- [ ] Custom export formats
- [ ] Data retention policies
- [ ] Advanced analytics

---

**Last Updated**: 2025-03-15  
**Version**: 1.0.0  
**Status**: Ready for Integration
