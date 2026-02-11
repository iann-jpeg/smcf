import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";
import { useState } from "react";

interface LoanTermsAgreementProps {
  onAcceptanceChange: (accepted: boolean) => void;
  isAccepted: boolean;
}

const POLICY_VERSION = "SMCF-LOAN-POLICY-2026-01";

const LoanTermsAgreement = ({ onAcceptanceChange, isAccepted }: LoanTermsAgreementProps) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (scrolledToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg border-2 border-primary/20">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-lg text-primary mb-1">
              Mandatory Loan Terms & Conditions
            </h3>
            <p className="text-sm text-muted-foreground">
              You must read and accept these terms before submitting your loan application.
              This agreement is legally binding under Kenyan law.
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Terms */}
      <div className="border-2 border-primary/20 rounded-lg bg-muted/30">
        <div className="bg-primary/5 px-4 py-3 border-b-2 border-primary/20">
          <h4 className="font-bold text-center">
            SMART MONEY CASH FLOW (SMCF)<br />
            LOAN APPLICATION AGREEMENT & DECLARATION
          </h4>
          <p className="text-xs text-center text-muted-foreground mt-1">
            Governed by the Laws of Kenya
          </p>
          <p className="text-xs text-center text-primary font-medium mt-1">
            Policy Version: {POLICY_VERSION}
          </p>
        </div>

        <ScrollArea className="h-[400px] p-4" onScroll={handleScroll}>
          <div className="space-y-4 text-sm pr-4">
            {/* Section 1 */}
            <div>
              <h4 className="font-bold text-base mb-2 text-primary">1. Legal Status</h4>
              <p className="mb-2">
                SMART MONEY CASH FLOW (SMCF) operates as a registered table banking / financial 
                pooling organization within the Republic of Kenya.
              </p>
              <p className="mb-2">All loan agreements are governed by:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The Laws of Kenya</li>
                <li>The Law of Contract Act (Cap 23)</li>
                <li>The Data Protection Act, 2019</li>
                <li>Any applicable financial and civil recovery laws</li>
              </ul>
              <p className="mt-2 font-medium">
                By proceeding, the Member enters into a legally binding agreement with SMCF.
              </p>
            </div>

            {/* Section 2 */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-base mb-2 text-primary">2. Member Declaration</h4>
              <p className="mb-2">I, the undersigned Member, declare that:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>I am an active registered member of SMCF.</li>
                <li>All information provided in this application is true and accurate.</li>
                <li>I understand that providing false information constitutes fraud under Kenyan law.</li>
                <li>I am applying voluntarily and without coercion.</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-base mb-2 text-primary">3. Loan Approval & Disbursement</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Loan approval is not automatic.</li>
                <li>Approval is subject to internal credit assessment and fund availability.</li>
                <li>SMCF reserves absolute discretion to approve, reject, or vary loan terms.</li>
                <li>No funds shall be disbursed until formal approval is granted.</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-base mb-2 text-primary">4. Repayment Obligation</h4>
              <p className="mb-2">I agree that:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The approved loan shall be repaid within the agreed timeline.</li>
                <li>Interest and administrative fees shall apply as per SMCF loan policy.</li>
                <li>Late payments attract penalties as determined by SMCF.</li>
                <li className="font-medium text-destructive">
                  In case of default, SMCF may:
                  <ul className="list-circle pl-5 mt-1 space-y-1 text-foreground font-normal">
                    <li>Deduct from my savings or contributions</li>
                    <li>Engage guarantors</li>
                    <li>Initiate recovery proceedings</li>
                    <li>Report default internally</li>
                    <li>Institute civil recovery proceedings under Kenyan law</li>
                  </ul>
                </li>
              </ul>
            </div>

            {/* Section 5 */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-base mb-2 text-primary">5. Default and Recovery</h4>
              <p className="mb-2 font-medium text-destructive">If I default:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>SMCF may pursue recovery without further notice.</li>
                <li>I shall bear recovery and legal costs incurred.</li>
                <li>Guarantors may be held jointly and severally liable.</li>
              </ul>
            </div>

            {/* Section 6 */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-base mb-2 text-primary">6. Data Protection Compliance</h4>
              <p className="mb-2">
                In accordance with the <strong>Data Protection Act, 2019</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>I consent to the collection and processing of my personal data.</li>
                <li>My data may be used for credit assessment and recovery.</li>
                <li>SMCF shall implement reasonable safeguards to protect my data.</li>
              </ul>
            </div>

            {/* Section 7 */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-base mb-2 text-primary">7. Electronic Agreement</h4>
              <p className="mb-2">I acknowledge that:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Clicking "I Agree" constitutes a legally binding electronic signature.</li>
                <li>This agreement shall be admissible in any legal proceedings.</li>
                <li>My agreement shall be recorded with timestamp and system logs.</li>
              </ul>
            </div>

            {/* Section 8 */}
            <div className="border-t pt-4">
              <h4 className="font-bold text-base mb-2 text-primary">8. Governing Law</h4>
              <p className="mb-2">
                This agreement shall be governed and interpreted under the <strong>Laws of Kenya</strong>.
              </p>
              <p>Disputes shall be resolved within Kenyan jurisdiction.</p>
            </div>

            {/* Final Notice */}
            <div className="border-t pt-4 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border-2 border-amber-500/20">
              <p className="font-bold text-amber-900 dark:text-amber-400 text-center">
                ⚠️ IMPORTANT LEGAL NOTICE ⚠️
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 text-center mt-2">
                By accepting these terms, you are entering into a legally binding contract.
                Your acceptance will be recorded with your IP address, device information,
                and timestamp for legal audit purposes.
              </p>
            </div>

            {/* Scroll indicator */}
            {!hasScrolledToBottom && (
              <div className="sticky bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent pt-8 pb-2 text-center">
                <p className="text-xs text-primary animate-bounce">
                  ↓ Please scroll to read all terms ↓
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Acceptance Checkbox */}
      <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="accept-terms"
            checked={isAccepted}
            onCheckedChange={(checked) => onAcceptanceChange(checked as boolean)}
            className="mt-1"
            disabled={!hasScrolledToBottom}
          />
          <Label
            htmlFor="accept-terms"
            className={`text-sm leading-relaxed cursor-pointer ${
              !hasScrolledToBottom ? 'opacity-50' : ''
            }`}
          >
            <span className="font-bold">I have read and understand</span> the above Loan Application 
            Agreement & Declaration. I agree to be legally bound by these terms and conditions 
            governed by the Laws of Kenya. I acknowledge that this constitutes my electronic signature 
            and consent under the Data Protection Act, 2019.
          </Label>
        </div>
        {!hasScrolledToBottom && (
          <p className="text-xs text-muted-foreground mt-2 ml-7">
            Please scroll through all terms before accepting
          </p>
        )}
      </div>

      {/* Policy Version Footer */}
      <div className="text-center text-xs text-muted-foreground">
        <p>Policy Version: {POLICY_VERSION}</p>
        <p>Effective Date: January 1, 2026</p>
      </div>
    </div>
  );
};

export default LoanTermsAgreement;
