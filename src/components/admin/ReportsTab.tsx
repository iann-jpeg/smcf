import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, FileSpreadsheet, TrendingUp, Users, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import API_BASE from '@/lib/api';
import { authService } from '@/lib/authService';
import { useState, useEffect } from 'react';

const ReportsTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentCycle, setCurrentCycle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      const [cycleRes, membersRes, paymentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/cycles/current`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/members`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/payments`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ]);

      const cycleData = await cycleRes.json();
      const membersData = await membersRes.json();
      const paymentsData = await paymentsRes.json();

      setCurrentCycle(cycleData.success ? cycleData.data : null);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    }
  };

  const generateCyclePDF = async () => {
    setLoading(true);
    try {
      // Create PDF content as HTML
      const cycle = currentCycle;
      const paidMembers = members.filter(m => m.payment_status === 'paid');
      const pendingMembers = members.filter(m => m.payment_status === 'pending');
      const totalCollected = cycle?.total_amount_collected || 0;
      const targetAmount = members.length * 204;
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Cycle Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
    .header h1 { color: #2563eb; margin: 0; font-size: 28px; }
    .header p { color: #666; margin: 5px 0; }
    .section { margin: 30px 0; }
    .section h2 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .status-paid { color: #16a34a; font-weight: bold; }
    .status-pending { color: #ea580c; font-weight: bold; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
    .progress-bar { background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
    .progress-fill { background: #2563eb; height: 100%; transition: width 0.3s; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SMCF - Smart Money Cash Flow</h1>
    <p>Cycle Report #${cycle?.cycle_number || 'N/A'}</p>
    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>

  <div class="section">
    <h2>Cycle Summary</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Cycle Number</div>
        <div class="stat-value">#${cycle?.cycle_number || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Start Date</div>
        <div class="stat-value">${cycle?.start_date ? new Date(cycle.start_date).toLocaleDateString() : 'Not Started'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Status</div>
        <div class="stat-value">${cycle?.status || 'Inactive'}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Collection Progress</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Paid Members</div>
        <div class="stat-value">${paidMembers.length}/${members.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Amount Collected</div>
        <div class="stat-value" style="color: #16a34a;">KES ${totalCollected.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Target Amount</div>
        <div class="stat-value">KES ${targetAmount.toLocaleString()}</div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${members.length > 0 ? (paidMembers.length / members.length * 100) : 0}%;"></div>
    </div>
    <p style="text-align: center; color: #666; margin-top: 5px;">
      ${members.length > 0 ? Math.round(paidMembers.length / members.length * 100) : 0}% Complete
    </p>
  </div>

  <div class="section">
    <h2>Member Payment Status</h2>
    <table>
      <thead>
        <tr>
          <th>Member ID</th>
          <th>Name</th>
          <th>Phone</th>
          <th>Position</th>
          <th>Status</th>
          <th>Contributed</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(member => `
          <tr>
            <td>${member.member_id || 'N/A'}</td>
            <td>${member.name || 'Unknown'}</td>
            <td>${member.phone || 'N/A'}</td>
            <td>${member.position || '-'}</td>
            <td class="${member.payment_status === 'paid' ? 'status-paid' : 'status-pending'}">
              ${member.payment_status === 'paid' ? '✓ Paid' : '○ Pending'}
            </td>
            <td>KES ${(member.total_contributed || 0).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Recent Payments</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Member</th>
          <th>Transaction ID</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${payments.slice(0, 10).map(payment => `
          <tr>
            <td>${payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A'}</td>
            <td>${payment.member_id?.name || payment.phone || 'Unknown'}</td>
            <td>${payment.mpesa_transaction_id || 'N/A'}</td>
            <td style="color: #16a34a; font-weight: bold;">KES ${payment.amount || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Financial Summary</h2>
    <table>
      <tbody>
        <tr>
          <td><strong>Total Members</strong></td>
          <td style="text-align: right;">${members.length}</td>
        </tr>
        <tr>
          <td><strong>Paid Members</strong></td>
          <td style="text-align: right;">${paidMembers.length}</td>
        </tr>
        <tr>
          <td><strong>Pending Members</strong></td>
          <td style="text-align: right;">${pendingMembers.length}</td>
        </tr>
        <tr>
          <td><strong>Total Collected</strong></td>
          <td style="text-align: right; color: #16a34a; font-weight: bold;">KES ${totalCollected.toLocaleString()}</td>
        </tr>
        <tr>
          <td><strong>Target Amount</strong></td>
          <td style="text-align: right; font-weight: bold;">KES ${targetAmount.toLocaleString()}</td>
        </tr>
        <tr>
          <td><strong>Remaining</strong></td>
          <td style="text-align: right; color: #ea580c; font-weight: bold;">KES ${(targetAmount - totalCollected).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p><strong>SMCF - Smart Money Cash Flow</strong></p>
    <p>Digital Table Banking Platform | Automated Contributions | Secure Transactions</p>
    <p>This report is confidential and intended for authorized personnel only.</p>
  </div>
</body>
</html>
      `;

      // Create a new window and print as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        setTimeout(() => {
          printWindow.print();
          toast({
            title: 'PDF Ready',
            description: 'Print dialog opened. Choose "Save as PDF" to download.',
          });
        }, 500);
      } else {
        throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
      }
    } catch (err: any) {
      toast({
        title: 'PDF Generation Failed',
        description: err.message || 'Could not generate PDF report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    try {
      // Generate CSV data
      const csvData = [
        ['SMCF Cycle Report', `Cycle #${currentCycle?.cycle_number || 'N/A'}`, `Generated: ${new Date().toLocaleString()}`],
        [],
        ['Member ID', 'Name', 'Phone', 'Position', 'Status', 'Total Contributed', 'Total Received'],
        ...members.map(m => [
          m.member_id || 'N/A',
          m.name || 'Unknown',
          m.phone || 'N/A',
          m.position || '-',
          m.payment_status || 'pending',
          m.total_contributed || 0,
          m.total_received || 0,
        ]),
        [],
        ['Summary'],
        ['Total Members', members.length],
        ['Paid Members', members.filter(m => m.payment_status === 'paid').length],
        ['Pending Members', members.filter(m => m.payment_status === 'pending').length],
        ['Total Collected', `KES ${currentCycle?.total_amount_collected || 0}`],
        ['Target Amount', `KES ${members.length * 204}`],
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smcf-cycle-${currentCycle?.cycle_number || 'report'}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'CSV Export Complete',
        description: 'Cycle report has been downloaded as CSV',
      });
    } catch (err) {
      toast({
        title: 'CSV Export Failed',
        description: 'Could not export CSV report',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Reports & Exports
          </CardTitle>
          <CardDescription>Generate exportable financial and activity reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Exports: Cycle summaries, Member contributions, Payment history, Income vs Expenditure
            </div>
            
            {/* Current Cycle Info */}
            {currentCycle && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">Current Cycle #{currentCycle.cycle_number}</h3>
                      <span className="px-2 py-0.5 bg-financial-success/20 text-financial-success text-xs font-medium rounded-full">Active</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {members.filter(m => m.payment_status === 'paid').length}/{members.length} members paid | 
                      KES {(currentCycle.total_amount_collected || 0).toLocaleString()} collected
                    </p>
                    <Progress 
                      value={members.length > 0 ? (members.filter(m => m.payment_status === 'paid').length / members.length) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={exportCSV}
                      variant="outline"
                      size="sm"
                      disabled={loading}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button
                      onClick={generateCyclePDF}
                      variant="default"
                      size="sm"
                      disabled={loading}>
                      <Download className="w-4 h-4 mr-2" />
                      {loading ? 'Generating...' : 'Download PDF'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Total Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{members.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active participants</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-financial-success" />
                    Total Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-financial-success">
                    KES {(currentCycle?.total_amount_collected || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This cycle</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    Collection Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {members.length > 0 
                      ? Math.round((members.filter(m => m.payment_status === 'paid').length / members.length) * 100)
                      : 0}%
                  </div>
                  <Progress 
                    value={members.length > 0 ? (members.filter(m => m.payment_status === 'paid').length / members.length) * 100 : 0} 
                    className="mt-2 h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">{members.filter(m => m.payment_status === 'paid').length}/{members.length} members paid</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
