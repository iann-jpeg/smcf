import AddMemberDialog from "@/components/AddMemberDialog";
import AnnouncementDialog from "@/components/AnnouncementDialog";
import MpesaDisbursementDialog from "@/components/MpesaDisbursementDialog";
import SavingsTab from "@/components/admin/SavingsTab";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Download,
  Edit,
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
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editedMemberData, setEditedMemberData] = useState<any>({});

  // Real-time data states
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]); // Store ALL payments for calculation
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [currentCycle, setCurrentCycle] = useState<any>(null);
  const [cycleStats, setCycleStats] = useState<any>(null);

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
  
  // Calculate paid members from actual completed payments (more accurate than member status)
  const currentCycleNumber = currentCycle?.cycle_number;
  const completedPayments = Array.isArray(allPayments) 
    ? allPayments.filter((p: any) => 
        p.status === "completed" && 
        (!currentCycleNumber || p.cycle_number === currentCycleNumber)
      )
    : [];
  const uniquePaidMemberIds = new Set(
    completedPayments.map((p: any) => p.member_id?._id || p.member_id)
  );
  const paidMembersCount = uniquePaidMemberIds.size;
  
  // Also keep the old calculation for backward compatibility
  const paidMembers = orderedMembers.filter(
    (m: any) => m && m.payment_status === "paid"
  );
  const pendingMembers = orderedMembers.filter(
    (m: any) => m && m.payment_status === "pending"
  );
  
  console.log("💰 AdminDashboard payment calculation:", {
    totalMembers: safeMembers.length,
    paidMembersFromStatus: paidMembers.length,
    paidMembersFromPayments: paidMembersCount,
    completedPaymentsCount: completedPayments.length,
    currentCycleNumber,
  });

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
      const allPaymentsData = Array.isArray(data) ? data : [];
      
      // Store ALL payments for calculation
      setAllPayments((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(allPaymentsData)) {
          return allPaymentsData;
        }
        return prev;
      });
      
      // Store recent 5 for display
      setRecentPayments((prev) => {
        const newData = allPaymentsData.slice(0, 5);
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

  // Fetch all data silently in parallel
  const fetchAllData = async () => {
    // Fetch all in parallel for better performance
    await Promise.all([
      fetchPayments(),
      fetchDisbursements(),
      fetchLoans(),
      fetchCurrentCycle(),
      fetchCycleStats(),
    ]);

    // Refresh members silently
    if (typeof refreshMembers === "function") {
      await refreshMembers();
    }
  };

  useEffect(() => {
    // Initial silent fetch
    fetchAllData();

    // Silent background polling every 10 seconds for faster updates
    pollRef.current = setInterval(() => {
      // Silent refresh - no loading indicators
      fetchAllData();
    }, 10000);

    // Socket.IO real-time event listeners
    const socket = (window as any).socket;
    if (socket) {
      console.log("👂 Admin Dashboard listening for real-time updates");
      console.log("🔌 Socket connected:", socket.connected);
      console.log("🆔 Socket ID:", socket.id);

      // Listen for payment completion (new event name)
      socket.on("payment:completed", (data: any) => {
        console.log("💰 AdminDashboard received: payment:completed", data);
        toast({
          title: "Payment Received!",
          description: `Payment of KES ${data.amount} received`,
        });
        fetchAllData(); // Refresh data
      });

      // Listen for new payments
      socket.on("payment:new", (data: any) => {
        console.log("💰 AdminDashboard received: payment:new", data);
        fetchAllData(); // Refresh data
      });

      // Listen for cycle updates (new event name)
      socket.on("cycle:updated", (data: any) => {
        console.log("🔄 AdminDashboard received: cycle:updated", data);
        fetchCurrentCycle(); // Refresh cycle data specifically
        fetchAllData(); // Refresh all data
      });

      // Listen for payment failures
      socket.on("payment:failed", (data: any) => {
        console.log("❌ AdminDashboard received: payment:failed", data);
        toast({
          title: "Payment Failed",
          description: `Payment failed: ${data.message || "Unknown error"}`,
          variant: "destructive",
        });
      });

      // Listen for member additions
      socket.on("member:new", (data: any) => {
        console.log("👤 AdminDashboard received: member:new", data);
        fetchAllData(); // Refresh data
      });

      // Listen for new disbursements
      socket.on("disbursement:new", (data: any) => {
        console.log("💸 AdminDashboard received: disbursement:new", data);
        toast({
          title: "Disbursement Processed!",
          description: `KES ${data.amount} sent to ${data.recipient_id?.name || "member"}`,
        });
        fetchDisbursements(); // Refresh disbursements
        fetchCurrentCycle(); // Refresh current cycle
      });

      // Listen for disbursement updates
      socket.on("disbursement:updated", (data: any) => {
        console.log("💸 AdminDashboard received: disbursement:updated", data);
        fetchDisbursements(); // Refresh disbursements
      });
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);

      // Cleanup Socket.IO listeners
      if (socket) {
        socket.off("payment:completed");
        socket.off("payment:new");
        socket.off("cycle:updated");
        socket.off("payment:failed");
        socket.off("member:new");
        socket.off("disbursement:new");
        socket.off("disbursement:updated");
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

⏰ *${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining* to send your contribution!

💰 *Amount Due:* KES 224

📋 *Members who haven't paid yet:*
${unpaidList}

⚠️ Please send your contribution before the deadline to avoid penalties.

Thank you for your cooperation! 🙏`;

    // Individual DM message
    const individualMessage = (memberName: string) => `🔔 *SMCF Payment Reminder - Cycle #${cycleNumber}* 🔔

Hi ${memberName},

⏰ You have *${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining* to send your contribution!

💰 *Amount Due:* KES 224

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
      description: `Opening ${pendingCount + 1} WhatsApp tabs (1 group + ${pendingCount} personal DMs). Please allow pop-ups if blocked.`,
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
    const paidCount = paidMembersCount; // Use payment-based count for accuracy

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
        monthly_contribution: Number(editedMemberData.monthly_contribution) || 0,
      };
      
      // Only include password if it's been changed (not empty)
      if (editedMemberData.password && editedMemberData.password.trim() !== "") {
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
            amount: 224,
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
          description: `KES 224 contribution recorded for ${member.name}. Member status updated to PAID.`,
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
            amount: 0
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
                    const recipientId = currentCycle.next_recipient?._id || currentCycle.recipient_id?._id || currentCycle.recipient_id;
                    const recipientPhone = currentCycle.next_recipient?.phone;
                    const cycleId = currentCycle._id || currentCycle.id;
                    const disbursementAmount = safeMembers.length * 224;

                    if (!recipientId || !cycleId || !recipientPhone) {
                      throw new Error("Missing recipient information");
                    }

                    const response = await fetch(`${API_BASE}/api/disbursements`, {
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
                    });

                    const data = await response.json();

                    if (response.ok && data.success) {
                      toast({
                        title: "Disbursement Recorded",
                        description: `KES ${disbursementAmount.toLocaleString()} marked as disbursed to ${currentCycle.next_recipient?.name || 'recipient'}`,
                      });
                      fetchDisbursements();
                      fetchCurrentCycle();
                      fetchAllData();
                    } else {
                      throw new Error(data.error || "Failed to record disbursement");
                    }
                  } catch (error: any) {
                    console.error("Disbursement error:", error);
                    toast({
                      title: "Error",
                      description: error.message || "Failed to record disbursement",
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
          <TabsList className="inline-flex w-auto md:grid md:w-full md:grid-cols-7 min-w-max">
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
              value="savings"
              className="text-xs sm:text-sm whitespace-nowrap">
              Savings
            </TabsTrigger>
            <TabsTrigger
              value="disbursements"
              className="text-xs sm:text-sm whitespace-nowrap">
              Disbursements
            </TabsTrigger>
            <TabsTrigger
              value="loans"
              className="text-xs sm:text-sm whitespace-nowrap">
              Loans
            </TabsTrigger>
            <TabsTrigger
              value="approvals"
              className="text-xs sm:text-sm whitespace-nowrap">
              Approvals
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
                Current Cycle #{currentCycle?.cycle_number || currentCycle?.data?.cycle_number || userData?.cycleData?.currentCycle || '—'}
              </CardTitle>
              <CardDescription>
                Started: {currentCycle?.start_date 
                  ? new Date(currentCycle.start_date).toLocaleDateString()
                  : currentCycle?.data?.start_date 
                    ? new Date(currentCycle.data.start_date).toLocaleDateString()
                    : userData?.cycleData?.cycleStartDate || 'Not Started'
                } | Status: {currentCycle?.status || currentCycle?.data?.status || 'Inactive'}
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
                    KES {(currentCycle?.total_amount_collected || currentCycle?.data?.total_amount_collected || userData?.cycleData?.collectedAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Target Amount
                  </div>
                  <div className="text-2xl font-bold">
                    KES {((safeMembers.length || 14) * 204).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Disbursement
                  </div>
                  <div className="text-xl font-bold">
                    {currentCycle?.disbursement_status || currentCycle?.data?.disbursement_status || "Pending"}
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
                  <h3 className="font-semibold mb-1 text-red-700 dark:text-red-400">Reset System & Start from Cycle #1</h3>
                  <p className="text-sm text-muted-foreground">
                    Clear all payments, disbursements, and cycles. Start fresh from Cycle #1 with Member #1
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    if (!window.confirm("⚠️ WARNING: This will DELETE all payments, disbursements, and cycles. Are you sure?")) {
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
                      }).then(r => r.json());

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
                      const firstMember = members.sort((a, b) => a.position - b.position)[0];
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
                        description: "All data cleared. Starting fresh from Cycle #1",
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  KES {(paidMembers.length * 204).toLocaleString()} collected
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
                  KES {(pendingMembers.length * 204).toLocaleString()}{" "}
                  outstanding
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member List */}
          <Card>
            <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>
                Total: {safeMembers.length} members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orderedMembers.map((member, index) => (
                  <div
                    key={member._id || member.id || index}
                    className="flex items-center justify-between p-3 border rounded-lg">
                    {editingMember === (member._id || member.id) ? (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label
                              htmlFor={`name-${member._id || member.id}`}
                              className="text-xs">
                              Name
                            </Label>
                            <Input
                              id={`name-${member._id || member.id}`}
                              value={editedMemberData.name || ""}
                              onChange={(e) =>
                                setEditedMemberData((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`phone-${member._id || member.id}`}
                              className="text-xs">
                              Phone
                            </Label>
                            <Input
                              id={`phone-${member._id || member.id}`}
                              value={editedMemberData.phone || ""}
                              onChange={(e) =>
                                setEditedMemberData((prev) => ({
                                  ...prev,
                                  phone: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`amount-${member._id || member.id}`}
                              className="text-xs">
                              Monthly Contribution (KES)
                            </Label>
                            <Input
                              id={`amount-${member._id || member.id}`}
                              type="number"
                              value={editedMemberData.monthly_contribution || ""}
                              onChange={(e) =>
                                setEditedMemberData((prev) => ({
                                  ...prev,
                                  monthly_contribution: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`password-${member._id || member.id}`}
                              className="text-xs">
                              Password (leave blank to keep current)
                            </Label>
                            <Input
                              id={`password-${member._id || member.id}`}
                              type="password"
                              placeholder="Enter new password"
                              value={editedMemberData.password || ""}
                              onChange={(e) =>
                                setEditedMemberData((prev) => ({
                                  ...prev,
                                  password: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveMember(member._id || member.id)}>
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${
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
                            <div className="text-sm text-muted-foreground">
                              {member.member_id} • {member.phone}
                            </div>
                            {member.total_contributed > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Contributed: KES{" "}
                                {member.total_contributed?.toLocaleString() ||
                                  0}{" "}
                                | Received: KES{" "}
                                {member.total_received?.toLocaleString() || 0}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
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
                            {member.date && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {member.date}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 items-center">
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
                                member.status === "paid"
                                  ? "destructive"
                                  : "default"
                              }
                              onClick={() => togglePaymentStatusRemote(member)}>
                              {member.status === "paid"
                                ? "Mark Pending"
                                : "Mark Paid"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleEditMember(member._id || member.id)
                              }>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMemberRemote(member)}
                              className="text-destructive hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                            (paidMembers.length /
                              safeMembers.length) *
                              100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      safeMembers.length > 0
                        ? (paidMembers.length /
                            safeMembers.length) *
                          100
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
                        safeMembers.length * 224 -
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
                        KES {(safeMembers.length * 224).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        variant={
                          currentCycle.disbursement_status === "completed"
                            ? "default"
                            : paidMembersCount === safeMembers.length
                            ? "default"
                            : "secondary"
                        }>
                        {currentCycle.disbursement_status ||
                          (paidMembersCount === safeMembers.length
                            ? "Ready"
                            : `Waiting (${paidMembersCount}/${safeMembers.length})`)}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Mark as Disbursed Button */}
                  {currentCycle.disbursement_status !== "completed" && 
                   currentCycle.recipient_id && (
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch(`${API_BASE}/api/disbursements`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...authService.getAuthHeaders(),
                            },
                            body: JSON.stringify({
                              cycle_id: currentCycle._id,
                              recipient_id: currentCycle.recipient_id._id || currentCycle.recipient_id,
                              amount: safeMembers.length * 224,
                              method: "manual",
                              status: "completed",
                            }),
                          });

                          const data = await response.json();

                          if (response.ok && data.success) {
                            toast({
                              title: "Disbursement Recorded",
                              description: `Successfully marked disbursement to ${currentCycle.recipient_id?.name} as completed`,
                            });
                            fetchDisbursements();
                            fetchCurrentCycle();
                          } else {
                            throw new Error(data.error || "Failed to record disbursement");
                          }
                        } catch (error: any) {
                          toast({
                            title: "Error",
                            description: error.message || "Failed to record disbursement",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="w-full"
                      variant="default"
                      disabled={paidMembersCount !== safeMembers.length}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Disbursed
                      {paidMembersCount !== safeMembers.length && (
                        <span className="ml-2 text-xs">
                          ({paidMembersCount}/{safeMembers.length} paid)
                        </span>
                      )}
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
                  {currentCycle && currentCycle.recipient_id && currentCycle.disbursement_status !== "completed" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch(`${API_BASE}/api/disbursements`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...authService.getAuthHeaders(),
                            },
                            body: JSON.stringify({
                              cycle_id: currentCycle._id,
                              recipient_id: currentCycle.recipient_id._id || currentCycle.recipient_id,
                              amount: safeMembers.length * 224,
                              method: "manual",
                              status: "completed",
                            }),
                          });

                          const data = await response.json();

                          if (response.ok && data.success) {
                            toast({
                              title: "Disbursement Recorded",
                              description: `Successfully marked disbursement to ${currentCycle.recipient_id?.name} as completed`,
                            });
                            fetchDisbursements();
                            fetchCurrentCycle();
                          } else {
                            throw new Error(data.error || "Failed to record disbursement");
                          }
                        } catch (error: any) {
                          toast({
                            title: "Error",
                            description: error.message || "Failed to record disbursement",
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
                    className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-financial-success" />
                      <div>
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
    </div>
  );
};

export default AdminDashboard;
