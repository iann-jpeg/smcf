import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  Ban,
  RefreshCw,
  Search,
  Loader2,
  User,
  Eye,
  CheckCircle2,
} from "lucide-react";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

interface GuarantorStats {
  total_guarantors: number;
  active_guarantors: number;
  blacklisted_guarantors: number;
  total_exposure: number;
  pending_requests: number;
}

interface Guarantor {
  member: {
    _id: string;
    name: string;
    member_id: string;
    phone: string;
    total_savings: number;
  };
  exposure: {
    total_guaranteed_amount: number;
    active_guarantee_count: number;
    pending_guarantee_count: number;
    risk_score: number;
    is_blacklisted: boolean;
    blacklist_reason?: string;
    available_capacity: number;
    utilization_percentage: number;
  };
  guarantees: any[];
  savings_balance: number;
}

const AdminGuarantorManagement = () => {
  const [stats, setStats] = useState<GuarantorStats | null>(null);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGuarantor, setSelectedGuarantor] = useState<string | null>(null);
  const [guarantorProfile, setGuarantorProfile] = useState<Guarantor | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showBlacklistDialog, setShowBlacklistDialog] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [blacklistAction, setBlacklistAction] = useState<"add" | "remove">("add");
  const [blacklistReason, setBlacklistReason] = useState("");
  const [selectedLoanForRecovery, setSelectedLoanForRecovery] = useState("");
  const [recoveryType, setRecoveryType] = useState<"equal" | "proportional" | "custom">("equal");
  const [processingAction, setProcessingAction] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
    fetchAllGuarantors();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/guarantors/stats`, {
        headers: authService.getAuthHeaders(),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchAllGuarantors = async () => {
    try {
      setLoading(true);
      // Fetch all members with exposure data
      const membersResponse = await fetch(`${API_BASE}/api/members`, {
        headers: authService.getAuthHeaders(),
      });

      if (!membersResponse.ok) {
        throw new Error("Failed to fetch members");
      }

      const membersData = await membersResponse.json();
      setGuarantors(membersData.members || []);
    } catch (error: any) {
      console.error("Error fetching guarantors:", error);
      toast({
        title: "Error",
        description: "Failed to load guarantors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGuarantorProfile = async (guarantorId: string) => {
    try {
      setProcessingAction(true);
      const response = await fetch(`${API_BASE}/api/guarantors/profile/${guarantorId}`, {
        headers: authService.getAuthHeaders(),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setGuarantorProfile(data.profile);
        setShowProfileDialog(true);
      } else {
        throw new Error(data.error || "Failed to fetch profile");
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleBlacklist = async () => {
    if (!selectedGuarantor) return;

    try {
      setProcessingAction(true);
      const response = await fetch(
        `${API_BASE}/api/guarantors/blacklist/${selectedGuarantor}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({
            is_blacklisted: blacklistAction === "add",
            reason: blacklistReason,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: data.message,
        });
        setShowBlacklistDialog(false);
        setBlacklistReason("");
        fetchAllGuarantors();
        fetchStats();
      } else {
        throw new Error(data.error || "Failed to update blacklist");
      }
    } catch (error: any) {
      console.error("Error updating blacklist:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const openBlacklistDialog = (guarantorId: string, isCurrentlyBlacklisted: boolean) => {
    setSelectedGuarantor(guarantorId);
    setBlacklistAction(isCurrentlyBlacklisted ? "remove" : "add");
    setBlacklistReason("");
    setShowBlacklistDialog(true);
  };

  const filteredGuarantors = guarantors.filter(
    (g) =>
      g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.member_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Total Guarantors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_guarantors}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.active_guarantors}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-600" />
                Blacklisted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{stats.blacklisted_guarantors}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-orange-600" />
                Total Exposure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES {stats.total_exposure.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending_requests}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Guarantor Management
            </span>
            <Button onClick={fetchAllGuarantors} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, member ID, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Guarantors Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredGuarantors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No guarantors found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGuarantors.map((member) => (
                <Card key={member._id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{member.name}</p>
                          {member.is_blacklisted && (
                            <Badge variant="destructive" className="text-xs">
                              <Ban className="h-3 w-3 mr-1" />
                              Blacklisted
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {member.member_id} • {member.phone}
                        </p>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Savings</p>
                            <p className="font-medium">
                              KES {(member.total_savings || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Max Capacity</p>
                            <p className="font-medium text-green-600">
                              KES {((member.total_savings || 0) * 3).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <Badge className={member.status === "active" ? "bg-green-500" : "bg-gray-500"}>
                              {member.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => fetchGuarantorProfile(member._id)}
                          variant="outline"
                          size="sm"
                          disabled={processingAction}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                        <Button
                          onClick={() => openBlacklistDialog(member._id, member.is_blacklisted)}
                          variant={member.is_blacklisted ? "default" : "destructive"}
                          size="sm"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          {member.is_blacklisted ? "Unblacklist" : "Blacklist"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Guarantor Profile
            </DialogTitle>
          </DialogHeader>

          {guarantorProfile && (
            <div className="space-y-4">
              {/* Member Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Member Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{guarantorProfile.member.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Member ID</p>
                    <p className="font-medium">{guarantorProfile.member.member_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{guarantorProfile.member.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Savings Balance</p>
                    <p className="font-medium">
                      KES {guarantorProfile.savings_balance.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Exposure Info */}
              {guarantorProfile.exposure && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Guarantee Exposure</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Guaranteed</p>
                      <p className="font-medium text-orange-600">
                        KES {guarantorProfile.exposure.total_guaranteed_amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Available Capacity</p>
                      <p className="font-medium text-green-600">
                        KES {guarantorProfile.exposure.available_capacity.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Active Loans</p>
                      <p className="font-medium">{guarantorProfile.exposure.active_guarantee_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk Score</p>
                      <p className="font-medium">{guarantorProfile.exposure.risk_score}/100</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Utilization</p>
                      <p className="font-medium">
                        {guarantorProfile.exposure.utilization_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      {guarantorProfile.exposure.is_blacklisted ? (
                        <Badge variant="destructive">Blacklisted</Badge>
                      ) : (
                        <Badge className="bg-green-500">Active</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Guarantees List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Guaranteed Loans ({guarantorProfile.guarantees.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {guarantorProfile.guarantees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No guaranteed loans
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {guarantorProfile.guarantees.map((g: any) => (
                        <div
                          key={g._id}
                          className="p-3 bg-muted rounded-lg text-sm flex justify-between"
                        >
                          <div>
                            <p className="font-medium">{g.borrower_id?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">
                              Loan: KES {g.loan_id?.amount?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-orange-600">
                              Liability: KES {g.liability_amount?.toLocaleString() || 0}
                            </p>
                          </div>
                          <Badge>{g.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Blacklist Dialog */}
      <Dialog open={showBlacklistDialog} onOpenChange={setShowBlacklistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              {blacklistAction === "add" ? "Blacklist Guarantor" : "Remove from Blacklist"}
            </DialogTitle>
            <DialogDescription>
              {blacklistAction === "add"
                ? "This will prevent the guarantor from accepting new guarantee requests"
                : "This will allow the guarantor to accept guarantee requests again"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Reason {blacklistAction === "add" && "*"}</Label>
              <Textarea
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder={
                  blacklistAction === "add"
                    ? "e.g., Multiple defaults, unreliable, requested by member..."
                    : "Optional reason for removing blacklist..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlacklistDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBlacklist}
              disabled={processingAction || (blacklistAction === "add" && !blacklistReason)}
              variant={blacklistAction === "add" ? "destructive" : "default"}
            >
              {processingAction ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : blacklistAction === "add" ? (
                "Confirm Blacklist"
              ) : (
                "Confirm Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGuarantorManagement;
