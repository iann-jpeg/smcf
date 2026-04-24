import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, TrendingUp, Wallet, Award, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

interface CreditScoreData {
  score: number;
  decision: string;
  decisionColor: string;
  breakdown: {
    savings: number;
    cycle: number;
    repayment: number;
    consistency: number;
  };
  reasons: string[];
  flags: string[];
  calculatedAt: string;
}

interface CreditScoreCardProps {
  memberId?: string;
  showTitle?: boolean;
}

export default function CreditScoreCard({ memberId, showTitle = true }: CreditScoreCardProps) {
  const [creditScore, setCreditScore] = useState<CreditScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCreditScore = async () => {
    try {
      setLoading(true);
      const endpoint = memberId 
        ? `${API_BASE}/api/credit-score/${memberId}`
        : `${API_BASE}/api/credit-score/member/current`;
        
      const res = await fetch(endpoint, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });

      const data = await res.json();
      
      if (data.success) {
        setCreditScore(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch credit score');
      }
    } catch (error: any) {
      console.error('Credit score fetch error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not load credit score',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditScore();
  }, [memberId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!creditScore) {
    return null;
  }

  const getDecisionIcon = () => {
    if (creditScore.decision === 'Approved') {
      return <CheckCircle className="w-8 h-8 text-green-600" />;
    } else if (creditScore.decision === 'Review Required') {
      return <AlertTriangle className="w-8 h-8 text-orange-600" />;
    }
    return <AlertCircle className="w-8 h-8 text-red-600" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 70) return 'bg-green-600';
    if (score >= 50) return 'bg-orange-600';
    return 'bg-red-600';
  };

  return (
    <Card className="border-2">
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Credit Score
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={showTitle ? '' : 'pt-6'}>
        {/* Score Display */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {getDecisionIcon()}
            <div>
              <div className={`text-5xl font-bold ${getScoreColor(creditScore.score)}`}>
                {creditScore.score}
              </div>
              <div className="text-sm text-muted-foreground">out of 100</div>
            </div>
          </div>
          <Badge 
            variant={creditScore.decision === 'Approved' ? 'default' : 'secondary'}
            className={`text-lg py-2 px-4 ${
              creditScore.decision === 'Approved' 
                ? 'bg-green-600 hover:bg-green-700' 
                : creditScore.decision === 'Review Required'
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}>
            {creditScore.decision}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <Progress 
            value={creditScore.score} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span>50 (Review)</span>
            <span>70 (Approved)</span>
            <span>100</span>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3 mb-6">
          <div className="text-sm font-semibold">Score Breakdown:</div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              <span className="text-sm">Savings Contribution</span>
            </div>
            <span className="font-semibold text-blue-600">
              {creditScore.breakdown.savings}/40
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-sm">Cycle Participation</span>
            </div>
            <span className="font-semibold text-purple-600">
              {creditScore.breakdown.cycle}/25
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm">Repayment Behavior</span>
            </div>
            <span className="font-semibold text-green-600">
              {creditScore.breakdown.repayment}/25
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-600" />
              <span className="text-sm">Contribution Consistency</span>
            </div>
            <span className="font-semibold text-orange-600">
              {creditScore.breakdown.consistency}/10
            </span>
          </div>
        </div>

        {/* Reasons */}
        {creditScore.reasons.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2">Key Factors:</div>
            <ul className="space-y-1">
              {creditScore.reasons.map((reason, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Flags */}
        {creditScore.flags.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alerts:
            </div>
            <ul className="space-y-1">
              {creditScore.flags.map((flag, index) => (
                <li key={index} className="text-sm text-amber-700">
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-muted-foreground text-center mt-4 pt-4 border-t">
          Last calculated: {new Date(creditScore.calculatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
