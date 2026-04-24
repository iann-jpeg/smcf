import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet } from 'lucide-react';
import { getActiveSaccoApiBase } from '@/lib/saccoApiBase';

type DashboardData = {
  totalShareCapital: number;
  totalNumberOfShares: number;
  totalMembersWithShares: number;
  membersAtMinimum: number;
  membersBelowMinimum: number;
  totalDividendsAllocatedForSelectedPeriod: number;
  lastDividendDistributionDate: string | null;
  shareValuePerShare: number;
  minimumRequiredShareCapital: number;
};

type MemberShareRow = {
  memberObjectId: string;
  memberName: string;
  memberId: string;
  status: string;
  numberOfShares: number;
  shareValuePerShare: number;
  totalShareCapitalValue: number;
  minimumRequiredShareCapital: number;
  shareContributionProgress: number;
  remainingAmountToReachMinimum: number;
  contributionStats: {
    totalApprovedContributions: number;
    totalContributedAmount: number;
    lastContributionDate: string | null;
  };
  dividendStats: {
    totalDividendEarned: number;
    lastDividendDate: string | null;
  };
};

type ShareContribution = {
  _id: string;
  memberId: { _id: string; name: string; memberId: string } | string;
  amount: number;
  numberOfShares: number;
  paymentMethod: string;
  referenceNumber: string | null;
  contributionDate: string;
  status: 'pending' | 'approved' | 'reversed' | 'rejected';
  notes: string | null;
  reversalReason?: string | null;
};

type DividendPreview = {
  distributionPeriod: string;
  calculationMode: 'percentage_based' | 'pool_based';
  eligibilityRule: string;
  totalProfitAvailable: number;
  dividendRate: number | null;
  totalDividendPool: number;
  totalMembersEligible: number;
  totalShares: number;
  totalDividendsToBeDistributed: number;
  rows: Array<{
    memberObjectId: string;
    memberId: string;
    memberName: string;
    numberOfShares: number;
    shareCapitalValue: number;
    dividendEarned: number;
    newTotalAfterDividendRecord: number;
  }>;
};

type DistributionHistory = {
  _id: string;
  distributionPeriod: string;
  calculationMode: string;
  eligibilityRule: string;
  totalMembersEligible: number;
  totalSharesAtDistribution: number;
  totalDividendPool: number;
  totalDividendsDistributed: number;
  approvedAt: string;
  status: string;
};

type ReportsData = {
  totalShareCapitalReport: {
    totalShareCapital: number;
    totalNumberOfShares: number;
    totalMembersWithShares: number;
  };
  membersBelowMinimumShareCapital: Array<{
    memberObjectId: string;
    memberId: string;
    memberName: string;
    shareCapital: number;
    remaining: number;
  }>;
  topShareholders: Array<{
    memberObjectId: string;
    memberId: string;
    memberName: string;
    shareCapital: number;
    numberOfShares: number;
  }>;
  shareGrowthOverTime: Array<{ month: string; contributedShareCapital: number }>;
  shareContributionsByMember?: Array<{
    _id: string;
    amount: number;
    status: string;
    contributionDate: string;
    memberId?: { memberId?: string; name?: string };
  }>;
  dividendDistributionReport?: Array<{
    _id: string;
    distributionPeriod: string;
    totalDividendsDistributed: number;
    totalMembersEligible: number;
    approvedAt: string;
  }>;
};

type AuditLogRow = {
  _id: string;
  action: string;
  createdAt: string;
  changes: Record<string, unknown>;
  userId?: { email?: string; fullName?: string };
};

type MemberProfileData = {
  memberName: string;
  memberId: string;
  numberOfSharesOwned: number;
  totalShareCapitalValue: number;
  shareContributionProgress: number;
  remainingAmountToReachMinimum: number;
  dividendEarnedCurrentPeriod: number;
  shareContributionHistory: ShareContribution[];
  dividendHistory: Array<{
    _id: string;
    distributionPeriod: string;
    dividendAmount: number;
    approvedAt: string;
  }>;
};

const defaultDashboard: DashboardData = {
  totalShareCapital: 0,
  totalNumberOfShares: 0,
  totalMembersWithShares: 0,
  membersAtMinimum: 0,
  membersBelowMinimum: 0,
  totalDividendsAllocatedForSelectedPeriod: 0,
  lastDividendDistributionDate: null,
  shareValuePerShare: 100,
  minimumRequiredShareCapital: 10000,
};

