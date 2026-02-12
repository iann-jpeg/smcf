import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  DollarSign,
  Calendar,
  Loader2,
  FileText,
} from "lucide-react";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

interface GuarantorRequest {
  _id: string;
  loan_id: {
    _id: string;
    amount: number;
    purpose: string;
    interest_rate: number;
    created_at: string;
  };
  borrower_id: {
    _id: string;
    name: string;
    member_id: string;
    phone: string;
  };
  liability_amount: number;
  status: string;
  created_at: string;
  legal_acceptance_text: string;
  policy_version: string;
}

const LEGAL_DECLARATION = `I understand and accept that I am jointly and severally liable for the repayment of this loan under the Laws of Kenya. In the event of borrower default, I may be subject to recovery action including deduction from my savings account. This agreement is governed by the Law of Contract Act (Cap 23) and constitutes a legally binding electronic signature.`;

const GuarantorRequests = () => {
  const [requests, setRequests] = useState<GuarantorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GuarantorRequest | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/guarantors/my-guarantor-requests`, {
        headers: authService.getAuthHeaders(),
      });

      const data = await response.json();
      console.log("Guarantor requests fetched:", data);

      if (response.ok && data.success) {
        setRequests(data.requests);
        console.log(`Found ${data.requests.length} pending guarantor requests`);
      } else {
        throw new Error(data.error || "Failed to fetch requests");
      }
    } catch (error: any) {
      console.error("Error fetching guarantor requests:", error);
      toast({
        title: "Error",
        description: "Failed to load guarantor requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptClick = (request: GuarantorRequest) => {
    setSelectedRequest(request);
    setLegalAccepted(false);
    setShowAcceptDialog(true);
  };

  const handleDeclineClick = (request: GuarantorRequest) => {
    setSelectedRequest(request);
    setDeclineReason("");
    setShowDeclineDialog(true);
  };

  const confirmAccept = async () => {
    if (!selectedRequest || !legalAccepted) return;

    try {
      setActionLoading(selectedRequest._id);
      const response = await fetch(
        `${API_BASE}/api/guarantors/accept/${selectedRequest._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Guarantor Accepted",
          description: `You have accepted to guarantee ${selectedRequest?.borrower_id?.name || 'the borrower'}'s loan of KES ${(selectedRequest?.liability_amount || 0).toLocaleString()}`,
        });
        setShowAcceptDialog(false);
        setSelectedRequest(null);
        fetchRequests();
      } else {
        throw new Error(data.error || "Failed to accept guarantor request");
      }
    } catch (error: any) {
      console.error("Error accepting request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDecline = async () => {
    if (!selectedRequest) return;

    try {
      setActionLoading(selectedRequest._id);
      const response = await fetch(
        `${API_BASE}/api/guarantors/decline/${selectedRequest._id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({ reason: declineReason }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Request Declined",
          description: "You have declined the guarantor request",
        });
        setShowDeclineDialog(false);
        setSelectedRequest(null);
        fetchRequests();
      } else {
        throw new Error(data.error || "Failed to decline guarantor request");
      }
    } catch (error: any) {
      console.error("Error declining request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to decline request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Guarantor Requests
            {requests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {requests.length} Pending
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No pending guarantor requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request._id} className="border-2 border-yellow-200 bg-yellow-50/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                        <p className="font-semibold">{request?.borrower_id?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {request?.borrower_id?.member_id || 'N/A'} • {request?.borrower_id?.phone || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-yellow-500">Pending Response</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Loan Amount</p>
                          <p className="font-medium">
                            KES {(request?.loan_id?.amount || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-orange-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Your Liability</p>
                          <p className="font-medium text-orange-600">
                            KES {(request?.liability_amount || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Purpose</p>
                          <p className="font-medium">{request?.loan_id?.purpose || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="font-medium">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-xs text-blue-800">
                        <strong>Joint & Several Liability:</strong> If the borrower defaults, you may be
                        required to repay up to KES {(request?.liability_amount || 0).toLocaleString()} from
                        your savings account.
                      </AlertDescription>
                    </Alert>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleAcceptClick(request)}
                        disabled={actionLoading === request._id}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === request._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Accept
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleDeclineClick(request)}
                        disabled={actionLoading === request._id}
                        variant="destructive"
                        className="flex-1"
                      >
                        {actionLoading === request._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Decline
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accept Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Accept Guarantor Responsibility
            </DialogTitle>
            <DialogDescription>
              Please read and accept the legal terms before proceeding
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>LEGAL NOTICE:</strong> This is a legally binding agreement under Kenyan Law.
                  Your acceptance creates financial liability.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Loan Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Borrower:</span>
                    <span className="font-medium">{selectedRequest?.borrower_id?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loan Amount:</span>
                    <span className="font-medium">
                      KES {(selectedRequest?.loan_id?.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Liability:</span>
                    <span className="font-medium text-orange-600">
                      KES {(selectedRequest?.liability_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest Rate:</span>
                    <span className="font-medium">{selectedRequest?.loan_id?.interest_rate || 0}%</span>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-muted p-4 rounded-lg border">
                <p className="font-semibold mb-2 text-sm">Legal Declaration:</p>
                <p className="text-xs leading-relaxed">{LEGAL_DECLARATION}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Policy Version: {selectedRequest?.policy_version || 'N/A'}
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  className="mt-1"
                  id="legal-accept"
                />
                <label htmlFor="legal-accept" className="text-sm cursor-pointer">
                  <strong>I have read and accept the legal declaration above.</strong> I understand
                  that I am jointly and severally liable for this loan and that my acceptance is
                  legally binding under the Laws of Kenya.
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAccept}
              disabled={!legalAccepted || actionLoading !== null}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm Acceptance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Decline Guarantor Request
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for declining (optional)
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="text-muted-foreground">Declining guarantee for:</p>
                <p className="font-medium">{selectedRequest?.borrower_id?.name || 'Unknown'}</p>
                <p className="font-medium text-muted-foreground">
                  Loan Amount: KES {(selectedRequest?.loan_id?.amount || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Reason (optional)</label>
                <Textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g., Already guaranteeing too many loans, financial constraints, etc."
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDecline}
              disabled={actionLoading !== null}
              variant="destructive"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirm Decline
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GuarantorRequests;
