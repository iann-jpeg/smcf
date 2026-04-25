import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, Download, Lock } from "lucide-react";
import { exportMembershipCard } from "@/lib/membership-card-pdf";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function MembershipCardPanel({ member }: { member: any }) {
  const isEligible = member?.registration_fee_paid;

  if (!isEligible) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Action Required: Registration Fee</AlertTitle>
          <AlertDescription>
            You must complete your registration payment to unlock and download your official digital membership card.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Official Membership Card
          </CardTitle>
          <CardDescription>
            Your digital membership card is ready. Use this as proof of your active membership.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 border-t pt-6 bg-muted/20">
          {/* Card Preview */}
          <div className="relative w-full max-w-sm aspect-[1.58] bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl overflow-hidden shadow-2xl p-4 sm:p-6 text-white border border-slate-700">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/20 pb-3 mb-4">
              <div>
                <h3 className="text-[#b4963c] font-bold text-sm tracking-widest">SMCF SACCO</h3>
                <p className="text-white/60 text-[10px] uppercase tracking-wider">Official Membership Card</p>
              </div>
              <ShieldCheck className="h-6 w-6 text-[#b4963c]" />
            </div>

            {/* Body */}
            <div className="flex gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-700 rounded-md shrink-0 border border-white/10 flex items-center justify-center overflow-hidden">
                {member.profile_photo ? (
                  <img src={member.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-white/40">PHOTO</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-[9px] text-white/50 uppercase">Name</p>
                  <p className="font-semibold text-sm sm:text-base leading-tight truncate">{member.name}</p>
                </div>
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-[9px] text-white/50 uppercase">ID Number</p>
                    <p className="font-mono text-xs sm:text-sm">{member.member_id}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/50 uppercase">Joined</p>
                    <p className="text-xs sm:text-sm">
                      {member.join_date ? format(new Date(member.join_date), "MMM yyyy") : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-2 bg-[#b4963c]" />
          </div>

          <Button 
            size="lg" 
            onClick={() => exportMembershipCard(member)}
            className="w-full max-w-sm gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
