import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, FileSpreadsheet, TrendingUp, Users, Wallet, FileBarChart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import API_BASE from '@/lib/api';
import { authService } from '@/lib/authService';
import { useState, useEffect } from 'react';
import smcfLogo from '@/assets/newsmcflogo.png';

const ReportsTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [systemReportLoading, setSystemReportLoading] = useState(false);
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
      const targetAmount = members.length * 224;
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Cycle Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
    .logo { max-width: 120px; height: auto; margin: 0 auto 15px; display: block; }
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
    <img src="${smcfLogo}" alt="SMCF Logo" class="logo" />
    <h1>SMCF - Smart Moves Cash Flow</h1>
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
          <th>Name</th>
          <th>Position</th>
          <th>Status</th>
          <th>Contributed</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(member => `
          <tr>
            <td>${member.name || 'Unknown'}</td>
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
    <p><strong>SMCF - Smart Moves Cash Flow</strong></p>
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

  const generateCompleteSystemReport = async () => {
    setSystemReportLoading(true);
    try {
      // Fetch all system data
      const [
        cyclesRes,
        membersRes,
        paymentsRes,
        loansRes,
        savingsRes,
        disbursementsRes,
        feesRes,
        announcementsRes
      ] = await Promise.all([
        fetch(`${API_BASE}/api/cycles`, { headers: { ...authService.getAuthHeaders() } }),
        fetch(`${API_BASE}/api/members`, { headers: { ...authService.getAuthHeaders() } }),
        fetch(`${API_BASE}/api/payments`, { headers: { ...authService.getAuthHeaders() } }),
        fetch(`${API_BASE}/api/loans/admin/all`, { headers: { ...authService.getAuthHeaders() } }),
        fetch(`${API_BASE}/api/savings/admin/all`, { headers: { ...authService.getAuthHeaders() } }),
        fetch(`${API_BASE}/api/disbursements`, { headers: { ...authService.getAuthHeaders() } }),
        fetch(`${API_BASE}/api/payments/fees/summary`, { headers: { ...authService.getAuthHeaders() } }),
        fetch(`${API_BASE}/api/announcements`, { headers: { ...authService.getAuthHeaders() } }),
      ]);

      const cycles = await cyclesRes.json();
      const membersData = await membersRes.json();
      const paymentsData = await paymentsRes.json();
      const loansData = await loansRes.json();
      const savingsData = await savingsRes.json();
      const disbursementsData = await disbursementsRes.json();
      const feesData = await feesRes.json();
      const announcementsData = await announcementsRes.json();

      // Process data
      const allCycles = Array.isArray(cycles) ? cycles : [];
      const allMembers = Array.isArray(membersData) ? membersData : [];
      const allPayments = Array.isArray(paymentsData) ? paymentsData : [];
      const allLoans = loansData.success && Array.isArray(loansData.data) ? loansData.data : [];
      const allSavings = savingsData.success && Array.isArray(savingsData.data) ? savingsData.data : [];
      const allDisbursements = Array.isArray(disbursementsData) ? disbursementsData : [];
      const feesSummary = feesData.success ? feesData.data : null;
      const allAnnouncements = Array.isArray(announcementsData) ? announcementsData : [];

      // Calculate statistics
      const totalMembers = allMembers.length;
      const activeMembers = allMembers.filter((m: any) => m.status !== 'inactive').length;
      const totalCycles = allCycles.length;
      const completedCycles = allCycles.filter((c: any) => c.status === 'completed').length;
      
      const totalPayments = allPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const totalLoaned = allLoans.filter((l: any) => ['disbursed', 'repaid'].includes(l.status)).reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
      const totalRepaid = allLoans.filter((l: any) => l.status === 'repaid').reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
      const outstandingLoans = allLoans.filter((l: any) => l.status === 'disbursed').reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
      
      const totalSavings = allSavings.reduce((sum: number, s: any) => sum + (s.currentBalance || 0), 0);
      const totalDeposits = allSavings.reduce((sum: number, s: any) => sum + (s.totalDeposits || 0), 0);
      const totalWithdrawals = allSavings.reduce((sum: number, s: any) => sum + (s.totalWithdrawals || 0), 0);
      
      const totalDisbursed = allDisbursements.filter((d: any) => d.status === 'completed').reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
      const totalFees = feesSummary?.totalFees || 0;

      // Generate comprehensive HTML report
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Complete System Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1f2937; background: #f9fafb; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 4px solid #2563eb; padding-bottom: 30px; }
    .logo { max-width: 150px; height: auto; margin: 0 auto 20px; display: block; }
    .header h1 { color: #2563eb; margin: 0; font-size: 36px; font-weight: 700; }
    .header .subtitle { color: #6b7280; margin: 10px 0 5px; font-size: 18px; }
    .header .timestamp { color: #9ca3af; font-size: 14px; }
    
    .section { margin: 40px 0; page-break-inside: avoid; }
    .section-title { color: #2563eb; font-size: 24px; font-weight: 700; border-bottom: 3px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px; }
    .subsection-title { color: #374151; font-size: 18px; font-weight: 600; margin: 25px 0 15px; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 25px 0; }
    .stat-card { background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 20px; border-radius: 12px; border-left: 5px solid #2563eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .stat-value { font-size: 28px; font-weight: 700; color: #2563eb; margin-top: 8px; }
    .stat-subtext { font-size: 11px; color: #9ca3af; margin-top: 5px; }
    
    .stat-card.success { border-left-color: #10b981; }
    .stat-card.success .stat-value { color: #10b981; }
    .stat-card.warning { border-left-color: #f59e0b; }
    .stat-card.warning .stat-value { color: #f59e0b; }
    .stat-card.danger { border-left-color: #ef4444; }
    .stat-card.danger .stat-value { color: #ef4444; }
    .stat-card.purple { border-left-color: #8b5cf6; }
    .stat-card.purple .stat-value { color: #8b5cf6; }
    
    table { width: 100%; border-collapse: collapse; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 14px 12px; text-align: left; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    tr:nth-child(even) { background: #f9fafb; }
    tr:hover { background: #f3f4f6; }
    
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #d1fae5; color: #065f46; }
    .status-completed { background: #dbeafe; color: #1e40af; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-disbursed { background: #fce7f3; color: #831843; }
    .status-repaid { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    
    .footer { margin-top: 60px; text-align: center; color: #6b7280; font-size: 12px; border-top: 3px solid #e5e7eb; padding-top: 30px; }
    .footer-logo { max-width: 100px; margin: 0 auto 15px; opacity: 0.6; }
    
    .summary-box { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 25px; border-radius: 12px; border: 2px solid #2563eb; margin: 20px 0; }
    .summary-box h3 { color: #1e40af; margin-bottom: 15px; font-size: 18px; }
    .summary-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #93c5fd; }
    .summary-item:last-child { border-bottom: none; }
    .summary-label { color: #3b82f6; font-weight: 600; }
    .summary-value { color: #1e40af; font-weight: 700; }
    
    @media print {
      body { background: white; margin: 0; }
      .container { box-shadow: none; padding: 20px; }
      .section { page-break-inside: avoid; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${smcfLogo}" alt="SMCF Logo" class="logo" />
      <h1>SMCF Complete System Report</h1>
      <p class="subtitle">Smart Moves Cash Flow - Digital Table Banking Platform</p>
      <p class="timestamp">Generated on: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString()}</p>
    </div>

    <!-- EXECUTIVE SUMMARY -->
    <div class="section">
      <h2 class="section-title">📊 Executive Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Members</div>
          <div class="stat-value">${totalMembers}</div>
          <div class="stat-subtext">${activeMembers} active</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Total Payments</div>
          <div class="stat-value">KES ${totalPayments.toLocaleString()}</div>
          <div class="stat-subtext">${allPayments.length} transactions</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-label">Total Savings</div>
          <div class="stat-value">KES ${totalSavings.toLocaleString()}</div>
          <div class="stat-subtext">Current balances</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Completed Cycles</div>
          <div class="stat-value">${completedCycles}</div>
          <div class="stat-subtext">of ${totalCycles} total</div>
        </div>
      </div>

      <div class="summary-box">
        <h3>💰 Financial Overview</h3>
        <div class="summary-item">
          <span class="summary-label">Total Contributions Collected:</span>
          <span class="summary-value">KES ${totalPayments.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Loans Disbursed:</span>
          <span class="summary-value">KES ${totalLoaned.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Loans Repaid:</span>
          <span class="summary-value">KES ${totalRepaid.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Outstanding Loans:</span>
          <span class="summary-value">KES ${outstandingLoans.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Savings Deposits:</span>
          <span class="summary-value">KES ${totalDeposits.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Withdrawals:</span>
          <span class="summary-value">KES ${totalWithdrawals.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Current Savings Balance:</span>
          <span class="summary-value">KES ${totalSavings.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Disbursements Paid:</span>
          <span class="summary-value">KES ${totalDisbursed.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Transaction Fees Collected:</span>
          <span class="summary-value">KES ${totalFees.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- CYCLES SECTION -->
    <div class="section">
      <h2 class="section-title">🔄 Contribution Cycles</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Cycles</div>
          <div class="stat-value">${totalCycles}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Completed</div>
          <div class="stat-value">${completedCycles}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Active</div>
          <div class="stat-value">${allCycles.filter((c: any) => c.status === 'active').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Average Collection</div>
          <div class="stat-value">KES ${totalCycles > 0 ? Math.round(totalPayments / totalCycles).toLocaleString() : 0}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Cycle #</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Status</th>
            <th>Amount Collected</th>
            <th>Members Paid</th>
          </tr>
        </thead>
        <tbody>
          ${allCycles.slice(0, 20).map((cycle: any) => `
            <tr>
              <td><strong>#${cycle.cycle_number || 'N/A'}</strong></td>
              <td>${cycle.start_date ? new Date(cycle.start_date).toLocaleDateString() : 'Not Started'}</td>
              <td>${cycle.end_date ? new Date(cycle.end_date).toLocaleDateString() : 'Ongoing'}</td>
              <td><span class="status-badge status-${cycle.status || 'pending'}">${(cycle.status || 'pending').toUpperCase()}</span></td>
              <td><strong>KES ${(cycle.total_amount_collected || 0).toLocaleString()}</strong></td>
              <td>${cycle.paid_members || 0}/${cycle.total_members || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${allCycles.length > 20 ? `<p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 10px;">Showing 20 of ${allCycles.length} cycles</p>` : ''}
    </div>

    <!-- MEMBERS SECTION -->
    <div class="section">
      <h2 class="section-title">👥 Members Directory</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Members</div>
          <div class="stat-value">${totalMembers}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Active</div>
          <div class="stat-value">${activeMembers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg. Contribution</div>
          <div class="stat-value">KES ${totalMembers > 0 ? Math.round(totalPayments / totalMembers).toLocaleString() : 0}</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-label">Avg. Savings</div>
          <div class="stat-value">KES ${totalMembers > 0 ? Math.round(totalSavings / totalMembers).toLocaleString() : 0}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Position</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Current Balance</th>
            <th>Total Contributed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${allMembers.map((member: any) => `
            <tr>
              <td><strong>#${member.position || 'N/A'}</strong></td>
              <td>${member.name || 'Unknown'}</td>
              <td>${member.phone || 'N/A'}</td>
              <td><strong>KES ${(member.current_balance || 0).toLocaleString()}</strong></td>
              <td>KES ${(member.total_contributed || 0).toLocaleString()}</td>
              <td><span class="status-badge status-${member.status || 'active'}">${(member.status || 'active').toUpperCase()}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- LOANS SECTION -->
    <div class="section">
      <h2 class="section-title">💳 Loans Management</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Loans</div>
          <div class="stat-value">${allLoans.length}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Total Loaned</div>
          <div class="stat-value">KES ${totalLoaned.toLocaleString()}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Total Repaid</div>
          <div class="stat-value">KES ${totalRepaid.toLocaleString()}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Outstanding</div>
          <div class="stat-value">KES ${outstandingLoans.toLocaleString()}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Amount</th>
            <th>Interest</th>
            <th>Total Repayable</th>
            <th>Status</th>
            <th>Disbursement Date</th>
          </tr>
        </thead>
        <tbody>
          ${allLoans.slice(0, 50).map((loan: any) => `
            <tr>
              <td>${loan.member_id?.name || 'Unknown'}</td>
              <td><strong>KES ${(loan.amount || 0).toLocaleString()}</strong></td>
              <td>KES ${(loan.interest || 0).toLocaleString()}</td>
              <td><strong>KES ${(loan.total_repayable || 0).toLocaleString()}</strong></td>
              <td><span class="status-badge status-${loan.status || 'pending'}">${(loan.status || 'pending').toUpperCase()}</span></td>
              <td>${loan.disbursement_date ? new Date(loan.disbursement_date).toLocaleDateString() : 'Not Disbursed'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${allLoans.length > 50 ? `<p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 10px;">Showing 50 of ${allLoans.length} loans</p>` : ''}
    </div>

    <!-- SAVINGS SECTION -->
    <div class="section">
      <h2 class="section-title">💰 Savings Accounts</h2>
      <div class="stats-grid">
        <div class="stat-card success">
          <div class="stat-label">Total Savings</div>
          <div class="stat-value">KES ${totalSavings.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Deposits</div>
          <div class="stat-value">KES ${totalDeposits.toLocaleString()}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Total Withdrawals</div>
          <div class="stat-value">KES ${totalWithdrawals.toLocaleString()}</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-label">Net Savings</div>
          <div class="stat-value">KES ${(totalDeposits - totalWithdrawals).toLocaleString()}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Current Balance</th>
            <th>Total Deposits</th>
            <th>Total Withdrawals</th>
            <th>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          ${allSavings.map((saving: any) => `
            <tr>
              <td>${saving.member_id?.name || 'Unknown'}</td>
              <td><strong>KES ${(saving.currentBalance || 0).toLocaleString()}</strong></td>
              <td>KES ${(saving.totalDeposits || 0).toLocaleString()}</td>
              <td>KES ${(saving.totalWithdrawals || 0).toLocaleString()}</td>
              <td>${saving.lastActivity ? new Date(saving.lastActivity).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- DISBURSEMENTS SECTION -->
    <div class="section">
      <h2 class="section-title">📤 Disbursements History</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Disbursements</div>
          <div class="stat-value">${allDisbursements.length}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Completed</div>
          <div class="stat-value">${allDisbursements.filter((d: any) => d.status === 'completed').length}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Pending</div>
          <div class="stat-value">${allDisbursements.filter((d: any) => d.status === 'pending').length}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Total Amount</div>
          <div class="stat-value">KES ${totalDisbursed.toLocaleString()}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Amount</th>
            <th>Cycle</th>
            <th>Method</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${allDisbursements.slice(0, 50).map((disbursement: any) => `
            <tr>
              <td>${disbursement.member_id?.name || 'Unknown'}</td>
              <td><strong>KES ${(disbursement.amount || 0).toLocaleString()}</strong></td>
              <td>Cycle #${disbursement.cycle_id?.cycle_number || 'N/A'}</td>
              <td>${(disbursement.method || 'manual').toUpperCase()}</td>
              <td><span class="status-badge status-${disbursement.status || 'pending'}">${(disbursement.status || 'pending').toUpperCase()}</span></td>
              <td>${disbursement.disbursement_date ? new Date(disbursement.disbursement_date).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${allDisbursements.length > 50 ? `<p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 10px;">Showing 50 of ${allDisbursements.length} disbursements</p>` : ''}
    </div>

    <!-- TRANSACTION FEES SECTION -->
    <div class="section">
      <h2 class="section-title">💵 Transaction Fees</h2>
      <div class="summary-box">
        <h3>Fee Collection Summary</h3>
        <div class="summary-item">
          <span class="summary-label">Total Fees Collected:</span>
          <span class="summary-value">KES ${totalFees.toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Contribution Fees:</span>
          <span class="summary-value">KES ${(feesSummary?.contributionFees || 0).toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Disbursement Fees:</span>
          <span class="summary-value">KES ${(feesSummary?.disbursementFees || 0).toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Loan Processing Fees:</span>
          <span class="summary-value">KES ${(feesSummary?.loanFees || 0).toLocaleString()}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Other Fees:</span>
          <span class="summary-value">KES ${(feesSummary?.otherFees || 0).toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- ANNOUNCEMENTS SECTION -->
    <div class="section">
      <h2 class="section-title">📢 Recent Announcements</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Title</th>
            <th>Message</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          ${allAnnouncements.slice(0, 10).map((announcement: any) => `
            <tr>
              <td>${announcement.createdAt ? new Date(announcement.createdAt).toLocaleDateString() : 'N/A'}</td>
              <td><strong>${announcement.title || 'Untitled'}</strong></td>
              <td>${announcement.message || ''}</td>
              <td><span class="status-badge status-${announcement.type || 'info'}">${(announcement.type || 'info').toUpperCase()}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${allAnnouncements.length > 10 ? `<p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 10px;">Showing 10 of ${allAnnouncements.length} announcements</p>` : ''}
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <img src="${smcfLogo}" alt="SMCF Logo" class="footer-logo" />
      <p><strong>SMCF - Smart Moves Cash Flow</strong></p>
      <p>Digital Table Banking Platform | Automated Contributions | Secure Transactions | Financial Empowerment</p>
      <p style="margin-top: 15px;">This report is confidential and intended for authorized personnel only.</p>
      <p style="margin-top: 5px;">© ${new Date().getFullYear()} SMCF. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `;

      // Open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          toast({
            title: 'Complete System Report Ready',
            description: 'Print dialog opened. Choose "Save as PDF" to download the complete report.',
          });
        }, 500);
      } else {
        throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
      }
    } catch (err: any) {
      toast({
        title: 'Report Generation Failed',
        description: err.message || 'Could not generate complete system report',
        variant: 'destructive',
      });
    } finally {
      setSystemReportLoading(false);
    }
  };

  const exportCSV = () => {
    try {
      // Generate CSV data
      const csvData = [
        ['SMCF - Smart Moves Cash Flow', `Cycle #${currentCycle?.cycle_number || 'N/A'}`, `Generated: ${new Date().toLocaleString()}`],
        [],
        ['Name', 'Position', 'Status', 'Total Contributed', 'Total Received'],
        ...members.map(m => [
          m.name || 'Unknown',
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
        ['Target Amount', `KES ${members.length * 224}`],
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
      {/* Complete System Report Card */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileBarChart className="w-6 h-6 text-primary" />
            Complete System Report
          </CardTitle>
          <CardDescription className="text-base">
            Generate a comprehensive PDF report containing all system data: members, cycles, loans, savings, disbursements, fees, and announcements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>All Cycles Data</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Members Directory</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Loans & Repayments</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Savings Accounts</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Disbursements History</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Transaction Fees</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Financial Summary</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Announcements</span>
              </div>
            </div>
            <Button
              onClick={generateCompleteSystemReport}
              size="lg"
              className="w-full text-base font-semibold"
              disabled={systemReportLoading}>
              <FileBarChart className="w-5 h-5 mr-2" />
              {systemReportLoading ? 'Generating Complete Report...' : 'Download Complete System Report (PDF)'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This report includes all data from the system. Processing may take a few moments.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Cycle Reports & Exports
          </CardTitle>
          <CardDescription>Generate exportable cycle-specific financial reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Exports: Cycle summaries, Member contributions, Payment history
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
