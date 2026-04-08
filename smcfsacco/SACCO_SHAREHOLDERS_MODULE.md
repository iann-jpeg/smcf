# SACCO Shareholders Module - Frontend Implementation

## Overview

The SACCO Shareholders Module is a comprehensive frontend system built with React and TypeScript for managing share ownership, dividends, reserve funds, and governance documents in the Smart Money Cash Flow (SMCF) SACCO system.

## Features

### 1. Overview Dashboard (`OverviewTab.tsx`)
- **Shareholding Growth Trend**: Track growth of total shareholders and active members over time
- **Share Distribution by Category**: Pie chart showing distribution across member categories
- **Dividend Payment Trend**: Annual dividends and per-share payments visualization
- **Key Metrics**: Growth rate, average shareholding, and dividend ratio

### 2. Shareholders Directory (`ShareholdersTab.tsx`)
- **Comprehensive Member Listing**: View all shareholders with detailed information
- **Advanced Filtering**: Filter by status, category, or search by name/ID/email
- **Export Capability**: Download shareholder data as CSV
- **Bulk Actions**: View details, edit information, and access share certificates
- **Statistics**: Total shares, value, and average holdings in view

**Filters:**
- Status: Active, Inactive, Pending
- Category: Staff, Supplier, Member, Director, Management

### 3. Share Transactions Ledger (`SharesLedgerTab.tsx`)
- **Transaction History**: Complete record of all share movements
- **Types of Transactions**:
  - Purchase: Initial or additional share acquisition
  - Sale: Share sale by shareholders
  - Transfer: Inter-shareholder transfers
  - Dividend: Dividend payments
  - Redemption: Share redemption on exit

**Features:**
- Date range filtering
- Type-based filtering
- Transaction details and status tracking
- Summary statistics (total transactions, quantity, value)

### 4. Dividend Management (`DividendsTab.tsx`)
- **Dividend Declarations**: View all declared dividends with historical data
- **Payment Status Tracking**: Monitor payment status for each shareholder
- **Declare New Dividend**: Create and approve new dividend distributions
- **Payment Timeline**: Track declaration, record, and payment dates

**Dashboard Shows:**
- Total declared amount (all-time)
- Latest dividend per share
- YTD paid out amount

### 5. Reserve Fund Management (`ReserveFundTab.tsx`)
- **Balance Tracking**: Monitor current reserve fund balance
- **Allocation Management**: Track fund allocations by category:
  - Statutory Reserve (40%)
  - Operational Reserve (20%)
  - Risk Reserve (20%)
  - Growth Fund (10%)
  - Emergency Fund (10%)

**Features:**
- Reserve fund growth trend visualization
- Monthly contribution tracking
- Quarterly balance history
- Allocation visualization with percentages

### 6. Policies & Documents (`PoliciesDocumentsTab.tsx`)
- **Document Repository**: Centralized storage for governance documents
- **Categories**: Governance, Shares, Dividends, Ethics, Risk, Audit, Compliance, Forms
- **Version Control**: Track document versions and update dates
- **Full-text Search**: Find documents quickly

**Documents Include:**
- SACCO Constitution
- Share Issuance Policy
- Dividend Declaration Policy
- Member Code of Conduct
- Risk Management Framework
- Internal Audit Charter
- Data Protection Policy
- Beneficiary Designation Form

### 7. Downloads (`DownloadsTab.tsx`)
- **Resource Library**: Access forms, templates, and reports
- **Download Tracking**: Monitor download statistics
- **Resource Types**: Templates, Forms, Reports
- **Multiple Formats**: PDF, Excel support

### 8. Reports & Analytics (`ReportsTab.tsx`)
- **Pre-built Reports**:
  - Monthly Shareholder Report
  - Dividend Performance Analysis
  - Share Transaction Summary
  - Reserve Fund Status Report
  - Annual Shareholder Report

**Features:**
- Trend visualization
- Growth and financial analysis charts
- Custom report builder
- Automatic and manual generation

### 9. Audit Logs (`AuditLogsTab.tsx`)
- **Activity Trail**: Complete audit log of all system activities
- **Security Monitoring**: Track access attempts, changes, and incidents
- **Filtering and Search**: By action type, status, date range
- **Compliance**: IP address tracking and timestamp logging

**Tracked Actions:**
- Share Purchases
- Dividend Declarations
- Certificate Issuance
- Documents Updates
- Member Exits
- Access Violations

## Project Structure

```
smcf-sacco/src/
├── pages/
│   ├── SACCOShareholders.tsx          # Main module entry point
│   └── tabs/
│       ├── OverviewTab.tsx
│       ├── ShareholdersTab.tsx
│       ├── SharesLedgerTab.tsx
│       ├── DividendsTab.tsx
│       ├── ReserveFundTab.tsx
│       ├── PoliciesDocumentsTab.tsx
│       ├── DownloadsTab.tsx
│       ├── ReportsTab.tsx
│       └── AuditLogsTab.tsx
├── components/
│   └── SACCONavigation.tsx           # Navigation components
├── routes/
│   └── saccoRoutes.tsx               # Route configuration
└── lib/
    └── (API client configuration)
```

## Components Used

### UI Components (shadcn/ui)
- `Card` - Container component for sections
- `Button` - Interactive buttons
- `Input` - Form inputs
- `Table` - Data display
- `Badge` - Status indicators
- `Tabs` - Tab navigation
- `Select` - Dropdown selections

