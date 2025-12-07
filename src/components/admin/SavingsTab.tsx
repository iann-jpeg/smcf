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
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  PiggyBank,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

const AdminSavingsTab = () => {
  const [membersWithSavings, setMembersWithSavings] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplyingInterest, setIsApplyingInterest] = useState(false);
  const { toast } = useToast();

  const fetchSavingsData = async () => {
    try {
      const [membersRes, withdrawalsRes] = await Promise.all([
        fetch(`${API_BASE}/api/savings/admin/all`, {
          headers: { ...authService.getAuthHeaders() },
        }),
        fetch(`${API_BASE}/api/savings/admin/pending-withdrawals`, {
          headers: { ...authService.getAuthHeaders() },
        }),
      ]);

      const membersData = await membersRes.json();
      const withdrawalsData = await withdrawalsRes.json();

      console.log("📊 Admin savings data received:", membersData);
      console.log("📊 Members with savings count:", membersData.data?.length);
      
      if (membersData.success) {
        console.log("✅ Setting members with savings:", membersData.data);
        setMembersWithSavings(membersData.data);
        
        // Log totals for debugging
        const totalBalance = membersData.data.reduce((sum: number, m: any) => sum + (m.currentBalance || 0), 0);
        const totalDeps = membersData.data.reduce((sum: number, m: any) => sum + (m.totalDeposits || 0), 0);
        const totalInt = membersData.data.reduce((sum: number, m: any) => sum + (m.totalInterestEarned || 0), 0);
        console.log("💰 Calculated totals - Balance:", totalBalance, "Deposits:", totalDeps, "Interest:", totalInt);
      }

      if (withdrawalsData.success) {
        setPendingWithdrawals(withdrawalsData.data);
      }
    } catch (error) {
      console.error("Error fetching savings data:", error);
    }
  };

  useEffect(() => {
    fetchSavingsData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchSavingsData, 30000);

    // Listen for real-time withdrawal requests and status updates
    const socket = (window as any).socket;
    if (socket) {
      socket.on("withdrawalRequest", () => {
        console.log("💰 New withdrawal request received");
        fetchSavingsData();
      });

      socket.on("withdrawalStatusUpdated", () => {
        console.log("💰 Withdrawal status updated");
        fetchSavingsData();
      });

      socket.on("savingDeposit", () => {
        console.log("💰 New deposit received");
        fetchSavingsData();
      });

      socket.on("saving:new", () => {
        console.log("💰 New saving transaction");
        fetchSavingsData();
      });

      socket.on("payment:completed", (data: any) => {
        if (data.type === "wallet_deposit") {
          console.log("💰 Wallet deposit completed in admin view");
          fetchSavingsData();
        }
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off("withdrawalRequest");
        socket.off("withdrawalStatusUpdated");
        socket.off("savingDeposit");
        socket.off("saving:new");
        socket.off("payment:completed");
      }
    };
  }, []);

  const handleWithdrawalAction = async (
    withdrawalId: string,
    status: "completed" | "failed"
  ) => {
    setIsProcessing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/savings/${withdrawalId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast({
          title: `Withdrawal ${status}`,
          description: data.message,
        });
        fetchSavingsData();
      } else {
        throw new Error(data.error || "Action failed");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyInterest = async () => {
    if (
      !confirm(
        "Are you sure you want to apply 3% monthly interest to all member savings? This action will create interest transactions for all members with savings."
      )
    ) {
      return;
    }

    setIsApplyingInterest(true);
    try {
      const res = await fetch(`${API_BASE}/api/savings/admin/apply-interest`, {
        method: "POST",
        headers: {
          ...authService.getAuthHeaders(),
        },
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Interest Applied",
          description: data.message,
        });
        fetchSavingsData();
      } else {
        throw new Error(data.error || "Failed to apply interest");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsApplyingInterest(false);
    }
  };

  // Calculate totals
  const totalSavings = membersWithSavings.reduce(
    (sum, m) => sum + m.currentBalance,
    0
  );
  const totalDeposits = membersWithSavings.reduce(
    (sum, m) => sum + m.totalDeposits,
    0
  );
  const totalInterest = membersWithSavings.reduce(
    (sum, m) => sum + m.totalInterestEarned,
    0
  );
  const membersWithBalance = membersWithSavings.filter(
    (m) => m.currentBalance > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Savings Pool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                KES {totalSavings.toLocaleString()}
              </div>
              <PiggyBank className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Savers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{membersWithBalance}</div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                KES {totalDeposits.toLocaleString()}
              </div>
              <ArrowDownLeft className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Interest Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                KES {totalInterest.toLocaleString()}
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interest Application */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monthly Interest</CardTitle>
              <CardDescription>
                Apply 3% monthly interest to all member savings
              </CardDescription>
            </div>
            <Button
              onClick={handleApplyInterest}
              disabled={isApplyingInterest || membersWithBalance === 0}
              className="bg-blue-600 hover:bg-blue-700">
              {isApplyingInterest ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              Apply Interest
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">
                Member Savings ({membersWithSavings.length})
              </TabsTrigger>
              <TabsTrigger value="withdrawals">
                Pending Withdrawals ({pendingWithdrawals.length})
              </TabsTrigger>
            </TabsList>

            {/* Member Savings Tab */}
            <TabsContent value="members" className="space-y-4">
              {membersWithSavings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <PiggyBank className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No savings data yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Current Balance</TableHead>
                      <TableHead>Total Deposits</TableHead>
                      <TableHead>Interest Earned</TableHead>
                      <TableHead>Last Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membersWithSavings.map((member) => (
                      <TableRow key={member._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {member.member_id} • {member.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">#{member.position}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          KES {(member.currentBalance || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-600">
                          KES {(member.totalDeposits || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-blue-600">
                          KES {(member.totalInterestEarned || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {member.lastTransaction
                            ? new Date(
                                member.lastTransaction
                              ).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Pending Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-4">
              {pendingWithdrawals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No pending withdrawal requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance Before</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {withdrawal.member_id?.name || "Unknown"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {withdrawal.member_id?.member_id} •{" "}
                              {withdrawal.member_id?.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-red-600">
                          KES {withdrawal.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          KES {withdrawal.balance_before.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          KES {withdrawal.balance_after.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(withdrawal.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {withdrawal.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleWithdrawalAction(
                                  withdrawal._id,
                                  "completed"
                                )
                              }
                              disabled={isProcessing}>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                handleWithdrawalAction(withdrawal._id, "failed")
                              }
                              disabled={isProcessing}>
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSavingsTab;
