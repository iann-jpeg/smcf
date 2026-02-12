import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  User,
  TrendingUp,
  DollarSign,
  Loader2
} from "lucide-react";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

interface Guarantor {
  id: string;
  name: string;
  member_id: string;
  phone: string;
  savings_balance: number;
  current_exposure: number;
  available_capacity: number;
  active_guarantees: number;
  is_eligible: boolean;
  ineligibility_reasons?: string[];
  risk_score: number;
}

interface GuarantorSelectorProps {
  loanAmount: number;
  selectedGuarantors: string[];
  onSelectionChange: (guarantorIds: string[]) => void;
  minRequired?: number;
}

const GuarantorSelector = ({
  loanAmount,
  selectedGuarantors,
  onSelectionChange,
  minRequired = 2,
}: GuarantorSelectorProps) => {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{
    min_required: number;
    max_loans_to_guarantee: number;
    min_savings_balance: number;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (loanAmount > 0) {
      fetchEligibleGuarantors();
    }
  }, [loanAmount]);

  const fetchEligibleGuarantors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/api/guarantors/eligible-guarantors?loan_amount=${loanAmount}`,
        {
          headers: authService.getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setGuarantors(data.guarantors);
        setConfig(data.config);
      } else {
        throw new Error(data.error || "Failed to fetch guarantors");
      }
    } catch (error: any) {
      console.error("Error fetching guarantors:", error);
      toast({
        title: "Error",
        description: "Failed to load eligible guarantors. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGuarantor = (guarantorId: string, isEligible: boolean) => {
    if (!isEligible) {
      toast({
        title: "Ineligible Guarantor",
        description: "This member does not meet the guarantor requirements",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedGuarantors.includes(guarantorId)) {
      onSelectionChange(selectedGuarantors.filter((id) => id !== guarantorId));
    } else {
      onSelectionChange([...selectedGuarantors, guarantorId]);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score <= 30) return <Badge className="bg-green-500">Low Risk</Badge>;
    if (score <= 60) return <Badge className="bg-yellow-500">Medium Risk</Badge>;
    return <Badge className="bg-red-500">High Risk</Badge>;
  };

  const eligibleGuarantors = guarantors.filter((g) => g.is_eligible);
  const ineligibleGuarantors = guarantors.filter((g) => !g.is_eligible);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (guarantors.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>No Members Available</strong>
          <p className="text-sm mt-1">
            There are no members available to serve as guarantors at this time.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Guarantor Requirement:</strong> You need to select at least{" "}
          <strong>{config?.min_required || minRequired} guarantors</strong> who will jointly 
          guarantee your loan. They will be liable if you default on repayment.
        </AlertDescription>
      </Alert>

      {/* Selection Status */}
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border">
        <div>
          <p className="text-sm font-medium">Guarantors Selected</p>
          <p className="text-xs text-muted-foreground">
            Minimum required: {config?.min_required || minRequired}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">
            {selectedGuarantors.length}
          </span>
          {selectedGuarantors.length >= (config?.min_required || minRequired) && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </div>
      </div>

      {/* All Members List */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <User className="h-4 w-4" />
          Select Guarantors ({eligibleGuarantors.length} eligible of {guarantors.length} members)
        </h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {guarantors.map((guarantor) => (
            <Card
              key={guarantor.id}
              className={`p-4 transition-all ${
                guarantor.is_eligible 
                  ? `cursor-pointer hover:shadow-md ${
                      selectedGuarantors.includes(guarantor.id)
                        ? "ring-2 ring-primary bg-primary/5"
                        : ""
                    }`
                  : "opacity-60 cursor-not-allowed bg-muted/50"
              }`}
              onClick={() => guarantor.is_eligible && handleToggleGuarantor(guarantor.id, guarantor.is_eligible)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedGuarantors.includes(guarantor.id)}
                  onCheckedChange={() => handleToggleGuarantor(guarantor.id, guarantor.is_eligible)}
                  className="mt-1"
                  disabled={!guarantor.is_eligible}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{guarantor.name}</p>
                        {!guarantor.is_eligible && (
                          <Badge variant="destructive" className="text-xs">
                            Ineligible
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {guarantor.member_id} • {guarantor.phone}
                      </p>
                    </div>
                    {guarantor.is_eligible && getRiskBadge(guarantor.risk_score)}
                  </div>

                  {/* Ineligibility Reasons */}
                  {!guarantor.is_eligible && guarantor.ineligibility_reasons && guarantor.ineligibility_reasons.length > 0 && (
                    <Alert variant="destructive" className="py-2 mt-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        <strong>Reasons:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {guarantor.ineligibility_reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-green-600" />
                      <span className="text-muted-foreground">Savings:</span>
                      <span className="font-medium">
                        KES {guarantor.savings_balance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-blue-600" />
                      <span className="text-muted-foreground">Available:</span>
                      <span className={`font-medium ${guarantor.is_eligible ? 'text-green-600' : 'text-red-600'}`}>
                        KES {guarantor.available_capacity.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-purple-600" />
                      <span className="text-muted-foreground">Active:</span>
                      <span className="font-medium">
                        {guarantor.active_guarantees} loans
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-600" />
                      <span className="text-muted-foreground">Exposure:</span>
                      <span className="font-medium">
                        KES {guarantor.current_exposure.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Info Footer */}
      <Alert className="bg-blue-50 border-blue-200">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>How Guarantors Work:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
            <li>Selected guarantors will receive a notification to accept or decline</li>
            <li>All guarantors must accept before your loan can be approved</li>
            <li>Guarantors are jointly liable - if you default, recovery will be from their savings</li>
            <li>Guarantor capacity is based on 3x their savings balance</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default GuarantorSelector;
