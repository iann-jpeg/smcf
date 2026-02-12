import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect, useState } from "react";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  User,
} from "lucide-react";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { useToast } from "@/hooks/use-toast";

interface GuarantorExposure {
  _id: string;
  guarantor_id: string;
  total_guaranteed_amount: number;
  active_guarantee_count: number;
  pending_guarantee_count: number;
  total_recovered_amount: number;
  risk_score: number;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  max_guarantee_capacity: number;
  available_capacity: number;
  utilization_percentage: number;
  default_history: Array<{
    loan_id: string;
    borrower_id: string;
    defaulted_amount: number;
    recovered_amount: number;
    status: string;
    defaulted_at: string;
  }>;
}

interface GuaranteedLoan {
  _id: string;
  loan_id: {
    _id: string;
    amount: number;
    purpose: string;
    interest_rate: number;
    status: string;
    created_at: string;
  };
  borrower_id: {
    name: string;
    member_id: string;
    phone: string;
  };
  status: string;
  liability_amount: number;
  recovered_amount: number;
  accepted_at?: string;
  declined_at?: string;
  created_at: string;
}

const GuarantorProfile = () => {
  const [exposure, setExposure] = useState<GuarantorExposure | null>(null);
  const [guarantees, setGuarantees] = useState<GuaranteedLoan[]>([]);
  const [savingsBalance, setSavingsBalance] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/guarantors/my-profile`, {
        headers: authService.getAuthHeaders(),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setExposure(data.profile.exposure);
        setGuarantees(data.profile.guarantees);
        setSavingsBalance(data.profile.savings_balance);
        setMaxCapacity(data.profile.max_capacity);
      } else {
        throw new Error(data.error || "Failed to fetch profile");
      }
    } catch (error: any) {
      console.error("Error fetching guarantor profile:", error);
      toast({
        title: "Error",
        description: "Failed to load guarantor profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      accepted: { color: "bg-green-500", icon: CheckCircle2, label: "Accepted" },
      pending: { color: "bg-yellow-500", icon: Clock, label: "Pending" },
      declined: { color: "bg-red-500", icon: XCircle, label: "Declined" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getLoanStatusBadge = (status: string) => {
    const statusConfig: Record<string, string> = {
      pending: "bg-yellow-500",
      approved: "bg-blue-500",
      disbursed: "bg-green-500",
      active: "bg-green-600",
      repaid: "bg-gray-500",
      defaulted: "bg-red-500",
    };

    return <Badge className={statusConfig[status] || "bg-gray-400"}>{status}</Badge>;
  };

  const getRiskLevel = (score: number) => {
    if (score <= 30) return { label: "Low Risk", color: "text-green-600", bg: "bg-green-50" };
    if (score <= 60) return { label: "Medium Risk", color: "text-yellow-600", bg: "bg-yellow-50" };
    return { label: "High Risk", color: "text-red-600", bg: "bg-red-50" };
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!exposure) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No guarantor profile found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const riskLevel = getRiskLevel(exposure.risk_score);

  return (
    <div className="space-y-4">
      {/* Blacklist Warning */}
      {exposure.is_blacklisted && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Account Blacklisted:</strong> {exposure.blacklist_reason}
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Total Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              KES {(exposure?.total_guaranteed_amount || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {exposure?.active_guarantee_count || 0} active loans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Available Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              KES {(exposure?.available_capacity || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max: KES {(exposure?.max_guarantee_capacity || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className={riskLevel.bg}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Risk Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${riskLevel.color}`}>
              {exposure?.risk_score || 0}/100
            </p>
            <p className={`text-xs font-medium mt-1 ${riskLevel.color}`}>
              {riskLevel.label}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Guarantee Capacity
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {(exposure?.utilization_percentage || 0).toFixed(1)}% Used
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={exposure?.utilization_percentage || 0} className="h-3" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Savings Balance</p>
              <p className="font-medium">KES {(savingsBalance || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Max Capacity (3x Savings)</p>
              <p className="font-medium">KES {(maxCapacity || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Currently Guaranteed</p>
              <p className="font-medium text-orange-600">
                KES {(exposure?.total_guaranteed_amount || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Available to Guarantee</p>
              <p className="font-medium text-green-600">
                KES {(exposure?.available_capacity || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {(exposure?.pending_guarantee_count || 0) > 0 && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <Clock className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-800">
                You have {exposure?.pending_guarantee_count || 0} pending guarantee request(s) awaiting
                your response.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Guaranteed Loans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Guaranteed Loans ({guarantees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guarantees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No guaranteed loans</p>
            </div>
          ) : (
            <div className="space-y-3">
              {guarantees.map((guarantee) => (
                <Card key={guarantee._id} className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                        <p className="font-medium">{guarantee?.borrower_id?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {guarantee?.borrower_id?.member_id || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(guarantee?.status || 'pending')}
                      {getLoanStatusBadge(guarantee?.loan_id?.status || 'pending')}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Loan Amount</p>
                        <p className="font-medium">
                          KES {(guarantee?.loan_id?.amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Your Liability</p>
                        <p className="font-medium text-orange-600">
                          KES {(guarantee?.liability_amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Purpose</p>
                        <p className="font-medium truncate">{guarantee?.loan_id?.purpose || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Interest Rate</p>
                        <p className="font-medium">{guarantee?.loan_id?.interest_rate || 0}%</p>
                      </div>
                    </div>

                    {(guarantee?.recovered_amount || 0) > 0 && (
                      <Alert variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        <AlertDescription>
                          <strong>Recovery Made:</strong> KES{" "}
                          {(guarantee?.recovered_amount || 0).toLocaleString()} deducted from your savings
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Default History */}
      {exposure?.default_history && exposure.default_history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Default History ({exposure.default_history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exposure.default_history.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-red-900">
                        Defaulted: KES {(item?.defaulted_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-red-700">
                        Recovered: KES {(item?.recovered_amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      className={
                        item?.status === "fully_recovered"
                          ? "bg-green-500"
                          : item?.status === "partially_recovered"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }
                    >
                      {(item?.status || 'pending').replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GuarantorProfile;