### Icons (lucide-react)
- User management icons
- Transaction indicators
- Status icons
- Action buttons

### Charts (recharts)
- LineChart - Trend visualization
- BarChart - Comparative analysis
- PieChart - Distribution display

## Data Structure

### Shareholder Object
```typescript
{
  id: string;                  // Unique identifier (e.g., SH-001)
  name: string;
  email: string;
  phone: string;
  category: 'Staff' | 'Supplier' | 'Member' | 'Director' | 'Management';
  sharesOwned: number;
  shareValue: number;         // KES value
  joinDate: string;           // YYYY-MM-DD
  status: 'Active' | 'Inactive' | 'Pending';
  certificateNo: string;
  beneficiary: string;
}
```

### Share Transaction Object
```typescript
{
  id: string;                 // Transaction ID (e.g., TXN-0001)
  date: string;              // Transaction date
  shareholderId: string;
  shareholderName: string;
  transactionType: 'Purchase' | 'Sale' | 'Transfer' | 'Dividend' | 'Redemption';
  quantity: number;          // Number of shares
  pricePerShare: number;     // KES per share
  amount: number;            // Total transaction value
  description: string;
  status: 'Completed' | 'Pending';
}
```

### Dividend Object
```typescript
{
  id: string;                 // Division ID (e.g., DIV-2025-01)
  year: number;
  period: string;
  declaredDate: string;
  recordDate: string;
  paymentDate: string;
  totalAmount: number;       // Total dividend pool (KES)
  sharesOutstanding: number;
  dividendPerShare: number;  // KES per share
  status: 'Proposed' | 'Approved' | 'Paid';
  approvedBy: string;
}
```

## Integration Steps

### 1. Add to Main Router
```typescript
// In src/App.tsx or main router configuration
import SACCOShareholdersModule from './pages/SACCOShareholders';

const router = createBrowserRouter([
  // ... other routes
  {
    path: '/sacco',
    element: <SACCOShareholdersModule />
  }
]);
```

### 2. Import Navigation Component
```typescript
// In your main layout
import { SACCONavbar, SACCOSidebar } from './components/SACCONavigation';

export function Layout() {
  return (
    <>
      <SACCONavbar />
      <div className="flex">
        <SACCOSidebar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </>
  );
}
```

### 3. API Integration (Next Steps)
```typescript
// Create API hooks in src/hooks/
import { useQuery, useMutation } from '@tanstack/react-query';

export function useShareholders() {
  return useQuery({
    queryKey: ['shareholders'],
    queryFn: async () => {
      const response = await fetch('/api/shareholders');
      return response.json();
    }
  });
}
```

## Backend Integration Points

The module expects the following API endpoints (to be implemented):

### Shareholders
- `GET /api/shareholders` - List all shareholders
- `GET /api/shareholders/:id` - Get shareholder details
- `POST /api/shareholders` - Create new shareholder
- `PUT /api/shareholders/:id` - Update shareholder
- `DELETE /api/shareholders/:id` - Delete shareholder

### Shares
- `GET /api/shares/transactions` - Get share transactions
- `POST /api/shares/transactions` - Create transaction
- `GET /api/shares/summary` - Summary statistics

### Dividends
- `GET /api/dividends/declarations` - Get dividend declarations
- `POST /api/dividends/declare` - Declare new dividend
- `GET /api/dividends/payments` - Get payment status

### Documents
- `GET /api/documents` - List documents
- `POST /api/documents` - Upload document
- `DELETE /api/documents/:id` - Delete document

### Audit
- `GET /api/audit/logs` - Get audit logs
- `GET /api/audit/stats` - Get audit statistics

## Styling Guidelines

### Color Scheme
- **Primary**: Yellow (#C9A227) - SMCF brand
- **Secondary**: Green (#2D7A36) - Growth/Success
- **Accent**: Blue, Red, Purple - Category differentiation
- **Neutral**: Gray shades - Background and text

### Layout
- Max-width: 1280px (7xl)
- Responsive grid: 1/2/4 columns based on screen size
- Consistent spacing: 4px baseline unit
- Rounded corners: 8px standard radius

## Features to Implement Next

1. **Real-time Sync**: WebSocket integration for live updates
2. **Export Formats**: PDF reports, Excel workbooks
3. **Notifications**: In-app alerts for important events
4. **User Roles**: Role-based access control
5. **Data Validation**: Form validation and error handling
6. **Batch Operations**: Bulk import/export
7. **Notes & Comments**: Shareholder communication
8. **Historical Data**: Archive and historical view

## Performance Considerations

- Implement pagination for large datasets
- Use React.memo for non-changing components
- Lazy load charts and heavy components
- Debounce search and filter operations
- Cache API responses with React Query

## Security Notes

- Validate all user inputs
- Sanitize data before display
- Implement proper authentication/authorization
- Log sensitive operations
- Use HTTPS for all API calls
- Encrypt sensitive data in transit

## Browser Support

- Chrome/Edge (Latest 2 versions)
- Firefox (Latest 2 versions)
- Safari (Latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## Dependencies

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.x",
  "@tanstack/react-query": "^4.x",
  "recharts": "^2.x",
  "lucide-react": "^0.x",
  "@radix-ui/primitive": "^1.x"
}
```

## Maintenance

- Regular security audits
- Performance monitoring
- User feedback integration
- Documentation updates
- Dependency updates

## Support & Documentation

For questions or issues, contact the development team.
For API documentation, see `/docs/api.md`
For database schema, see `/docs/schema.md`
