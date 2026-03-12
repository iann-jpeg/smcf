import { useGuarantorExposure, useGuarantors } from "@/hooks/useGuarantors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ShieldCheck, ShieldX } from "lucide-react";

export default function Guarantors() {
  const { data: guarantors = [], isLoading } = useGuarantorExposure();
  const { data: allGuarantors = [] } = useGuarantors();
  const pendingConsents = (allGuarantors as any[]).filter((g) => (g.consent_status ?? g.consentStatus ?? 'pending') === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Guarantor Exposure</h1>
        <p className="text-muted-foreground text-sm">Track guarantee limits and concentration risk</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : guarantors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No guarantor data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guarantor</TableHead>
                  <TableHead className="text-right">Total Guaranteed</TableHead>
                  <TableHead className="text-right">Savings</TableHead>
                  <TableHead className="text-right">Max Allowed (3x)</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead>Exposure Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guarantors.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-right">KES {g.totalGuaranteed.toLocaleString()}</TableCell>
                    <TableCell className="text-right">KES {g.savings.toLocaleString()}</TableCell>
                    <TableCell className="text-right">KES {g.maxAllowed.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{g.activeGuarantees}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={Math.min(g.exposureRatio, 100)} className="h-2 flex-1" />
                        <Badge variant={g.exposureRatio > 80 ? "destructive" : g.exposureRatio > 50 ? "secondary" : "default"}>
                          {g.exposureRatio.toFixed(1)}%
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Consent Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending Guarantor Consent
            {pendingConsents.length > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">{pendingConsents.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingConsents.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
              All guarantors have responded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guarantor</TableHead>
                  <TableHead>For Loan</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="text-right">Guarantee Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingConsents.map((g: any) => (
                  <TableRow key={g.id ?? g._id}>
                    <TableCell className="font-medium">{g.members?.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{g.loans?.loan_number ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{g.loans?.applicant ?? '—'}</TableCell>
                    <TableCell className="text-right">KES {Number(g.guarantee_amount ?? g.guaranteeAmount ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1 text-xs">
                        <Clock className="h-3 w-3" />Pending
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
