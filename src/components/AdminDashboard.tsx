import smcfLogo from "@/assets/smcf-logo.png";
import AddMemberDialog from "@/components/AddMemberDialog";
import AnnouncementDialog from "@/components/AnnouncementDialog";
import MpesaDisbursementDialog from "@/components/MpesaDisbursementDialog";
import TransactionFeesReport from "@/components/TransactionFeesReport";
import SavingsTab from "@/components/admin/SavingsTab";
import ContributionCycleChart from "@/components/analytics/ContributionCycleChart";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Download,
  Edit,
  FileSpreadsheet,
  LogOut,
  Megaphone,
  Save,
  Send,
  Settings,
  Trash2,
  TrendingUp,
  User,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ApprovalsTab from "./admin/ApprovalsTab";
import LoansTab from "./admin/LoansTab";
import OnlineMembersCard from "./admin/OnlineMembersCard";
import ProfileSettings from "./admin/ProfileSettings";
import ReportsTab from "./admin/ReportsTab";
// ...existing code...

interface AdminDashboardProps {
  userData: any;
  members: any[];
  announcements: any[];
  onLogout: () => void;
  refreshMembers?: () => void;
  cycleData?: any;
}

const AdminDashboard = ({
  userData,
  members,
  announcements,
  onLogout,
  refreshMembers,
}: AdminDashboardProps) => {
  console.log("AdminDashboard rendered with:", {
    userData,
    members: members?.length || 0,
    announcements: announcements?.length || 0,
  });

  // Safety check for required data
  if (!userData || !userData.cycleData) {
    console.log("Missing userData or cycleData, rendering fallback");
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            Loading Admin Dashboard...
          </h2>
          <p className="text-muted-foreground">
            Please wait while we load your data.
          </p>
        </div>
      </div>
    );
  }

  const { toast } = useToast();
  const [showDisbursementDialog, setShowDisbursementDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editedMemberData, setEditedMemberData] = useState<any>({});
  const [contributionAmount, setContributionAmount] = useState<number>(224);
  const [newContributionAmount, setNewContributionAmount] =
    useState<string>("");

  // Real-time data states
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [currentCycle, setCurrentCycle] = useState<any>(null);
  const [cycleStats, setCycleStats] = useState<any>(null);
  const [savingsData, setSavingsData] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [feeSummary, setFeeSummary] = useState<any>(null);

  // Safe fallbacks to avoid runtime errors when data is undefined
  const safeMembers = Array.isArray(members) ? members : [];
  // sort by position if present
  const orderedMembers = [...safeMembers].sort((a: any, b: any) => {
    if (a?.position != null && b?.position != null)
      return a.position - b.position;
    if (a?.position != null) return -1;
    if (b?.position != null) return 1;
    return 0;
  });

  // Calculate paid members from actual payment records for CURRENT CYCLE ONLY
  const currentCycleNumber = currentCycle?.cycle_number || null;

  // Filter payments for current cycle only (same as Dashboard and MemberDashboard)
  const currentCyclePayments = currentCycleNumber
    ? allPayments.filter((p: any) => p.cycle_number === currentCycleNumber)
    : allPayments;

  const completedPayments = currentCyclePayments.filter(
    (p: any) => p.status === "completed"
  );
  const paidMemberIds = new Set(
    completedPayments.map((p: any) => p.member_id?._id || p.member_id)
  );
  const paidMembers = orderedMembers.filter(
    (m: any) => m && paidMemberIds.has(m._id || m.id)
  );
  const pendingMembers = orderedMembers.filter(
    (m: any) => m && !paidMemberIds.has(m._id || m.id)
  );

  // Calculate total collected from current cycle payments only
  const totalCollected = completedPayments.reduce(
    (sum: number, p: any) => sum + (p.amount || 0),
    0
  );

  // Polling for real-time data
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Silent background fetch without UI flicker
  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/payments`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });
      const data = await res.json();
      const paymentsArray = Array.isArray(data) ? data : [];

      // Store all payments for statistics calculation
      setAllPayments((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(paymentsArray)) {
          return paymentsArray;
        }
        return prev;
      });

      // Store recent 5 for display
      setRecentPayments((prev) => {
        const newData = paymentsArray.slice(0, 5);
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });
    } catch (e) {
      console.error("Could not fetch payments", e);
    }
  };

  const fetchDisbursements = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/disbursements`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });
      const data = await res.json();
      // Only update if data changed
      setDisbursements((prev) => {
        const newData = Array.isArray(data) ? data.slice(0, 10) : [];
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });
    } catch (e) {
      console.error("Could not fetch disbursements", e);
    }
  };

  const generateDisbursementReceipt = (disbursement: any) => {
    const transactionId =
      disbursement.mpesa_transaction_id ||
      disbursement.transaction_id ||
      `MAN${
        disbursement._id?.slice(-10) ||
        Math.random().toString(36).substring(7).toUpperCase()
      }`;

    const date = new Date(
      disbursement.disbursement_date || disbursement.created_at
    );
    const formattedDate = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Disbursement Receipt - ${transactionId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #1a472a 0%, #2d5f3f 100%);
      padding: 40px 20px;
      min-height: 100vh;
    }
    
    .receipt-container {
      max-width: 500px;
      margin: 0 auto;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    
    .header {
      background: linear-gradient(135deg, #1a472a 0%, #2d5f3f 100%);
      padding: 30px 20px;
      text-align: center;
      color: white;
    }
    
    .header h1 {
      font-size: 24px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    
    .status-badge {
      display: inline-block;
      background: rgba(76, 175, 80, 0.2);
      color: #4caf50;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 16px;
      font-weight: 600;
      margin-top: 10px;
    }
    
    .transaction-info {
      background: #1a1a1a;
      padding: 20px;
      border-bottom: 1px solid #333;
    }
    
    .transaction-info p {
      color: #888;
      font-size: 13px;
      margin-bottom: 4px;
    }
    
    .transaction-info .value {
      color: #9acd32;
      font-weight: 600;
    }
    
    .checkmark {
      width: 80px;
      height: 80px;
      background: #4caf50;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      color: white;
    }
    
    .amount-section {
      background: #000;
      padding: 30px 20px;
      text-align: center;
      border-bottom: 1px solid #333;
    }
    
    .amount-label {
      color: #888;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    .amount {
      color: #9acd32;
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    
    .details-section {
      background: #0a0a0a;
      padding: 25px 20px;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #222;
      color: white;
    }
    
    .detail-row:last-child {
      border-bottom: none;
    }
    
    .detail-label {
      color: #888;
      font-size: 14px;
    }
    
    .detail-value {
      color: white;
      font-size: 14px;
      font-weight: 600;
      text-align: right;
    }
    
    .transaction-details-header {
      color: white;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    }
    
    .footer {
      background: #000;
      padding: 20px;
      text-align: center;
    }
    
    .action-buttons {
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
    }
    
    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #9acd32;
      font-size: 12px;
      text-decoration: none;
      cursor: pointer;
    }
    
    .action-btn .icon {
      width: 40px;
      height: 40px;
      border: 2px solid #333;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      font-size: 20px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .receipt-container {
        box-shadow: none;
        max-width: 100%;
      }
      
      .action-buttons {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <h1>Transaction Details</h1>
    </div>
    
    <div class="transaction-info">
      <div class="status-badge">Success</div>
      <p style="margin-top: 15px;">Transaction ID: <span class="value">${transactionId}</span></p>
      <p>Date: <span class="value">${formattedDate}</span></p>
    </div>
    
    <div class="amount-section">
      <div class="checkmark">✓</div>
      <div class="amount-label">Disbursed Amount</div>
      <div class="amount">${(
        disbursement.amount || 0
      ).toLocaleString()} KES</div>
    </div>
    
    <div class="details-section">
      <div class="transaction-details-header">From</div>
      <div class="detail-row">
        <span class="detail-label">Account Name</span>
        <span class="detail-value">SMCF ADMIN</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Organization</span>
        <span class="detail-value">Smart Money Cash Flow</span>
      </div>
    </div>
    
    <div class="details-section">
      <div class="transaction-details-header">Transaction Details</div>
      <div class="detail-row">
        <span class="detail-label">To</span>
        <span class="detail-value">${
          disbursement.recipient_id?.name || "Unknown"
        }</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Phone Number</span>
        <span class="detail-value">${
          disbursement.recipient_id?.phone || disbursement.phone || "N/A"
        }</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Cycle Number</span>
        <span class="detail-value">#${
          disbursement.cycle_id?.cycle_number || "N/A"
        }</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Method</span>
        <span class="detail-value">${
          disbursement.method === "mpesa" ? "M-Pesa" : "Manual"
        }</span>
      </div>
    </div>
    
    <div class="footer">
      <div class="action-buttons">
        <div class="action-btn" onclick="window.print()">
          <div class="icon">📄</div>
          <span>Download<br>Receipt</span>
        </div>
        <div class="action-btn" onclick="window.print()">
          <div class="icon">🔄</div>
          <span>Share<br>Receipt</span>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Auto print on load (optional)
    // window.onload = function() { window.print(); }
  </script>
</body>
</html>
`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, "_blank");

    if (newWindow) {
      newWindow.onload = () => {
        setTimeout(() => {
          newWindow.print();
        }, 250);
      };
    }

    toast({
      title: "Receipt Generated",
      description: "Opening receipt in new window...",
    });
  };

  const generateDisbursementsPDF = () => {
    const totalDisbursed = disbursements.reduce(
      (sum, d) => sum + (d.amount || 0),
      0
    );
    const completedDisbursements = disbursements.filter(
      (d) => d.status === "completed"
    ).length;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SMCF Disbursements Report</title>
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
    th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    .status-completed { color: #16a34a; font-weight: bold; }
    .status-pending { color: #ea580c; font-weight: bold; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${smcfLogo}" alt="SMCF Logo" class="logo" />
    <h1>SMCF - Smart Moves Cash Flow</h1>
    <p>Disbursements Report</p>
    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>

  <div class="section">
    <h2>Disbursement Summary</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Disbursements</div>
        <div class="stat-value">${disbursements.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed</div>
        <div class="stat-value">${completedDisbursements}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Disbursed</div>
        <div class="stat-value">KES ${totalDisbursed.toLocaleString()}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>All Disbursements</h2>
    <table>
      <thead>
        <tr>
          <th>Cycle</th>
          <th>Recipient</th>
          <th>Amount</th>
          <th>Method</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${disbursements
          .map(
            (d) => `
          <tr>
            <td>#${d.cycle_id?.cycle_number || "-"}</td>
            <td>${d.member_id?.name || "Unknown"}</td>
            <td>KES ${(d.amount || 0).toLocaleString()}</td>
            <td>${d.method || "Manual"}</td>
            <td class="status-${d.status}">${(
              d.status || "pending"
            ).toUpperCase()}</td>
            <td>${d.date ? new Date(d.date).toLocaleDateString() : "-"}</td>
          </tr>
        `
          )
          .join("")}
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

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        toast({
          title: "PDF Ready",
          description: 'Print dialog opened. Choose "Save as PDF" to download.',
        });
      }, 500);
    } else {
      toast({
        title: "Pop-up Blocked",
        description: "Please allow pop-ups for this site.",
        variant: "destructive",
      });
    }
  };

  const exportDisbursementsCSV = () => {
    try {
      const totalDisbursed = disbursements.reduce(
        (sum, d) => sum + (d.amount || 0),
        0
      );

      const csvData = [
        [
          "SMCF - Smart Moves Cash Flow",
          "Disbursements Report",
          `Generated: ${new Date().toLocaleString()}`,
        ],
        [],
        [
          "Cycle",
          "Recipient",
          "Member ID",
          "Amount",
          "Method",
          "Status",
          "Date",
        ],
        ...disbursements.map((d) => [
          `#${d.cycle_id?.cycle_number || "-"}`,
          d.member_id?.name || "Unknown",
          d.member_id?.member_id || "-",
          d.amount || 0,
          d.method || "Manual",
          d.status || "pending",
          d.date ? new Date(d.date).toLocaleDateString() : "-",
        ]),
        [],
        ["Summary"],
        ["Total Disbursements", disbursements.length],
        ["Total Amount Disbursed", `KES ${totalDisbursed.toLocaleString()}`],
      ];

      const csvContent = csvData.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `smcf-disbursements-report-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "CSV Export Complete",
        description: "Disbursements report has been downloaded as CSV",
      });
    } catch (err) {
      toast({
        title: "CSV Export Failed",
        description: "Could not export CSV report",
        variant: "destructive",
      });
    }
  };

  const updateContributionAmount = async () => {
    const amount = Number(newContributionAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid contribution amount",
        variant: "destructive",
      });
      return;
    }

    if (
      !confirm(
        `Are you sure you want to change the monthly contribution from KES ${contributionAmount} to KES ${amount}? This will affect all future payments and cycles.`
      )
    ) {
      return;
    }

    try {
      // Update all members' monthly_contribution
      const updatePromises = safeMembers.map((member) =>
        fetch(`${API_BASE}/api/members/${member._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            monthly_contribution: amount,
          }),
        })
      );

      await Promise.all(updatePromises);

      // Update current cycle if exists
      if (currentCycle?._id) {
        await fetch(`${API_BASE}/api/cycles/${currentCycle._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            monthly_contribution: amount,
            total_amount_expected: safeMembers.length * amount,
          }),
        });
      }

      setContributionAmount(amount);
      setNewContributionAmount("");
      setShowSettingsDialog(false);
      refreshMembers();
      fetchCurrentCycle();

      toast({
        title: "Contribution Amount Updated",
        description: `Monthly contribution changed to KES ${amount.toLocaleString()} for all members`,
      });
    } catch (error: any) {
      console.error("Update contribution amount failed:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Could not update contribution amount",
        variant: "destructive",
      });
    }
  };

  const fetchLoans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/loans`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });
      const data = await res.json();
      // Only update if data changed
      setLoans((prev) => {
        const newData = Array.isArray(data) ? data : [];
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });
    } catch (e) {
      console.error("Could not fetch loans", e);
    }
  };

  const fetchCurrentCycle = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cycles/current`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });
      const data = await res.json();
      console.log("📊 Current cycle data:", data);

      // Extract the actual cycle data from the response
      const cycleData = data.success ? data.data : data;

      // Only update if data changed
      setCurrentCycle((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(cycleData)) {
          return cycleData;
        }
        return prev;
      });
    } catch (e) {
      console.error("Could not fetch current cycle", e);
    }
  };

  const fetchCycleStats = async () => {
    // Stats are now calculated from cycle data, no separate endpoint needed
    // This function is kept for backward compatibility but does nothing
  };

  const fetchSavings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/savings/admin/all`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });
      const data = await res.json();
      // Only update if data changed
      setSavingsData((prev) => {
        const newData =
          data.success && Array.isArray(data.data) ? data.data : [];
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });
    } catch (e) {
      console.error("Could not fetch savings data", e);
    }
  };

  const fetchPendingWithdrawals = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/savings/admin/pending-withdrawals`,
        {
          headers: {
            ...authService.getAuthHeaders(),
          },
        }
      );
      const data = await res.json();
      // Only update if data changed
      setPendingWithdrawals((prev) => {
        const newData =
          data.success && Array.isArray(data.data) ? data.data : [];
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });
    } catch (e) {
      console.error("Could not fetch pending withdrawals", e);
    }
  };

  const fetchFeeSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/savings/admin/fees/summary`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });

      if (!res.ok) {
        console.warn(
          `Fee summary endpoint returned ${res.status}, skipping...`
        );
        return;
      }

      const data = await res.json();
      if (data.success) {
        setFeeSummary(data.data);
      }
    } catch (e) {
      console.error("Could not fetch fee summary", e);
      // Gracefully handle if the fee system isn't set up yet
    }
  };

  // Fetch all data silently in parallel
  const fetchAllData = async () => {
    // Fetch all in parallel for better performance
    await Promise.all([
      fetchPayments(),
      fetchDisbursements(),
      fetchLoans(),
      fetchCurrentCycle(),
      fetchCycleStats(),
      fetchSavings(),
      fetchPendingWithdrawals(),
      fetchFeeSummary(),
      fetchPendingWithdrawals(),
    ]);

    // Refresh members silently
    if (typeof refreshMembers === "function") {
      await refreshMembers();
    }
  };

  // Load contribution amount from members
  useEffect(() => {
    if (safeMembers.length > 0 && safeMembers[0].monthly_contribution) {
      setContributionAmount(safeMembers[0].monthly_contribution);
    }
  }, [safeMembers]);

  useEffect(() => {
    // Initial silent fetch
    fetchAllData();

    // Silent background polling every 20 seconds
    pollRef.current = setInterval(() => {
      // Silent refresh - no loading indicators
      fetchAllData();
    }, 20000);

    // Socket.IO real-time event listeners
    const socket = (window as any).socket;
    if (socket) {
      console.log("👂 Admin Dashboard listening for real-time updates");

      // Listen for payment completion
      socket.on("paymentCompleted", (data: any) => {
        console.log("💰 Payment completed:", data);
        toast({
          title: "Payment Received!",
          description: `Payment of KES ${data.amount} received from member`,
        });
        fetchAllData(); // Refresh data
      });

      // Listen for member updates
      socket.on("memberUpdated", (data: any) => {
        console.log("� Member updated:", data);
        fetchAllData(); // Refresh data
      });

      // Listen for cycle updates
      socket.on("cycleUpdated", (data: any) => {
        console.log("🔄 Cycle updated:", data);
        fetchAllData(); // Refresh data
      });

      // Listen for payment failures
      socket.on("paymentFailed", (data: any) => {
        console.log("❌ Payment failed:", data);
        toast({
          title: "Payment Failed",
          description: `Payment from member failed: ${data.reason}`,
          variant: "destructive",
        });
      });

      // Listen for disbursement completion
      socket.on("disbursementCompleted", (data: any) => {
        console.log("💸 Disbursement completed:", data);
        toast({
          title: "Disbursement Successful!",
          description: `KES ${data.amount} sent to ${data.memberName}`,
        });
        fetchAllData(); // Refresh data
      });

      // Listen for next recipient updates
      socket.on("nextRecipientUpdated", (data: any) => {
        console.log("➡️ Next recipient updated:", data);
        toast({
          title: "Next Recipient Updated",
          description: `${
            data.previousRecipient.name
          } received payment. Next: ${
            data.nextRecipient?.name || "All members paid"
          }`,
        });
        fetchAllData(); // Refresh data
      });

      // Listen for loan status updates (including repayments)
      socket.on("loanStatusUpdated", (data: any) => {
        console.log("💰 Loan status updated:", data);
        const statusMessages: Record<string, string> = {
          approved: `Loan of KES ${data.amount.toLocaleString()} approved for ${
            data.memberName
          }`,
          rejected: `Loan request from ${data.memberName} was rejected`,
          disbursed: `Loan of KES ${data.amount.toLocaleString()} disbursed to ${
            data.memberName
          }`,
          repaid: `${
            data.memberName
          } has repaid their loan of KES ${data.amount.toLocaleString()}`,
        };

        toast({
          title: `Loan ${
            data.status.charAt(0).toUpperCase() + data.status.slice(1)
          }`,
          description:
            statusMessages[data.status] ||
            `Loan status updated to ${data.status}`,
        });
        fetchAllData(); // Refresh all data including loans
      });
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);

      // Cleanup Socket.IO listeners
      if (socket) {
        socket.off("paymentCompleted");
        socket.off("disbursementCompleted");
        socket.off("memberUpdated");
        socket.off("cycleUpdated");
        socket.off("paymentFailed");
        socket.off("nextRecipientUpdated");
        socket.off("loanStatusUpdated");
      }
    };
  }, []);

  const handleSendReminders = async () => {
    const pendingCount = pendingMembers.length;

    if (pendingCount === 0) {
      toast({
        title: "All Paid",
        description: "All members have already paid for this cycle!",
      });
      return;
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (currentCycle?.start_date) {
      const startDate = new Date(currentCycle.start_date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5); // 5-day cycle
      const today = new Date();
      daysRemaining = Math.max(
        0,
        Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      );
    }

    // Generate WhatsApp message
    const cycleNumber = currentCycle?.cycle_number || 1;
    const unpaidList = pendingMembers
      .map((m: any, index: number) => `${index + 1}. ${m.name}`)
      .join("\n");

    // Group message for SMART MOVES CASH FLOW WhatsApp group
    const groupMessage = `🔔 *SMCF Payment Reminder - Cycle #${cycleNumber}* 🔔

⏰ *${daysRemaining} ${
      daysRemaining === 1 ? "day" : "days"
    } remaining* to send your contribution!

💰 *Amount Due:* KES ${contributionAmount}

📋 *Members who haven't paid yet:*
${unpaidList}

⚠️ Please send your contribution before the deadline to avoid penalties.

Thank you for your cooperation! 🙏`;

    // Individual DM message
    const individualMessage = (
      memberName: string
    ) => `🔔 *SMCF Payment Reminder - Cycle #${cycleNumber}* 🔔

Hi ${memberName},

⏰ You have *${daysRemaining} ${
      daysRemaining === 1 ? "day" : "days"
    } remaining* to send your contribution!

💰 *Amount Due:* KES ${contributionAmount}

⚠️ Please send your contribution before the deadline to avoid penalties.

Thank you for your cooperation! 🙏`;

    // Open group message first
    const groupNumber = "254759097157";
    const encodedGroupMessage = encodeURIComponent(groupMessage);
    const groupWhatsappUrl = `https://wa.me/${groupNumber}?text=${encodedGroupMessage}`;
    window.open(groupWhatsappUrl, "_blank");

    // Open individual DMs with a slight delay between each
    pendingMembers.forEach((member: any, index: number) => {
      if (member.phone) {
        // Clean phone number (remove spaces, dashes, etc.)
        let cleanPhone = member.phone.replace(/[\s\-\(\)]/g, "");

        // Add country code if not present
        if (!cleanPhone.startsWith("254") && !cleanPhone.startsWith("+254")) {
          // Remove leading 0 if present
          if (cleanPhone.startsWith("0")) {
            cleanPhone = "254" + cleanPhone.substring(1);
          } else {
            cleanPhone = "254" + cleanPhone;
          }
        }

        // Remove + if present
        cleanPhone = cleanPhone.replace("+", "");

        const personalMessage = individualMessage(member.name);
        const encodedPersonalMessage = encodeURIComponent(personalMessage);
        const personalWhatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedPersonalMessage}`;

        // Delay each window opening by 2 seconds to avoid browser blocking
        setTimeout(() => {
          window.open(personalWhatsappUrl, "_blank");
        }, (index + 1) * 2000);
      }
    });

    toast({
      title: "Opening WhatsApp",
      description: `Opening ${
        pendingCount + 1
      } WhatsApp tabs (1 group + ${pendingCount} personal DMs). Please allow pop-ups if blocked.`,
      duration: 5000,
    });
  };

  const handleProcessPayout = async () => {
    if (!currentCycle) {
      toast({
        title: "Error",
        description: "No active cycle found",
        variant: "destructive",
      });
      return;
    }

    const totalMembers = safeMembers.length;
    const paidCount = paidMembers.length;

    if (paidCount < totalMembers) {
      toast({
        title: "Cannot Process Payout",
        description: `Only ${paidCount}/${totalMembers} members have paid. All members must pay before disbursement.`,
        variant: "destructive",
      });
      return;
    }

    // Find next recipient (first pending member in order)
    const nextRecipient = orderedMembers.find(
      (m: any) =>
        !m.last_payout_date ||
        m.position === currentCycle.next_recipient_position
    );

    if (!nextRecipient) {
      toast({
        title: "Error",
        description: "Could not determine next recipient",
        variant: "destructive",
      });
      return;
    }

    setShowDisbursementDialog(true);
  };

  const handleExportData = () => {
    // Generate CSV export of all data
    const csvData = [
      [
        "Member ID",
        "Name",
        "Phone",
        "Status",
        "Total Contributed",
        "Total Received",
      ],
      ...orderedMembers.map((m: any) => [
        m.member_id,
        m.name,
        m.phone,
        m.payment_status,
        m.total_contributed || 0,
        m.total_received || 0,
      ]),
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smcf-members-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Financial records have been downloaded",
    });
  };

  const handleAddMember = (newMember: any) => {
    // prefer to refresh from server when possible
    if (typeof refreshMembers === "function") {
      refreshMembers();
    } else {
      // mutate original array if provided, otherwise just push into safeMembers
      if (Array.isArray(members)) {
        members.push(newMember);
      } else {
        safeMembers.push(newMember);
      }
    }
    toast({
      title: "Member Added",
      description: "New member has been added successfully",
    });
  };

  const handleEditMember = (memberId: string) => {
    const member = members.find((m: any) => (m._id || m.id) === memberId);
    if (member) {
      setEditingMember(memberId);
      setEditedMemberData({ ...member });
    }
  };

  const handleSaveMember = async (memberId: string) => {
    try {
      const id = memberId;

      // Prepare payload, only include password if it's not empty
      const payload: any = {
        name: editedMemberData.name,
        phone: editedMemberData.phone,
        monthly_contribution:
          Number(editedMemberData.monthly_contribution) || 0,
      };

      // Only include password if it's been changed (not empty)
      if (
        editedMemberData.password &&
        editedMemberData.password.trim() !== ""
      ) {
        payload.password = editedMemberData.password;
      }

      const res = await fetch(`${API_BASE}/api/members/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update member");

      const updated = await res.json();

      // Clear editing state immediately for smooth UX
      setEditingMember(null);
      setEditedMemberData({});

      // Silent background refresh
      if (typeof refreshMembers === "function") {
        await refreshMembers();
      }

      // Show success notification after refresh completes
      toast({
        title: "Member Updated",
        description: "Member information has been updated successfully",
      });
    } catch (err) {
      console.error("Save failed", err);
      toast({
        title: "Save Failed",
        description: "Could not save member",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMember = (memberId: string) => {
    const index = members.findIndex((m) => m.id === memberId);
    if (index !== -1) {
      members.splice(index, 1);
    }
    toast({
      title: "Member Removed",
      description: "Member has been removed from the group",
    });
  };

  const handleTogglePaymentStatus = (memberId: string) => {
    // kept for backward compatibility, but prefer togglePaymentStatusRemote
    const member = members.find((m) => m.id === memberId);
    if (member) {
      const newStatus = member.status === "paid" ? "pending" : "paid";
      member.status = newStatus;
      toast({
        title: "Payment Status Updated",
        description: `${member.name}'s payment status changed to ${newStatus}`,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setEditedMemberData({});
  };

  const deleteMemberRemote = async (member: any) => {
    if (
      !confirm(
        `Are you sure you want to delete ${member.name}? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const id = member._id || member.id;
      const res = await fetch(`${API_BASE}/api/members/${id}`, {
        method: "DELETE",
        headers: {
          ...authService.getAuthHeaders(),
        },
      });

      if (!res.ok) throw new Error("Failed to delete member");

      // Silent background refresh
      if (typeof refreshMembers === "function") {
        await refreshMembers();
      }

      // Show success notification after refresh
      toast({
        title: "Member Deleted",
        description: `${member.name} has been removed from the group`,
      });
    } catch (err) {
      console.error("Delete failed", err);
      toast({
        title: "Delete Failed",
        description: "Could not delete member",
        variant: "destructive",
      });
    }
  };

  const togglePaymentStatusRemote = async (member: any) => {
    try {
      const id = member._id || member.id;
      const newStatus = member.payment_status === "paid" ? "pending" : "paid";

      if (newStatus === "paid") {
        // When marking as paid, create a proper payment record
        const paymentRes = await fetch(`${API_BASE}/api/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            member_id: id,
            amount: contributionAmount,
            phone: member.phone,
            mpesa_transaction_id: `ADMIN-${Date.now()}`,
            payment_method: "admin_manual",
            cycle_number: currentCycle?.cycle_number || 1,
          }),
        });

        if (!paymentRes.ok) {
          const error = await paymentRes.json();
          throw new Error(error.error || "Failed to record payment");
        }

        const paymentData = await paymentRes.json();

        toast({
          title: "Payment Recorded",
          description: `KES ${contributionAmount} contribution recorded for ${member.name}. Member status updated to PAID.`,
        });
      } else {
        // When marking as pending, just update the member status
        const res = await fetch(`${API_BASE}/api/members/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            payment_status: newStatus,
            payment_date: null,
            amount: 0,
          }),
        });

        if (!res.ok) throw new Error("Failed to update status");

        toast({
          title: "Status Changed",
          description: `${member.name}'s payment status changed to ${newStatus}`,
        });
      }

      // Refresh all data to reflect changes across the system
      if (typeof refreshMembers === "function") {
        await refreshMembers();
      }

      // Refresh cycle data
      await fetchCurrentCycle();

      // Refresh payments data
      await fetchPayments();
    } catch (err: any) {
      console.error("Update failed", err);
      toast({
        title: "Update Failed",
        description: err.message || "Could not update payment status",
        variant: "destructive",
      });
    }
  };

  const moveMemberUp = async (member: any) => {
    const sorted = [...orderedMembers];
    const idx = sorted.findIndex(
      (m: any) => (m._id || m.id) === (member._id || member.id)
    );
    if (idx > 0) {
      try {
        const above = sorted[idx - 1];
        const payload = [
          { id: above._id || above.id, position: member.position || idx + 1 },
          { id: member._id || member.id, position: above.position || idx },
        ];
        const res = await fetch(`${API_BASE}/api/members/reorder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to reorder");

        // Silent background refresh
        if (typeof refreshMembers === "function") {
          await refreshMembers();
        }

        // Show notification after refresh
        toast({
          title: "Order Updated",
          description: `${member.name} moved up in the queue`,
        });
      } catch (err) {
        console.error("Reorder failed", err);
        toast({
          title: "Reorder Failed",
          description: "Could not change order",
          variant: "destructive",
        });
      }
    }
  };

  const moveMemberDown = async (member: any) => {
    const sorted = [...orderedMembers];
    const idx = sorted.findIndex(
      (m: any) => (m._id || m.id) === (member._id || member.id)
    );
    if (idx !== -1 && idx < sorted.length - 1) {
      try {
        const below = sorted[idx + 1];
        const payload = [
          { id: below._id || below.id, position: member.position || idx + 1 },
          { id: member._id || member.id, position: below.position || idx + 2 },
        ];
        const res = await fetch(`${API_BASE}/api/members/reorder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to reorder");

        // Silent background refresh
        if (typeof refreshMembers === "function") {
          await refreshMembers();
        }

        // Show notification after refresh
        toast({
          title: "Order Updated",
          description: `${member.name} moved down in the queue`,
        });
      } catch (err) {
        console.error("Reorder failed", err);
        toast({
          title: "Reorder Failed",
          description: "Could not change order",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-0">
      {/* Header with Profile and Logout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {userData?.name || "Admin"}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ThemeToggle />
          <Button
            variant="outline"
            onClick={() => setShowProfileDialog(true)}
            className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm"
            size="sm">
            <User className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Profile</span>
            <span className="sm:hidden">Profile</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setNewContributionAmount(contributionAmount.toString());
              setShowSettingsDialog(true);
            }}
            className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm"
            size="sm">
            <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sm:hidden">Settings</span>
          </Button>
          <Button
            variant="destructive"
            onClick={onLogout}
            className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm"
            size="sm">
            <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Logout</span>
          </Button>
        </div>
      </div>

      {/* System Overview Dashboard */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-6 h-6 text-primary" />
            System Overview Dashboard
          </CardTitle>
          <CardDescription>
            Real-time summary of all system metrics - Cycle #
            {currentCycle?.cycle_number || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Members */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Total Members
                    </p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                      {safeMembers.length}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Active participants
                    </p>
                  </div>
                  <User className="w-12 h-12 text-blue-300 dark:text-blue-700" />
                </div>
              </CardContent>
            </Card>

            {/* Payment Progress */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Payments This Cycle
                    </p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                      {paidMembers.length}/{safeMembers.length}
                    </p>
                    <div className="mt-2">
                      <Progress
                        value={
                          safeMembers.length > 0
                            ? (paidMembers.length / safeMembers.length) * 100
                            : 0
                        }
                        className="h-2"
                      />
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        {safeMembers.length > 0
                          ? Math.round(
                              (paidMembers.length / safeMembers.length) * 100
                            )
                          : 0}
                        % complete
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="w-12 h-12 text-green-300 dark:text-green-700" />
                </div>
              </CardContent>
            </Card>

            {/* Total Collected */}
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      Collected Amount
                    </p>
                    <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                      {totalCollected.toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      of{" "}
                      {(
                        safeMembers.length * contributionAmount
                      ).toLocaleString()}{" "}
                      KES
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-emerald-300 dark:text-emerald-700" />
                </div>
              </CardContent>
            </Card>

            {/* Pending Payments */}
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Pending Members
                    </p>
                    <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                      {pendingMembers.length}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {pendingMembers.length > 0 ? "Need to pay" : "All paid!"}
                    </p>
                  </div>
                  <AlertTriangle className="w-12 h-12 text-amber-300 dark:text-amber-700" />
                </div>
              </CardContent>
            </Card>

            {/* Active Loans */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      Active Loans
                    </p>
                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                      {
                        loans.filter((l: any) =>
                          ["approved", "disbursed"].includes(l.status)
                        ).length
                      }
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Total: KES{" "}
                      {loans
                        .filter((l: any) =>
                          ["approved", "disbursed"].includes(l.status)
                        )
                        .reduce(
                          (sum: number, l: any) => sum + (l.amount || 0),
                          0
                        )
                        .toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-purple-300 dark:text-purple-700" />
                </div>
              </CardContent>
            </Card>

            {/* Pending Loan Requests */}
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                      Pending Loans
                    </p>
                    <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                      {loans.filter((l: any) => l.status === "pending").length}
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Awaiting approval
                    </p>
                  </div>
                  <AlertTriangle className="w-12 h-12 text-orange-300 dark:text-orange-700" />
                </div>
              </CardContent>
            </Card>

            {/* Total Disbursements */}
            <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                      Total Disbursed
                    </p>
                    <p className="text-3xl font-bold text-cyan-900 dark:text-cyan-100">
                      {
                        disbursements.filter(
                          (d: any) => d.status === "completed"
                        ).length
                      }
                    </p>
                    <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-1">
                      KES{" "}
                      {disbursements
                        .filter((d: any) => d.status === "completed")
                        .reduce(
                          (sum: number, d: any) => sum + (d.amount || 0),
                          0
                        )
                        .toLocaleString()}
                    </p>
                  </div>
                  <Wallet className="w-12 h-12 text-cyan-300 dark:text-cyan-700" />
                </div>
              </CardContent>
            </Card>

            {/* Cycle Progress */}
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      Days Remaining
                    </p>
                    <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">
                      {currentCycle?.days_left || 0}
                    </p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                      Cycle #{currentCycle?.cycle_number || 1}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-indigo-300 dark:text-indigo-700" />
                </div>
              </CardContent>
            </Card>

            {/* Transaction Fees Collected */}
            <Card className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 border-teal-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-teal-600 dark:text-teal-400">
                      Transaction Fees
                    </p>
                    <p className="text-3xl font-bold text-teal-900 dark:text-teal-100">
                      KES {feeSummary?.totalCollected?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">
                      {feeSummary?.totalTransactions || 0} fee transactions
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-teal-300 dark:text-teal-700" />
                </div>
              </CardContent>
            </Card>

            {/* Available Funds (Total Interest + Wallet Balance) */}
            <Card className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900 border-rose-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                      Available Funds
                    </p>
                    <p className="text-3xl font-bold text-rose-900 dark:text-rose-100">
                      KES{" "}
                      {(
                        (savingsData.reduce(
                          (sum, m) => sum + (m.totalInterestEarned || 0),
                          0
                        ) || 0) +
                        (savingsData.reduce(
                          (sum, m) => sum + (m.currentBalance || 0),
                          0
                        ) || 0)
                      ).toLocaleString()}
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                      Interest: KES{" "}
                      {savingsData
                        .reduce((sum, m) => sum + (m.totalInterestEarned || 0), 0)
                        .toLocaleString()}{" "}
                      | Wallet: KES{" "}
                      {savingsData
                        .reduce((sum, m) => sum + (m.currentBalance || 0), 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  <Wallet className="w-12 h-12 text-rose-300 dark:text-rose-700" />
                </div>
              </CardContent>
            </Card>

            {/* Organization Profit (Transaction Fees + Loan Interest) */}
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      Organization Profit
                    </p>
                    <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                      KES{" "}
                      {(
                        (feeSummary?.totalCollected || 0) +
                        (loans
                          .filter((l: any) => l.status === "repaid")
                          .reduce(
                            (sum: number, l: any) =>
                              sum + ((l.total_repayable || 0) - (l.amount || 0)),
                            0
                          ) || 0)
                      ).toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      Fees: KES {(feeSummary?.totalCollected || 0).toLocaleString()}{" "}
                      | Loan Interest: KES{" "}
                      {loans
                        .filter((l: any) => l.status === "repaid")
                        .reduce(
                          (sum: number, l: any) =>
                            sum + ((l.total_repayable || 0) - (l.amount || 0)),
                          0
                        )
                        .toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-emerald-300 dark:text-emerald-700" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats Bar */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Collection Rate</p>
                <p className="text-lg font-bold text-primary">
                  {safeMembers.length > 0
                    ? Math.round(
                        (paidMembers.length / safeMembers.length) * 100
                      )
                    : 0}
                  %
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expected Total</p>
                <p className="text-lg font-bold text-financial-success">
                  KES{" "}
                  {(safeMembers.length * contributionAmount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recent Payments</p>
                <p className="text-lg font-bold text-blue-600">
                  {recentPayments.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fees Collected</p>
                <p className="text-lg font-bold text-teal-600">
                  KES {feeSummary?.totalCollected?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Total Announcements
                </p>
                <p className="text-lg font-bold text-purple-600">
                  {announcements?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Savings Dashboard */}
      <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Wallet className="w-6 h-6 text-emerald-600" />
            Savings Dashboard
          </CardTitle>
          <CardDescription>
            Complete overview of member savings and wallet balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Savings */}
            <Card className="bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800 border-emerald-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Total Savings
                    </p>
                    <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                      {savingsData
                        .reduce((sum, m) => sum + (m.totalDeposits || 0), 0)
                        .toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      KES - All deposits
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-emerald-400 dark:text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            {/* Total Wallets Balance */}
            <Card className="bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900 dark:to-teal-800 border-teal-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
                      Wallet Balances
                    </p>
                    <p className="text-3xl font-bold text-teal-900 dark:text-teal-100">
                      {safeMembers
                        .reduce((sum, m) => sum + (m.wallet_balance || 0), 0)
                        .toLocaleString()}
                    </p>
                    <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">
                      KES - Available funds
                    </p>
                  </div>
                  <Wallet className="w-12 h-12 text-teal-400 dark:text-teal-600" />
                </div>
              </CardContent>
            </Card>

            {/* Active Savers */}
            <Card className="bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 border-green-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      Active Savers
                    </p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                      {
                        savingsData.filter((m) => (m.totalDeposits || 0) > 0)
                          .length
                      }
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      of {safeMembers.length} members
                    </p>
                  </div>
                  <User className="w-12 h-12 text-green-400 dark:text-green-600" />
                </div>
              </CardContent>
            </Card>

            {/* Top Saver */}
            <Card className="bg-gradient-to-br from-yellow-100 to-amber-200 dark:from-yellow-900 dark:to-amber-800 border-yellow-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      Top Saver
                    </p>
                    <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100 truncate">
                      {savingsData.length > 0
                        ? savingsData.reduce(
                            (top, m) =>
                              (m.totalDeposits || 0) > (top.totalDeposits || 0)
                                ? m
                                : top,
                            savingsData[0]
                          ).name || "N/A"
                        : "N/A"}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      KES{" "}
                      {savingsData.length > 0
                        ? (
                            savingsData.reduce(
                              (top, m) =>
                                (m.totalDeposits || 0) >
                                (top.totalDeposits || 0)
                                  ? m
                                  : top,
                              savingsData[0]
                            ).totalDeposits || 0
                          ).toLocaleString()
                        : "0"}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-yellow-400 dark:text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            {/* Pending Withdrawals */}
            <Card className="bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 border-orange-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      Pending Withdrawals
                    </p>
                    <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                      {pendingWithdrawals.length}
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      KES{" "}
                      {pendingWithdrawals
                        .reduce((sum, w) => sum + (w.amount || 0), 0)
                        .toLocaleString()}
                    </p>
                  </div>
                  <AlertCircle className="w-12 h-12 text-orange-400 dark:text-orange-600" />
                </div>
              </CardContent>
            </Card>

            {/* Total Interest Earned */}
            <Card className="bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 border-purple-300">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Total Interest
                    </p>
                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                      {savingsData
                        .reduce(
                          (sum, m) => sum + (m.totalInterestEarned || 0),
                          0
                        )
                        .toLocaleString()}
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      KES - All members
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-purple-400 dark:text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Savings Statistics Bar */}
          <div className="mt-6 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Average Savings</p>
                <p className="text-lg font-bold text-emerald-600">
                  KES{" "}
                  {savingsData.length > 0
                    ? Math.round(
                        savingsData.reduce(
                          (sum, m) => sum + (m.totalDeposits || 0),
                          0
                        ) / savingsData.length
                      ).toLocaleString()
                    : "0"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Participation</p>
                <p className="text-lg font-bold text-teal-600">
                  {safeMembers.length > 0
                    ? Math.round(
                        (savingsData.filter((m) => (m.totalDeposits || 0) > 0)
                          .length /
                          safeMembers.length) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Total Withdrawals
                </p>
                <p className="text-lg font-bold text-orange-600">
                  KES{" "}
                  {savingsData
                    .reduce((sum, m) => sum + (m.totalWithdrawals || 0), 0)
                    .toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interest Earned</p>
                <p className="text-lg font-bold text-purple-600">
                  KES{" "}
                  {savingsData
                    .reduce((sum, m) => sum + (m.totalInterestEarned || 0), 0)
                    .toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Combined Total</p>
                <p className="text-lg font-bold text-emerald-700">
                  KES{" "}
                  {(
                    savingsData.reduce(
                      (sum, m) => sum + (m.totalDeposits || 0),
                      0
                    ) +
                    safeMembers.reduce(
                      (sum, m) => sum + (m.wallet_balance || 0),
                      0
                    )
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Top Savers List */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              Top 5 Savers
            </h4>
            <div className="space-y-2">
              {savingsData
                .sort((a, b) => (b.totalDeposits || 0) - (a.totalDeposits || 0))
                .slice(0, 5)
                .map((member, index) => (
                  <div
                    key={member._id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-100 dark:border-emerald-900">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? "bg-yellow-400 text-yellow-900"
                            : index === 1
                            ? "bg-gray-300 text-gray-700"
                            : index === 2
                            ? "bg-amber-600 text-amber-100"
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.member_id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">
                        KES {(member.totalDeposits || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.transactionCount || 0} transactions
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Recipient Card */}
      {currentCycle?.next_recipient && (
        <Card className="border-l-4 border-l-financial-success bg-financial-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-financial-success" />
              Next in Line for Disbursement
            </CardTitle>
            <CardDescription>
              Cycle #{currentCycle.cycle_number} - Ready for payout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-financial-success/20">
              <div>
                <p className="text-lg font-semibold">
                  {currentCycle.next_recipient.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Member ID: {currentCycle.next_recipient.member_id}
                </p>
                <p className="text-sm text-muted-foreground">
                  Phone: {currentCycle.next_recipient.phone}
                </p>
              </div>
              <Button
                onClick={async () => {
                  try {
                    const recipientId =
                      currentCycle.next_recipient?._id ||
                      currentCycle.recipient_id?._id ||
                      currentCycle.recipient_id;
                    const recipientPhone = currentCycle.next_recipient?.phone;
                    const cycleId = currentCycle._id || currentCycle.id;
                    const disbursementAmount =
                      safeMembers.length * contributionAmount;

                    if (!recipientId || !cycleId || !recipientPhone) {
                      throw new Error("Missing recipient information");
                    }

                    const response = await fetch(
                      `${API_BASE}/api/disbursements`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...authService.getAuthHeaders(),
                        },
                        body: JSON.stringify({
                          cycle_id: cycleId,
                          recipient_id: recipientId,
                          phone: recipientPhone,
                          amount: disbursementAmount,
                          method: "manual",
                          status: "completed",
                        }),
                      }
                    );

                    const data = await response.json();

                    if (response.ok && data.success) {
                      toast({
                        title: "Disbursement Recorded",
                        description: `KES ${disbursementAmount.toLocaleString()} marked as disbursed to ${
                          currentCycle.next_recipient?.name || "recipient"
                        }`,
                      });
                      fetchDisbursements();
                      fetchCurrentCycle();
                      fetchAllData();
                    } else {
                      throw new Error(
                        data.error || "Failed to record disbursement"
                      );
                    }
                  } catch (error: any) {
                    console.error("Disbursement error:", error);
                    toast({
                      title: "Error",
                      description:
                        error.message || "Failed to record disbursement",
                      variant: "destructive",
                    });
                  }
                }}
                variant="financial"
                size="lg">
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Disbursed
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Actions */}
      <Card className="border-l-4 border-l-accent bg-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSendReminders} variant="outline" size="sm">
              <Send className="w-4 h-4 mr-2" />
              Send Reminders
            </Button>
            <Button
              onClick={handleProcessPayout}
              variant={
                userData.cycleData.paidMembers ===
                userData.cycleData.totalMembers
                  ? "financial"
                  : "outline"
              }
              size="sm"
              disabled={
                userData.cycleData.paidMembers < userData.cycleData.totalMembers
              }>
              <DollarSign className="w-4 h-4 mr-2" />
              Process Payout
            </Button>
            <Button onClick={handleExportData} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Records
            </Button>
            <Button
              onClick={() => setShowAddMemberDialog(true)}
              variant="outline"
              size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
            <Button
              onClick={() => setShowAnnouncementDialog(true)}
              variant="secondary"
              size="sm">
              <Megaphone className="w-4 h-4 mr-2" />
              Send Announcement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="members" className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-9 min-w-max">
            <TabsTrigger
              value="members"
              className="text-xs sm:text-sm whitespace-nowrap">
              <span className="hidden sm:inline">Member Management</span>
              <span className="sm:hidden">Members</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="text-xs sm:text-sm whitespace-nowrap">
              <span className="hidden sm:inline">Payment Tracking</span>
              <span className="sm:hidden">Payments</span>
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="text-xs sm:text-sm whitespace-nowrap">
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="savings"
              className="text-xs sm:text-sm whitespace-nowrap relative">
              Savings
              {pendingWithdrawals.length > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                  {pendingWithdrawals.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="disbursements"
              className="text-xs sm:text-sm whitespace-nowrap">
              Disbursements
            </TabsTrigger>
            <TabsTrigger
              value="loans"
              className="text-xs sm:text-sm whitespace-nowrap relative">
              Loans
              {loans.filter((l: any) => l.status === "pending").length > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                  {loans.filter((l: any) => l.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="approvals"
              className="text-xs sm:text-sm whitespace-nowrap relative">
              Approvals
              {pendingWithdrawals.length +
                loans.filter((l: any) => l.status === "pending").length >
                0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                  {pendingWithdrawals.length +
                    loans.filter((l: any) => l.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="fees"
              className="text-xs sm:text-sm whitespace-nowrap">
              Fees
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="text-xs sm:text-sm whitespace-nowrap">
              Reports
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="members" className="space-y-6">
          {/* Cycle Overview */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Current Cycle #
                {currentCycle?.cycle_number ||
                  currentCycle?.data?.cycle_number ||
                  userData?.cycleData?.currentCycle ||
                  "—"}
              </CardTitle>
              <CardDescription>
                Started:{" "}
                {currentCycle?.start_date
                  ? new Date(currentCycle.start_date).toLocaleDateString()
                  : currentCycle?.data?.start_date
                  ? new Date(currentCycle.data.start_date).toLocaleDateString()
                  : userData?.cycleData?.cycleStartDate || "Not Started"}{" "}
                | Status:{" "}
                {currentCycle?.status ||
                  currentCycle?.data?.status ||
                  "Inactive"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Collection Progress
                  </div>
                  <div className="text-2xl font-bold">
                    {paidMembers.length}/{safeMembers.length}
                  </div>
                  <Progress
                    value={
                      safeMembers.length > 0
                        ? (paidMembers.length / safeMembers.length) * 100
                        : 0
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Amount Collected
                  </div>
                  <div className="text-2xl font-bold text-financial-success">
                    KES {totalCollected.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Target Amount
                  </div>
                  <div className="text-2xl font-bold">
                    KES{" "}
                    {(
                      (safeMembers.length || 14) * contributionAmount
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Disbursement
                  </div>
                  <div className="text-xl font-bold">
                    {currentCycle?.disbursement_status ||
                      currentCycle?.data?.disbursement_status ||
                      "Pending"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Reset & Start Fresh */}
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1 text-red-700 dark:text-red-400">
                    Reset System & Start from Cycle #1
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Clear all payments, disbursements, and cycles. Start fresh
                    from Cycle #1 with Member #1
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "⚠️ WARNING: This will DELETE all payments, disbursements, and cycles. Are you sure?"
                      )
                    ) {
                      return;
                    }
                    try {
                      // Delete all payments
                      await fetch(`${API_BASE}/api/payments`, {
                        method: "DELETE",
                        headers: { ...authService.getAuthHeaders() },
                      });

                      // Delete all disbursements
                      await fetch(`${API_BASE}/api/disbursements`, {
                        method: "DELETE",
                        headers: { ...authService.getAuthHeaders() },
                      });

                      // Delete all cycles
                      await fetch(`${API_BASE}/api/cycles`, {
                        method: "DELETE",
                        headers: { ...authService.getAuthHeaders() },
                      });

                      // Reset all members' payment status
                      const members = await fetch(`${API_BASE}/api/members`, {
                        headers: { ...authService.getAuthHeaders() },
                      }).then((r) => r.json());

                      for (const member of members) {
                        await fetch(`${API_BASE}/api/members/${member._id}`, {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            ...authService.getAuthHeaders(),
                          },
                          body: JSON.stringify({
                            payment_status: "pending",
                            total_contributed: 0,
                            total_received: 0,
                          }),
                        });
                      }

                      // Start fresh cycle #1 with first member
                      const firstMember = members.sort(
                        (a, b) => a.position - b.position
                      )[0];
                      await fetch(`${API_BASE}/api/cycles/start`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...authService.getAuthHeaders(),
                        },
                        body: JSON.stringify({
                          recipient_id: firstMember._id,
                        }),
                      });

                      toast({
                        title: "System Reset Complete",
                        description:
                          "All data cleared. Starting fresh from Cycle #1",
                      });

                      // Refresh all data
                      setTimeout(() => {
                        window.location.reload();
                      }, 1500);
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to reset system",
                        variant: "destructive",
                      });
                    }
                  }}
                  size="lg"
                  variant="destructive">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Reset & Start Fresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Member Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-financial-success" />
                  Paid Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-financial-success mb-2">
                  {paidMembers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  KES {totalCollected.toLocaleString()} collected
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-financial-warning" />
                  Pending Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-financial-warning mb-2">
                  {pendingMembers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  KES{" "}
                  {(
                    pendingMembers.length * contributionAmount
                  ).toLocaleString()}{" "}
                  outstanding
                </div>
              </CardContent>
            </Card>

            {/* Online Members Card */}
            <OnlineMembersCard currentUser={userData} />
          </div>

          {/* Member List */}
          <Card>
            <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>
                Total: {safeMembers.length} members | Payment Breakdown: KES 200 (Cycle) + KES 20 (Credit) + KES 4 (Transaction Fee) = KES 224
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cycle Contribution</TableHead>
                      <TableHead className="text-right">Member Credit</TableHead>
                      <TableHead className="text-right">Transaction Fees</TableHead>
                      <TableHead className="text-right">Total Paid</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderedMembers.map((member, index) => (
                      <TableRow key={member._id || member.id || index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                member.payment_status === "paid"
                                  ? "bg-financial-success"
                                  : "bg-financial-warning"
                              }`}
                            />
                            <div>
                              <div className="font-medium">
                                {member.name}{" "}
                                {member.position ? `(#${member.position})` : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {member.member_id} • {member.phone}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              member.payment_status === "paid"
                                ? "default"
                                : "secondary"
                            }>
                            {member.payment_status === "paid"
                              ? "Paid"
                              : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-blue-600">
                          KES {(member.total_cycle_contribution || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          KES {(member.total_member_credit || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-orange-600">
                          KES {(member.total_transaction_fees || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          KES {(member.total_contributed || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveMemberUp(member)}
                              title="Move up">
                              ↑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveMemberDown(member)}
                              title="Move down">
                              ↓
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                member.payment_status === "paid"
                                  ? "outline"
                                  : "default"
                              }
                              onClick={() => togglePaymentStatusRemote(member)}>
                              {member.payment_status === "paid"
                                ? "Unpay"
                                : "Mark Paid"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMemberRemote(member)}
                              className="text-destructive hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell colSpan={2} className="text-right">
                        <span className="text-lg">GRAND TOTALS:</span>
                      </TableCell>
                      <TableCell className="text-right text-blue-600 text-lg">
                        KES {orderedMembers.reduce((sum, m) => sum + (m.total_cycle_contribution || 0), 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600 text-lg">
                        KES {orderedMembers.reduce((sum, m) => sum + (m.total_member_credit || 0), 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-orange-600 text-lg">
                        KES {orderedMembers.reduce((sum, m) => sum + (m.total_transaction_fees || 0), 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-lg">
                        KES {orderedMembers.reduce((sum, m) => sum + (m.total_contributed || 0), 0).toLocaleString()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Contribution Cycle Analytics */}
          <ContributionCycleChart
            payments={allPayments}
            totalMembers={safeMembers.length}
          />

          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Cycles Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentCycle?.cycle_number
                    ? currentCycle.cycle_number - 1
                    : 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Current cycle: #{currentCycle?.cycle_number || 1}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average Payment Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {safeMembers.length > 0
                    ? Math.round(
                        (paidMembers.length / safeMembers.length) * 100
                      )
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {paidMembers.length} of {safeMembers.length} members
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  KES {totalCollected.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all cycles
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          {/* Payment Progress */}
          {currentCycle && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Collection Progress - Cycle #{currentCycle.cycle_number}
                </CardTitle>
                <CardDescription>
                  Started:{" "}
                  {new Date(currentCycle.start_date).toLocaleDateString()} |
                  Status: {currentCycle.status}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Collection Progress</span>
                    <span>
                      {safeMembers.length > 0
                        ? Math.round(
                            (paidMembers.length / safeMembers.length) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      safeMembers.length > 0
                        ? (paidMembers.length / safeMembers.length) * 100
                        : 0
                    }
                    className="h-3"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {paidMembers.length}/{safeMembers.length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Members Paid
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-financial-success">
                      KES{" "}
                      {currentCycle.total_amount_collected?.toLocaleString() ||
                        0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Collected
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">
                      KES{" "}
                      {(
                        safeMembers.length * 204 -
                        (currentCycle.total_amount_collected || 0)
                      ).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Remaining
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Recent Payments</CardTitle>
                  <CardDescription>
                    Latest contributions for this cycle
                  </CardDescription>
                </div>
                <div>
                  <Button size="sm" variant="outline" onClick={fetchPayments}>
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentPayments.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No payments recorded yet
                  </div>
                )}
                {recentPayments.map((payment, index) => (
                  <div
                    key={payment._id || index}
                    className="flex items-center justify-between p-3 bg-financial-success/5 border border-financial-success/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div>
                        <div className="font-medium">
                          {payment.member_id?.name || payment.phone}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.mpesa_transaction_id || payment.phone} •
                          Cycle #{payment.cycle_number}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(payment.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-financial-success">
                        KES {payment.amount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="savings" className="space-y-6">
          <SavingsTab />
        </TabsContent>

        <TabsContent value="disbursements" className="space-y-6">
          {/* M-Pesa Send Payment Section */}
          <Card className="border-l-4 border-l-mpesa-green bg-mpesa-green/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-mpesa-green" />
                Send M-Pesa Payment
              </CardTitle>
              <CardDescription>
                Send money directly to members via M-Pesa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Send payments to any group member from your M-Pesa account
                  </p>
                </div>
                <Button
                  onClick={() => setShowDisbursementDialog(true)}
                  variant="mpesa"
                  size="sm">
                  <Wallet className="w-4 h-4 mr-2" />
                  Send Payment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Next Disbursement */}
          {currentCycle && (
            <Card className="border-l-4 border-l-accent bg-accent/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Next Disbursement - Cycle #{currentCycle.cycle_number}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recipient:</span>
                      <span className="font-semibold">
                        {currentCycle.recipient_id?.name || "TBD"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-semibold text-accent">
                        KES{" "}
                        {(
                          safeMembers.length * contributionAmount
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        variant={
                          currentCycle.disbursement_status === "completed"
                            ? "default"
                            : currentCycle.paid_members_count ===
                              safeMembers.length
                            ? "default"
                            : "secondary"
                        }>
                        {currentCycle.disbursement_status ||
                          (currentCycle.paid_members_count ===
                          safeMembers.length
                            ? "Ready"
                            : `Waiting (${currentCycle.paid_members_count}/${safeMembers.length})`)}
                      </Badge>
                    </div>
                  </div>

                  {/* Mark as Disbursed Button */}
                  {currentCycle.disbursement_status !== "completed" &&
                    currentCycle.recipient_id && (
                      <Button
                        onClick={async () => {
                          try {
                            const response = await fetch(
                              `${API_BASE}/api/disbursements`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...authService.getAuthHeaders(),
                                },
                                body: JSON.stringify({
                                  cycle_id: currentCycle._id,
                                  recipient_id:
                                    currentCycle.recipient_id._id ||
                                    currentCycle.recipient_id,
                                  amount: safeMembers.length * 204,
                                  method: "manual",
                                  status: "completed",
                                }),
                              }
                            );

                            const data = await response.json();

                            if (response.ok && data.success) {
                              toast({
                                title: "Disbursement Recorded",
                                description: `Successfully marked disbursement to ${currentCycle.recipient_id?.name} as completed`,
                              });
                              fetchDisbursements();
                              fetchCurrentCycle();

                              // Auto-generate receipt after marking as disbursed
                              setTimeout(() => {
                                const disbursementData = data.disbursement || {
                                  _id: data.id,
                                  recipient_id: currentCycle.recipient_id,
                                  cycle_id: currentCycle,
                                  amount: safeMembers.length * 204,
                                  method: "manual",
                                  status: "completed",
                                  disbursement_date: new Date().toISOString(),
                                };
                                generateDisbursementReceipt(disbursementData);
                              }, 1000);
                            } else {
                              throw new Error(
                                data.error || "Failed to record disbursement"
                              );
                            }
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description:
                                error.message ||
                                "Failed to record disbursement",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="w-full"
                        variant="default"
                        disabled={
                          currentCycle.paid_members_count !== safeMembers.length
                        }>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Disbursed
                      </Button>
                    )}

                  {currentCycle.disbursement_status === "completed" && (
                    <div className="flex items-center gap-2 text-financial-success text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Disbursement completed</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disbursement History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Disbursement History</CardTitle>
                  <CardDescription>Previous payouts to members</CardDescription>
                </div>
                <div className="flex gap-2">
                  {/* Quick Mark as Disbursed Button */}
                  {currentCycle &&
                    currentCycle.recipient_id &&
                    currentCycle.disbursement_status !== "completed" && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await fetch(
                              `${API_BASE}/api/disbursements`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...authService.getAuthHeaders(),
                                },
                                body: JSON.stringify({
                                  cycle_id: currentCycle._id,
                                  recipient_id:
                                    currentCycle.recipient_id._id ||
                                    currentCycle.recipient_id,
                                  amount: safeMembers.length * 204,
                                  method: "manual",
                                  status: "completed",
                                }),
                              }
                            );

                            const data = await response.json();

                            if (response.ok && data.success) {
                              toast({
                                title: "Disbursement Recorded",
                                description: `Successfully marked disbursement to ${currentCycle.recipient_id?.name} as completed`,
                              });
                              fetchDisbursements();
                              fetchCurrentCycle();
                            } else {
                              throw new Error(
                                data.error || "Failed to record disbursement"
                              );
                            }
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description:
                                error.message ||
                                "Failed to record disbursement",
                              variant: "destructive",
                            });
                          }
                        }}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Disbursed
                      </Button>
                    )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportDisbursementsCSV}
                    disabled={disbursements.length === 0}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={generateDisbursementsPDF}
                    disabled={disbursements.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchDisbursements}>
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {disbursements.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No disbursements yet
                  </div>
                )}
                {disbursements.map((disbursement, index) => (
                  <div
                    key={disbursement._id || index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {disbursement.recipient_id?.name || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Cycle #{disbursement.cycle_id?.cycle_number} •
                          {disbursement.mpesa_transaction_id ||
                            disbursement.phone ||
                            "Manual"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(
                            disbursement.disbursement_date
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold text-financial-success">
                          KES {disbursement.amount?.toLocaleString() || 0}
                        </div>
                        <Badge
                          variant={
                            disbursement.status === "completed"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs">
                          {disbursement.status}
                        </Badge>
                      </div>
                      {disbursement.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            generateDisbursementReceipt(disbursement)
                          }
                          title="Download Receipt">
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="loans" className="space-y-6">
          <LoansTab />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6">
          <ApprovalsTab />
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          <TransactionFeesReport />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <ReportsTab />
        </TabsContent>
      </Tabs>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Admin Profile Settings
            </DialogTitle>
            <DialogDescription>
              Manage your profile information and account security
            </DialogDescription>
          </DialogHeader>
          <ProfileSettings adminData={userData} />
        </DialogContent>
      </Dialog>

      {/* M-Pesa Disbursement Dialog */}
      <MpesaDisbursementDialog
        open={showDisbursementDialog}
        onOpenChange={setShowDisbursementDialog}
        members={safeMembers}
      />

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        onMemberAdded={handleAddMember}
      />

      {/* Announcement Dialog */}
      <AnnouncementDialog
        open={showAnnouncementDialog}
        onOpenChange={setShowAnnouncementDialog}
      />

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              System Settings
            </DialogTitle>
            <DialogDescription>
              Configure system-wide settings for SMCF
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Contribution Amount */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Current Monthly Contribution
              </div>
              <div className="text-3xl font-bold text-primary">
                KES {contributionAmount.toLocaleString()}
              </div>
            </div>

            {/* Update Contribution Amount */}
            <div className="space-y-3">
              <Label htmlFor="new-contribution">
                New Monthly Contribution Amount (KES)
              </Label>
              <Input
                id="new-contribution"
                type="number"
                placeholder="Enter new amount (e.g., 250)"
                value={newContributionAmount}
                onChange={(e) => setNewContributionAmount(e.target.value)}
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                This will update the contribution amount for all members and
                future cycles. Current payments will not be affected.
              </p>
            </div>

            {/* Impact Summary */}
            {newContributionAmount && Number(newContributionAmount) > 0 && (
              <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg space-y-2">
                <div className="text-sm font-medium">Impact Summary:</div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Members affected:
                    </span>
                    <span className="font-medium">{safeMembers.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      New cycle total:
                    </span>
                    <span className="font-medium">
                      KES{" "}
                      {(
                        safeMembers.length * Number(newContributionAmount)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Change:</span>
                    <span
                      className={`font-medium ${
                        Number(newContributionAmount) > contributionAmount
                          ? "text-red-600"
                          : "text-green-600"
                      }`}>
                      {Number(newContributionAmount) > contributionAmount
                        ? "+"
                        : ""}
                      KES{" "}
                      {(
                        Number(newContributionAmount) - contributionAmount
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowSettingsDialog(false);
                  setNewContributionAmount("");
                }}>
                Cancel
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={updateContributionAmount}
                disabled={
                  !newContributionAmount || Number(newContributionAmount) <= 0
                }>
                <Save className="w-4 h-4 mr-2" />
                Update Amount
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