const defaultDividendForm = {
  distributionPeriod: '',
  totalProfitAvailable: '',
  dividendRate: '',
  totalDividendPool: '',
  calculationMode: 'percentage_based',
  eligibilityRule: 'all_with_shares',
  notes: '',
};

interface ShareCapitalDividendsTabProps {
  isReadOnly?: boolean;
}

const API_BASE = getActiveSaccoApiBase();

export default function ShareCapitalDividendsTab({ isReadOnly = false }: ShareCapitalDividendsTabProps) {
  const { toast } = useToast();

  const [dashboard, setDashboard] = useState<DashboardData>(defaultDashboard);
  const [members, setMembers] = useState<MemberShareRow[]>([]);
  const [contributions, setContributions] = useState<ShareContribution[]>([]);
  const [history, setHistory] = useState<DistributionHistory[]>([]);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [memberProfile, setMemberProfile] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  const [contributionForm, setContributionForm] = useState({
    memberObjectId: '',
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    status: 'pending',
    notes: '',
  });

  const [contributionFilter, setContributionFilter] = useState({
    memberObjectId: 'all',
    status: 'all',
    from: '',
    to: '',
  });

  const [dividendForm, setDividendForm] = useState(defaultDividendForm);
  const [preview, setPreview] = useState<DividendPreview | null>(null);

  const headers = useMemo(
    () => {
      const token = localStorage.getItem('smcf_auth_token');
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    },
    []
  );

  const loadDashboard = async () => {
    const params = selectedPeriod ? `?period=${encodeURIComponent(selectedPeriod)}` : '';
    const response = await fetch(`${API_BASE}/api/share-capital-dividends/dashboard${params}`, {
      headers,
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load dashboard');
    setDashboard(data.data || defaultDashboard);
  };

  const loadMembers = async () => {
    const response = await fetch(`${API_BASE}/api/share-capital-dividends/members`, { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load members');
    setMembers(Array.isArray(data.data) ? data.data : []);
  };

  const loadContributions = async () => {
    const params = new URLSearchParams();
    if (contributionFilter.memberObjectId && contributionFilter.memberObjectId !== 'all') {
      params.append('memberObjectId', contributionFilter.memberObjectId);
    }
    if (contributionFilter.status && contributionFilter.status !== 'all') {
      params.append('status', contributionFilter.status);
    }
    if (contributionFilter.from) params.append('from', contributionFilter.from);
    if (contributionFilter.to) params.append('to', contributionFilter.to);

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE}/api/share-capital-dividends/contributions${query}`, {
      headers,
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load contributions');
    setContributions(Array.isArray(data.data) ? data.data : []);
  };

  const loadHistory = async () => {
    const response = await fetch(`${API_BASE}/api/share-capital-dividends/dividends/history`, { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load dividend history');
    setHistory(Array.isArray(data.data) ? data.data : []);
  };

  const loadReports = async () => {
    const response = await fetch(`${API_BASE}/api/share-capital-dividends/reports`, { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load reports');
    setReports(data.data || null);
  };

  const loadAuditLogs = async () => {
    const response = await fetch(`${API_BASE}/api/share-capital-dividends/audit-logs`, { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load audit logs');
    setAuditLogs(Array.isArray(data.data) ? data.data : []);
  };

  const loadMemberProfile = async (memberObjectId: string) => {
    if (!memberObjectId) {
      setMemberProfile(null);
      return;
    }
    const params = selectedPeriod ? `?period=${encodeURIComponent(selectedPeriod)}` : '';
    const response = await fetch(
      `${API_BASE}/api/share-capital-dividends/members/${memberObjectId}/profile${params}`,
      { headers }
    );
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load member profile');
    setMemberProfile(data.data || null);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadDashboard(), loadMembers(), loadContributions(), loadHistory(), loadReports(), loadAuditLogs()]);
    } catch (error: any) {
      toast({
        title: 'Data Load Failed',
        description: error.message || 'Unable to load Share Capital & Dividends data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDashboard().catch(() => undefined);
    if (selectedMemberId) {
      loadMemberProfile(selectedMemberId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const submitContribution = async () => {
    if (isReadOnly) return;
    try {
      const payload = {
        ...contributionForm,
        amount: Number(contributionForm.amount || 0),
      };

      const response = await fetch(`${API_BASE}/api/share-capital-dividends/contributions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to save contribution');

      toast({
        title: 'Contribution Saved',
        description: 'Share contribution was saved successfully.',
      });

      setContributionForm({
        memberObjectId: '',
        amount: '',
        paymentMethod: 'cash',
        referenceNumber: '',
        status: 'pending',
        notes: '',
      });

      await Promise.all([loadDashboard(), loadMembers(), loadContributions(), loadReports(), loadAuditLogs()]);
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Could not save share contribution.',
        variant: 'destructive',
      });
    }
  };

  const approveContribution = async (id: string) => {
    if (isReadOnly) return;
    try {
      const response = await fetch(`${API_BASE}/api/share-capital-dividends/contributions/${id}/approve`, {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to approve contribution');

      toast({ title: 'Contribution Approved', description: 'The contribution was approved and posted.' });
      await Promise.all([loadDashboard(), loadMembers(), loadContributions(), loadReports(), loadAuditLogs()]);
    } catch (error: any) {
      toast({ title: 'Approval Failed', description: error.message, variant: 'destructive' });
    }
  };

  const reverseContribution = async (id: string) => {
    if (isReadOnly) return;
    const reason = window.prompt('Enter reversal reason (required):');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE}/api/share-capital-dividends/contributions/${id}/reverse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to reverse contribution');

      toast({ title: 'Contribution Reversed', description: 'Contribution was reversed successfully.' });
      await Promise.all([loadDashboard(), loadMembers(), loadContributions(), loadReports(), loadAuditLogs()]);
    } catch (error: any) {
      toast({ title: 'Reversal Failed', description: error.message, variant: 'destructive' });
    }
  };

  const saveDividendSetup = async () => {
    if (isReadOnly) return;
    try {
      const payload = {
        distributionPeriod: dividendForm.distributionPeriod,
        totalProfitAvailable: Number(dividendForm.totalProfitAvailable || 0),
        dividendRate: dividendForm.dividendRate === '' ? null : Number(dividendForm.dividendRate),
        totalDividendPool: dividendForm.totalDividendPool === '' ? null : Number(dividendForm.totalDividendPool),
        calculationMode: dividendForm.calculationMode,
        eligibilityRule: dividendForm.eligibilityRule,
        notes: dividendForm.notes,
      };

      const response = await fetch(`${API_BASE}/api/share-capital-dividends/dividends/configure`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to save dividend setup');

      toast({ title: 'Dividend Setup Saved', description: 'Configuration draft saved successfully.' });
      await loadAuditLogs();
    } catch (error: any) {
      toast({ title: 'Setup Failed', description: error.message, variant: 'destructive' });
    }
  };

  const previewDividend = async () => {
    try {
      const payload = {
        distributionPeriod: dividendForm.distributionPeriod,
        totalProfitAvailable: Number(dividendForm.totalProfitAvailable || 0),
        dividendRate: dividendForm.dividendRate === '' ? null : Number(dividendForm.dividendRate),
        totalDividendPool: dividendForm.totalDividendPool === '' ? null : Number(dividendForm.totalDividendPool),
        calculationMode: dividendForm.calculationMode,
        eligibilityRule: dividendForm.eligibilityRule,
      };

      const response = await fetch(`${API_BASE}/api/share-capital-dividends/dividends/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to preview dividends');

      setPreview(data.data || null);
      toast({ title: 'Preview Ready', description: 'Dividend preview generated successfully.' });
    } catch (error: any) {
      toast({ title: 'Preview Failed', description: error.message, variant: 'destructive' });
    }
  };

  const approveDistribution = async () => {
    if (isReadOnly) return;
    if (!preview) {
      toast({ title: 'No Preview', description: 'Generate preview before approving distribution.', variant: 'destructive' });
      return;
    }

    if (!window.confirm('Approve and execute this dividend distribution? This cannot be duplicated for the same period.')) {
      return;
    }

    try {
      const payload = {
        distributionPeriod: dividendForm.distributionPeriod,
        totalProfitAvailable: Number(dividendForm.totalProfitAvailable || 0),
        dividendRate: dividendForm.dividendRate === '' ? null : Number(dividendForm.dividendRate),
        totalDividendPool: dividendForm.totalDividendPool === '' ? null : Number(dividendForm.totalDividendPool),
        calculationMode: dividendForm.calculationMode,
        eligibilityRule: dividendForm.eligibilityRule,
        notes: dividendForm.notes,
      };

      const response = await fetch(`${API_BASE}/api/share-capital-dividends/dividends/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to approve distribution');

      toast({ title: 'Distribution Completed', description: 'Dividend distribution approved and executed successfully.' });
      setPreview(null);
      await Promise.all([loadDashboard(), loadHistory(), loadReports(), loadAuditLogs(), loadMembers()]);
    } catch (error: any) {
      toast({ title: 'Approval Failed', description: error.message, variant: 'destructive' });
    }
  };

  const csvEscape = (value: string | number | null | undefined) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportReportsCsv = () => {
    if (!reports) {
      toast({ title: 'No Data', description: 'Reports data is not loaded yet.', variant: 'destructive' });
      return;
    }

    const lines: string[] = [];
    const today = new Date().toLocaleString();
    lines.push(csvEscape('SMCF SACCO - Share Capital & Dividends Report'));
    lines.push(csvEscape(`Generated At: ${today}`));
    lines.push('');

    lines.push('Summary');
    lines.push(['Metric', 'Value'].map(csvEscape).join(','));
    lines.push(['Total Share Capital', `KES ${Number(reports.totalShareCapitalReport.totalShareCapital || 0).toLocaleString()}`].map(csvEscape).join(','));
    lines.push(['Total Number of Shares', Number(reports.totalShareCapitalReport.totalNumberOfShares || 0)].map(csvEscape).join(','));
    lines.push(['Members With Shares', reports.totalShareCapitalReport.totalMembersWithShares || 0].map(csvEscape).join(','));
    lines.push('');

    lines.push('Top Shareholders');
    lines.push(['Member Name', 'Member ID', 'Shares', 'Share Capital (KES)'].map(csvEscape).join(','));
    (reports.topShareholders || []).forEach((item) => {
      lines.push([
        item.memberName,
        item.memberId,
        Number(item.numberOfShares).toFixed(2),
        Number(item.shareCapital).toFixed(2),
      ].map(csvEscape).join(','));
    });
    lines.push('');

    lines.push('Members Below Minimum Share Capital');
    lines.push(['Member Name', 'Member ID', 'Current Share Capital (KES)', 'Remaining to Minimum (KES)'].map(csvEscape).join(','));
    (reports.membersBelowMinimumShareCapital || []).forEach((item) => {
      lines.push([
        item.memberName,
        item.memberId,
        Number(item.shareCapital).toFixed(2),
        Number(item.remaining).toFixed(2),
      ].map(csvEscape).join(','));
    });
    lines.push('');

    lines.push('Share Growth Over Time');
    lines.push(['Month', 'Contributed Share Capital (KES)'].map(csvEscape).join(','));
    (reports.shareGrowthOverTime || []).forEach((item) => {
      lines.push([item.month, Number(item.contributedShareCapital).toFixed(2)].map(csvEscape).join(','));
    });
    lines.push('');

    lines.push('Dividend Distribution History');
    lines.push(['Period', 'Eligible Members', 'Dividends Distributed (KES)', 'Approved At'].map(csvEscape).join(','));
    (history || []).forEach((item) => {
      lines.push([
        item.distributionPeriod,
        item.totalMembersEligible,
        Number(item.totalDividendsDistributed).toFixed(2),
        new Date(item.approvedAt).toLocaleString(),
      ].map(csvEscape).join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `share-capital-dividends-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({ title: 'CSV Exported', description: 'Report downloaded as CSV.' });
  };

  const exportReportsPdf = () => {
    if (!reports) {
      toast({ title: 'No Data', description: 'Reports data is not loaded yet.', variant: 'destructive' });
      return;
    }

    const generatedAt = new Date().toLocaleString();
    const topRows = (reports.topShareholders || [])
      .map(
        (item) => `
          <tr>
            <td>${item.memberName}</td>
            <td>${item.memberId}</td>
            <td style="text-align:right;">${Number(item.numberOfShares).toLocaleString()}</td>
            <td style="text-align:right;">KES ${Number(item.shareCapital).toLocaleString()}</td>
          </tr>`
      )
      .join('');

    const belowRows = (reports.membersBelowMinimumShareCapital || [])
      .map(
        (item) => `
          <tr>
            <td>${item.memberName}</td>
            <td>${item.memberId}</td>
            <td style="text-align:right;">KES ${Number(item.shareCapital).toLocaleString()}</td>
            <td style="text-align:right;">KES ${Number(item.remaining).toLocaleString()}</td>
          </tr>`
      )
      .join('');

    const growthRows = (reports.shareGrowthOverTime || [])
      .map(
        (item) => `
          <tr>
            <td>${item.month}</td>
            <td style="text-align:right;">KES ${Number(item.contributedShareCapital).toLocaleString()}</td>
          </tr>`
      )
      .join('');

    const dividendRows = (history || [])
      .map(
        (item) => `
          <tr>
            <td>${item.distributionPeriod}</td>
            <td style="text-align:right;">${item.totalMembersEligible}</td>
            <td style="text-align:right;">KES ${Number(item.totalDividendsDistributed).toLocaleString()}</td>
            <td>${new Date(item.approvedAt).toLocaleString()}</td>
          </tr>`
      )
      .join('');

    const html = `
      <html>
        <head>
          <title>Share Capital & Dividends Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin-bottom: 4px; }
            h2 { margin-top: 28px; margin-bottom: 10px; font-size: 18px; }
            .meta { color: #6b7280; margin-bottom: 16px; }
            .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
            .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
            .label { font-size: 12px; color: #6b7280; }
            .value { font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h1>SMCF SACCO</h1>
          <div class="meta">Share Capital & Dividends Report · Generated ${generatedAt}</div>

          <div class="summary">
            <div class="box"><div class="label">Total Share Capital</div><div class="value">KES ${Number(reports.totalShareCapitalReport.totalShareCapital || 0).toLocaleString()}</div></div>
            <div class="box"><div class="label">Total Number of Shares</div><div class="value">${Number(reports.totalShareCapitalReport.totalNumberOfShares || 0).toLocaleString()}</div></div>
            <div class="box"><div class="label">Members With Shares</div><div class="value">${reports.totalShareCapitalReport.totalMembersWithShares || 0}</div></div>
          </div>

          <h2>Top Shareholders</h2>
          <table>
            <thead><tr><th>Member</th><th>Member ID</th><th>Shares</th><th>Share Capital</th></tr></thead>
            <tbody>${topRows || '<tr><td colspan="4">No records</td></tr>'}</tbody>
          </table>

          <h2>Members Below Minimum Share Capital</h2>
          <table>
            <thead><tr><th>Member</th><th>Member ID</th><th>Current Share Capital</th><th>Remaining</th></tr></thead>
            <tbody>${belowRows || '<tr><td colspan="4">No records</td></tr>'}</tbody>
          </table>

          <h2>Share Growth Over Time</h2>
          <table>
            <thead><tr><th>Month</th><th>Contributed Share Capital</th></tr></thead>
            <tbody>${growthRows || '<tr><td colspan="2">No records</td></tr>'}</tbody>
          </table>

          <h2>Dividend Distribution History</h2>
          <table>
            <thead><tr><th>Period</th><th>Eligible Members</th><th>Dividends Distributed</th><th>Approved At</th></tr></thead>
            <tbody>${dividendRows || '<tr><td colspan="4">No records</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Popup Blocked', description: 'Please allow popups to export PDF.', variant: 'destructive' });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);

    toast({ title: 'PDF Ready', description: 'Print dialog opened. Choose Save as PDF to download.' });
  };

  const topShareholders = reports?.topShareholders || [];
  const belowMinimum = reports?.membersBelowMinimumShareCapital || [];
  const growthData = reports?.shareGrowthOverTime || [];

  const contributionRows = contributions.map((item) => {
    const member = typeof item.memberId === 'string' ? null : item.memberId;
    return {
      ...item,
      memberName: member?.name || 'Unknown',
      memberCode: member?.memberId || 'N/A',
    };
  });

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-slate-50 to-green-50 border-green-200">
        <CardHeader>
          <CardTitle>Share Capital & Dividends</CardTitle>
          <CardDescription>
            Manage share capital, contributions, dividend setup, preview, approval, distribution history, reporting, and audit trails.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <div className="rounded-lg border p-3 bg-white">
            <p className="text-xs text-muted-foreground">Total Share Capital</p>
            <p className="font-semibold">KES {Number(dashboard.totalShareCapital || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3 bg-white">
            <p className="text-xs text-muted-foreground">Total Shares</p>
            <p className="font-semibold">{Number(dashboard.totalNumberOfShares || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3 bg-white">
            <p className="text-xs text-muted-foreground">Members With Shares</p>
            <p className="font-semibold">{dashboard.totalMembersWithShares}</p>
          </div>
          <div className="rounded-lg border p-3 bg-white">
            <p className="text-xs text-muted-foreground">At Minimum</p>
            <p className="font-semibold text-green-700">{dashboard.membersAtMinimum}</p>
          </div>
          <div className="rounded-lg border p-3 bg-white">
            <p className="text-xs text-muted-foreground">Below Minimum</p>
            <p className="font-semibold text-amber-700">{dashboard.membersBelowMinimum}</p>
          </div>
          <div className="rounded-lg border p-3 bg-white">
            <p className="text-xs text-muted-foreground">Dividends (Selected Period)</p>
            <p className="font-semibold">KES {Number(dashboard.totalDividendsAllocatedForSelectedPeriod || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3 bg-white col-span-2">
            <p className="text-xs text-muted-foreground">Last Dividend Distribution</p>
            <p className="font-semibold">
              {dashboard.lastDividendDistributionDate
                ? new Date(dashboard.lastDividendDistributionDate).toLocaleString()
                : 'Not yet distributed'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Selected Period</Label>
          <Input
            placeholder="e.g. 2026"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <Button variant="outline" onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="member-shares">Member Shares</TabsTrigger>
          <TabsTrigger value="share-contributions">Share Contributions</TabsTrigger>
          <TabsTrigger value="dividend-setup">Dividend Setup</TabsTrigger>
          <TabsTrigger value="dividend-preview">Dividend Preview</TabsTrigger>
          <TabsTrigger value="dividend-history">Dividend History</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Shareholders</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topShareholders.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="memberId" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`KES ${Number(value).toLocaleString()}`, 'Share Capital']} />
                    <Bar dataKey="shareCapital" fill="#166534" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Share Growth Over Time</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`KES ${Number(value).toLocaleString()}`, 'Contributions']} />
                    <Line type="monotone" dataKey="contributedShareCapital" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members Below Minimum Share Capital</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Member ID</TableHead>
                    <TableHead className="text-right">Current Share Capital</TableHead>
                    <TableHead className="text-right">Remaining to Minimum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {belowMinimum.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No members below minimum.</TableCell>
                    </TableRow>
                  ) : (
                    belowMinimum.slice(0, 20).map((m) => (
                      <TableRow key={m.memberObjectId}>
                        <TableCell>{m.memberName}</TableCell>
                        <TableCell>{m.memberId}</TableCell>
                        <TableCell className="text-right">KES {Number(m.shareCapital).toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {Number(m.remaining).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="member-shares" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Member Share Profiles</CardTitle>
              <CardDescription>Member shares, progress, and dividend stats.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Member ID</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Share Capital</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Current Period Dividend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((row) => (
                      <TableRow
                        key={row.memberObjectId}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedMemberId(row.memberObjectId);
                          loadMemberProfile(row.memberObjectId).catch(() => undefined);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{row.memberName}</span>
                            <Badge variant={row.status === 'active' ? 'default' : 'outline'}>{row.status}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{row.memberId}</TableCell>
                        <TableCell className="text-right">{Number(row.numberOfShares).toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {Number(row.totalShareCapitalValue).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <span>{Number(row.shareContributionProgress).toFixed(1)}%</span>
                            <Progress value={Math.min(100, row.shareContributionProgress)} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">KES {Number(row.remainingAmountToReachMinimum).toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {Number(row.dividendStats.totalDividendEarned).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {memberProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {memberProfile.memberName} ({memberProfile.memberId})
                </CardTitle>
                <CardDescription>Detailed share contribution and dividend history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Number of Shares</p>
                    <p className="font-semibold">{Number(memberProfile.numberOfSharesOwned).toLocaleString()}</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Total Share Capital</p>
                    <p className="font-semibold">KES {Number(memberProfile.totalShareCapitalValue).toLocaleString()}</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Progress to Minimum</p>
                    <p className="font-semibold">{Number(memberProfile.shareContributionProgress).toFixed(1)}%</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Current Period Dividend</p>
                    <p className="font-semibold">KES {Number(memberProfile.dividendEarnedCurrentPeriod).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Share Contribution History</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[260px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {memberProfile.shareContributionHistory.map((item) => (
                            <TableRow key={item._id}>
                              <TableCell>{new Date(item.contributionDate).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right">KES {Number(item.amount).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'approved' ? 'default' : 'outline'}>{item.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Dividend History</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[260px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {memberProfile.dividendHistory.map((item) => (
                            <TableRow key={item._id}>
                              <TableCell>{item.distributionPeriod}</TableCell>
                              <TableCell className="text-right">KES {Number(item.dividendAmount).toLocaleString()}</TableCell>
                              <TableCell>{new Date(item.approvedAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="share-contributions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Share Contribution</CardTitle>
              <CardDescription>Manual entry and approval workflow for share contributions.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Member</Label>
                <Select
                  value={contributionForm.memberObjectId}
                  onValueChange={(value) => setContributionForm((prev) => ({ ...prev, memberObjectId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.memberObjectId} value={m.memberObjectId}>
                        {m.memberName} ({m.memberId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  value={contributionForm.amount}
                  onChange={(e) => setContributionForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Input
                  value={contributionForm.paymentMethod}
                  onChange={(e) => setContributionForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Reference Number</Label>
                <Input
                  value={contributionForm.referenceNumber}
                  onChange={(e) => setContributionForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={contributionForm.status}
                  onValueChange={(value) => setContributionForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="approved">approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={contributionForm.notes}
                  onChange={(e) => setContributionForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="md:col-span-3">
                <Button onClick={submitContribution} disabled={isReadOnly}>Save Contribution</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contribution Records</CardTitle>
              <CardDescription>Filter by member, date range, and payment status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <Select
                  value={contributionFilter.memberObjectId}
                  onValueChange={(value) => setContributionFilter((prev) => ({ ...prev, memberObjectId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All members</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.memberObjectId} value={m.memberObjectId}>
                        {m.memberName} ({m.memberId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={contributionFilter.status}
                  onValueChange={(value) => setContributionFilter((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="approved">approved</SelectItem>
                    <SelectItem value="reversed">reversed</SelectItem>
                  </SelectContent>
                </Select>

                <Input type="date" value={contributionFilter.from} onChange={(e) => setContributionFilter((prev) => ({ ...prev, from: e.target.value }))} />
                <Input type="date" value={contributionFilter.to} onChange={(e) => setContributionFilter((prev) => ({ ...prev, to: e.target.value }))} />
                <Button variant="outline" onClick={loadContributions}>Apply Filters</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributionRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">No contributions found.</TableCell>
                    </TableRow>
                  ) : (
                    contributionRows.map((row) => (
                      <TableRow key={row._id}>
                        <TableCell>{row.memberName} ({row.memberCode})</TableCell>
                        <TableCell>{new Date(row.contributionDate).toLocaleString()}</TableCell>
                        <TableCell>{row.paymentMethod}</TableCell>
                        <TableCell>{row.referenceNumber || 'N/A'}</TableCell>
                        <TableCell className="text-right">KES {Number(row.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Number(row.numberOfShares).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === 'approved' ? 'default' : row.status === 'reversed' ? 'destructive' : 'outline'}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {row.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => approveContribution(row._id)} disabled={isReadOnly}>
                              Approve
                            </Button>
                          )}
                          {row.status !== 'reversed' && (
                            <Button size="sm" variant="destructive" onClick={() => reverseContribution(row._id)} disabled={isReadOnly}>
                              Reverse
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dividend-setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dividend Configuration</CardTitle>
              <CardDescription>Set period, profit allocation, mode, rate/pool, and eligibility.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Distribution Period</Label>
                <Input
                  value={dividendForm.distributionPeriod}
                  onChange={(e) => setDividendForm((prev) => ({ ...prev, distributionPeriod: e.target.value }))}
                  placeholder="e.g. 2026"
                />
              </div>
              <div className="space-y-1">
                <Label>Total Profit Available (KES)</Label>
                <Input
                  type="number"
                  value={dividendForm.totalProfitAvailable}
                  onChange={(e) => setDividendForm((prev) => ({ ...prev, totalProfitAvailable: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Calculation Mode</Label>
                <Select
                  value={dividendForm.calculationMode}
                  onValueChange={(value) => setDividendForm((prev) => ({ ...prev, calculationMode: value as 'percentage_based' | 'pool_based' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage_based">Percentage Based</SelectItem>
                    <SelectItem value="pool_based">Pool Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Dividend Rate (%)</Label>
                <Input
                  type="number"
                  value={dividendForm.dividendRate}
                  onChange={(e) => setDividendForm((prev) => ({ ...prev, dividendRate: e.target.value }))}
                  disabled={dividendForm.calculationMode !== 'percentage_based'}
                />
              </div>
              <div className="space-y-1">
                <Label>Dividend Pool (KES)</Label>
                <Input
                  type="number"
                  value={dividendForm.totalDividendPool}
                  onChange={(e) => setDividendForm((prev) => ({ ...prev, totalDividendPool: e.target.value }))}
                  disabled={dividendForm.calculationMode !== 'pool_based'}
                />
              </div>
              <div className="space-y-1">
                <Label>Eligibility Rule</Label>
                <Select
                  value={dividendForm.eligibilityRule}
                  onValueChange={(value) => setDividendForm((prev) => ({ ...prev, eligibilityRule: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_with_shares">All members with shares</SelectItem>
                    <SelectItem value="active_members">Only active members</SelectItem>
                    <SelectItem value="minimum_share_capital">Only members meeting minimum capital</SelectItem>
                    <SelectItem value="no_defaulted_loans">Only members with no defaulted loans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label>Notes</Label>
                <Input
                  value={dividendForm.notes}
                  onChange={(e) => setDividendForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="md:col-span-3 flex flex-wrap gap-2">
                <Button onClick={saveDividendSetup} disabled={isReadOnly}>Save Setup</Button>
                <Button variant="outline" onClick={previewDividend}>Generate Preview</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dividend-preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dividend Preview Before Approval</CardTitle>
              <CardDescription>No dividend is posted until you approve distribution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!preview ? (
                <p className="text-muted-foreground">No preview generated yet. Use Dividend Setup tab to generate preview.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="border rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Total Members Eligible</p>
                      <p className="font-semibold">{preview.totalMembersEligible}</p>
                    </div>
                    <div className="border rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Total Shares</p>
                      <p className="font-semibold">{Number(preview.totalShares).toLocaleString()}</p>
                    </div>
                    <div className="border rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Total Dividend Pool</p>
                      <p className="font-semibold">KES {Number(preview.totalDividendPool).toLocaleString()}</p>
                    </div>
                    <div className="border rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Total Dividends</p>
                      <p className="font-semibold">KES {Number(preview.totalDividendsToBeDistributed).toLocaleString()}</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member Name</TableHead>
                        <TableHead>Member ID</TableHead>
                        <TableHead className="text-right">Number of Shares</TableHead>
                        <TableHead className="text-right">Total Share Capital</TableHead>
                        <TableHead className="text-right">Dividend Amount</TableHead>
                        <TableHead>Distribution Period</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row) => (
                        <TableRow key={`${row.memberObjectId}-${row.memberId}`}>
                          <TableCell>{row.memberName}</TableCell>
                          <TableCell>{row.memberId}</TableCell>
                          <TableCell className="text-right">{Number(row.numberOfShares).toLocaleString()}</TableCell>
                          <TableCell className="text-right">KES {Number(row.shareCapitalValue).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">KES {Number(row.dividendEarned).toLocaleString()}</TableCell>
                          <TableCell>{preview.distributionPeriod}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Button onClick={approveDistribution} disabled={isReadOnly}>Approve Distribution</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dividend-history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dividend Distribution History</CardTitle>
              <CardDescription>Completed distributions and payout totals.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Calculation</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead className="text-right">Eligible Members</TableHead>
                    <TableHead className="text-right">Total Shares</TableHead>
                    <TableHead className="text-right">Dividend Pool</TableHead>
                    <TableHead className="text-right">Distributed</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">No dividend distribution history yet.</TableCell>
                    </TableRow>
                  ) : (
                    history.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell>{item.distributionPeriod}</TableCell>
                        <TableCell>{item.calculationMode}</TableCell>
                        <TableCell>{item.eligibilityRule}</TableCell>
                        <TableCell className="text-right">{item.totalMembersEligible}</TableCell>
                        <TableCell className="text-right">{Number(item.totalSharesAtDistribution).toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {Number(item.totalDividendPool).toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {Number(item.totalDividendsDistributed).toLocaleString()}</TableCell>
                        <TableCell>{new Date(item.approvedAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportReportsCsv}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={exportReportsPdf}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Share Capital</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">KES {Number(reports?.totalShareCapitalReport.totalShareCapital || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Number of Shares</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{Number(reports?.totalShareCapitalReport.totalNumberOfShares || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Members With Shares</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{reports?.totalShareCapitalReport.totalMembersWithShares || 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Shareholders</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Member ID</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Share Capital</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reports?.topShareholders || []).map((item) => (
                    <TableRow key={item.memberObjectId}>
                      <TableCell>{item.memberName}</TableCell>
                      <TableCell>{item.memberId}</TableCell>
                      <TableCell className="text-right">{Number(item.numberOfShares).toLocaleString()}</TableCell>
                      <TableCell className="text-right">KES {Number(item.shareCapital).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit-logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Logs</CardTitle>
              <CardDescription>Administrative actions for contributions and dividends.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Affected Member / Ref</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No audit logs yet.</TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{log.userId?.fullName || log.userId?.email || 'System'}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>
                          {String((log.changes?.memberId as string) || (log.changes?.memberObjectId as string) || (log.changes?.distributionPeriod as string) || 'N/A')}
                        </TableCell>
                        <TableCell>{String((log.changes?.notes as string) || (log.changes?.reason as string) || 'N/A')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
