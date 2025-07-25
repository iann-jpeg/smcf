import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Target, Shield } from "lucide-react";

interface OrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrganizationDialog = ({ open, onOpenChange }: OrganizationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="w-6 h-6 text-primary" />
            🏦 Organization Description
          </DialogTitle>
          <DialogDescription className="text-lg font-semibold text-primary">
            SMART MONEY CASH FLOW (SMCF)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-base leading-relaxed mb-4">
                SMART MONEY CASH FLOW (SMCF) is a registered table banking group based in Kenya, 
                focused on promoting collective financial empowerment and accountability among its members. 
                The group operates on a structured money cycle system where members contribute a fixed 
                amount periodically, and the pooled funds are disbursed to individuals in a rotating manner.
              </p>
              
              <p className="text-base leading-relaxed">
                SMCF emphasizes transparency, discipline, and digital efficiency by incorporating 
                mobile money solutions (M-PESA) and a web-based system for tracking payments, 
                managing contributions, and automating disbursements. The organization supports 
                its members in achieving short-term financial goals while building long-term 
                saving and investment habits.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Users className="w-8 h-8 text-primary mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Collective Empowerment</h4>
                <p className="text-sm text-muted-foreground">
                  Members work together to achieve financial goals through structured contributions
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <Target className="w-8 h-8 text-accent mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Structured System</h4>
                <p className="text-sm text-muted-foreground">
                  Rotating disbursement system ensures fair distribution of pooled funds
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <Shield className="w-8 h-8 text-financial-success mx-auto mb-3" />
                <h4 className="font-semibold mb-2">Digital Efficiency</h4>
                <p className="text-sm text-muted-foreground">
                  M-PESA integration and web-based tracking for transparency and accountability
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-primary mb-3">Key Benefits</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-financial-success">•</span>
                  <span>Achieve short-term financial goals through collective saving</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-financial-success">•</span>
                  <span>Build long-term saving and investment habits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-financial-success">•</span>
                  <span>Transparent and automated M-PESA transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-financial-success">•</span>
                  <span>Real-time tracking and accountability</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-financial-success">•</span>
                  <span>Registered and regulated table banking group</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationDialog;