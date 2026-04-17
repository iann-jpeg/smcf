/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type MemberLike = {
  member_id?: string;
  name?: string;
  phone?: string;
  email?: string;
  profile_photo?: string | null;
  doc_passport_photo?: string | null;
};

type FormState = {
  personalDetails: {
    fullName: string;
    nationalIdOrPassportNo: string;
    dateOfBirth: string;
    gender: string;
    maritalStatus: string;
    nationality: string;
    placeOfBirth: string;
  };
  residentialAddress: {
    physicalAddress: string;
    townCity: string;
    county: string;
    country: string;
    poBox: string;
    postalCode: string;
  };
  contactInformation: {
    primaryMobileMpesa: string;
    alternativePhone: string;
    emailAddress: string;
  };
  employmentBusinessDetails: {
    occupationJobTitle: string;
    monthlyGrossIncomeKes: string;
    employerBusinessName: string;
    workPhoneNo: string;
    employmentStatus: string;
    sourceOfFunds: string;
  };
  bankingDetails: {
    bankName: string;
    branchName: string;
    accountNumber: string;
  };
  shareSubscriptionSavings: {
    noOfSharesSubscribed: string;
    totalShareCapitalKes: string;
    initialSavingsDepositKes: string;
  };
  nextOfKinBeneficiary: {
    fullName: string;
    relationship: string;
    phoneNumber: string;
    nationalIdNo: string;
    physicalAddress: string;
    emailIfAny: string;
  };
  declarationSignature: {
    applicantSignatureName: string;
    dateSigned: string;
  };
};

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function collectMissingFields(form: FormState): string[] {
  const paths: Array<[string, string]> = [
    ["Personal Details: Full Name", form.personalDetails.fullName],
    ["Personal Details: National ID / Passport No.", form.personalDetails.nationalIdOrPassportNo],
    ["Personal Details: Date of Birth", form.personalDetails.dateOfBirth],
    ["Personal Details: Gender", form.personalDetails.gender],
    ["Personal Details: Marital Status", form.personalDetails.maritalStatus],
    ["Personal Details: Nationality", form.personalDetails.nationality],
    ["Personal Details: Place of Birth", form.personalDetails.placeOfBirth],
    ["Residential Address: Physical Address", form.residentialAddress.physicalAddress],
    ["Residential Address: Town / City", form.residentialAddress.townCity],
    ["Residential Address: County", form.residentialAddress.county],
    ["Residential Address: Country", form.residentialAddress.country],
    ["Residential Address: P.O. Box", form.residentialAddress.poBox],
    ["Residential Address: Postal Code", form.residentialAddress.postalCode],
    ["Contact Information: Primary Mobile", form.contactInformation.primaryMobileMpesa],
    ["Contact Information: Alternative Phone", form.contactInformation.alternativePhone],
    ["Contact Information: Email", form.contactInformation.emailAddress],
    ["Employment: Occupation", form.employmentBusinessDetails.occupationJobTitle],
    ["Employment: Monthly Gross Income", form.employmentBusinessDetails.monthlyGrossIncomeKes],
    ["Employment: Employer / Business Name", form.employmentBusinessDetails.employerBusinessName],
    ["Employment: Work Phone", form.employmentBusinessDetails.workPhoneNo],
    ["Employment: Employment Status", form.employmentBusinessDetails.employmentStatus],
    ["Employment: Source of Funds", form.employmentBusinessDetails.sourceOfFunds],
    ["Banking: Bank Name", form.bankingDetails.bankName],
    ["Banking: Branch Name", form.bankingDetails.branchName],
    ["Banking: Account Number", form.bankingDetails.accountNumber],
    ["Share Subscription: No. of Shares", form.shareSubscriptionSavings.noOfSharesSubscribed],
    ["Share Subscription: Total Share Capital", form.shareSubscriptionSavings.totalShareCapitalKes],
    ["Share Subscription: Initial Savings Deposit", form.shareSubscriptionSavings.initialSavingsDepositKes],
    ["Next of Kin: Full Name", form.nextOfKinBeneficiary.fullName],
    ["Next of Kin: Relationship", form.nextOfKinBeneficiary.relationship],
    ["Next of Kin: Phone Number", form.nextOfKinBeneficiary.phoneNumber],
    ["Next of Kin: National ID No.", form.nextOfKinBeneficiary.nationalIdNo],
    ["Next of Kin: Physical Address", form.nextOfKinBeneficiary.physicalAddress],
    ["Next of Kin: Email", form.nextOfKinBeneficiary.emailIfAny],
    ["Declaration: Signature Name", form.declarationSignature.applicantSignatureName],
    ["Declaration: Date Signed", form.declarationSignature.dateSigned],
  ];

  return paths.filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
}

export default function MemberRegistrationFormPanel({ member }: { member: MemberLike }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [passportPhoto, setPassportPhoto] = useState<string>("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialised, setInitialised] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["member-registration-form-me"],
    queryFn: async () => api.get("/registration-forms/me") as any,
  });

  useEffect(() => {
    if (!data || initialised) return;

    const defaults = (data?.formDefaults || {}) as FormState;
    const existingForm = (data?.submission?.form || null) as FormState | null;

    setForm(existingForm || defaults);
    setPassportPhoto(
      String(
        data?.submission?.passportPhoto ||
          data?.memberDefaults?.passportPhoto ||
          member?.profile_photo ||
          member?.doc_passport_photo ||
          ""
      )
    );
    setTermsAccepted(Boolean(data?.submission?.termsAccepted));
    setInitialised(true);
  }, [data, initialised, member?.doc_passport_photo, member?.profile_photo]);

  const hasSubmitted = Boolean(data?.hasSubmitted);
  const submittedAt = data?.submission?.submittedAt ? new Date(data.submission.submittedAt).toLocaleString() : null;
  const submissionStatus = String(data?.submission?.status || "").trim();

  const statusBadgeVariant = useMemo(() => {
    if (submissionStatus === "approved") return "default" as const;
    if (submissionStatus === "rejected") return "destructive" as const;
    return "secondary" as const;
  }, [submissionStatus]);

  const sectionCardClass = "border border-border/70";

  if (isLoading || !form) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading member registration form...
        </CardContent>
      </Card>
    );
  }

  const submitForm = async () => {
    const missing = collectMissingFields(form);
    if (missing.length > 0) {
      toast.error(`Please complete all required fields. Missing: ${missing[0]}`);
      return;
    }

    if (!passportPhoto || !passportPhoto.startsWith("data:image/")) {
      toast.error("Please upload a passport photo before submitting.");
      return;
    }

    if (!termsAccepted) {
      toast.error("Please accept the declaration terms before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/registration-forms/me/submit", {
        form,
        passportPhoto,
        termsAccepted: true,
      });

      toast.success("Registration form submitted successfully. You are good to go.");
      queryClient.invalidateQueries({ queryKey: ["member-registration-form-me"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit registration form");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Membership Application Form (Digital)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fill this form inside your account. This follows the official SMCF membership application format.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Member Name</p>
              <p className="font-medium">{member?.name || data?.memberDefaults?.memberName || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Member ID</p>
              <p className="font-medium">{member?.member_id || data?.memberDefaults?.memberId || "-"}</p>
            </div>
          </div>

          {hasSubmitted ? (
            <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-700">You already submitted your registration form.</p>
                <p className="text-xs text-green-700/80">Submission received {submittedAt || "recently"}.</p>
                <div className="mt-2">
                  <Badge variant={statusBadgeVariant}>{submissionStatus || "submitted"}</Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
              Complete all sections and submit once. Admin will review your details from the SACCO admin panel.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 1: PERSONAL DETAILS</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Full Name (as in National ID / Passport)</Label><Input value={form.personalDetails.fullName} onChange={(e) => setForm({ ...form, personalDetails: { ...form.personalDetails, fullName: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>National ID / Passport No.</Label><Input value={form.personalDetails.nationalIdOrPassportNo} onChange={(e) => setForm({ ...form, personalDetails: { ...form.personalDetails, nationalIdOrPassportNo: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Date of Birth (DD/MM/YYYY)</Label><Input value={form.personalDetails.dateOfBirth} onChange={(e) => setForm({ ...form, personalDetails: { ...form.personalDetails, dateOfBirth: e.target.value } })} disabled={hasSubmitted} /></div>
          <div>
            <Label>Gender</Label>
            <select id="reg-form-gender" title="Gender" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.personalDetails.gender} onChange={(e) => setForm({ ...form, personalDetails: { ...form.personalDetails, gender: e.target.value } })} disabled={hasSubmitted}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <Label>Marital Status</Label>
            <select id="reg-form-marital-status" title="Marital Status" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.personalDetails.maritalStatus} onChange={(e) => setForm({ ...form, personalDetails: { ...form.personalDetails, maritalStatus: e.target.value } })} disabled={hasSubmitted}>
              <option value="">Select</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Divorced">Divorced</option>
            </select>
          </div>
          <div><Label>Nationality</Label><Input value={form.personalDetails.nationality} onChange={(e) => setForm({ ...form, personalDetails: { ...form.personalDetails, nationality: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Place of Birth</Label><Input value={form.personalDetails.placeOfBirth} onChange={(e) => setForm({ ...form, personalDetails: { ...form.personalDetails, placeOfBirth: e.target.value } })} disabled={hasSubmitted} /></div>
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 2: RESIDENTIAL ADDRESS</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Physical Address / Estate / Plot No.</Label><Input value={form.residentialAddress.physicalAddress} onChange={(e) => setForm({ ...form, residentialAddress: { ...form.residentialAddress, physicalAddress: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Town / City</Label><Input value={form.residentialAddress.townCity} onChange={(e) => setForm({ ...form, residentialAddress: { ...form.residentialAddress, townCity: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>County</Label><Input value={form.residentialAddress.county} onChange={(e) => setForm({ ...form, residentialAddress: { ...form.residentialAddress, county: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Country</Label><Input value={form.residentialAddress.country} onChange={(e) => setForm({ ...form, residentialAddress: { ...form.residentialAddress, country: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>P.O. Box</Label><Input value={form.residentialAddress.poBox} onChange={(e) => setForm({ ...form, residentialAddress: { ...form.residentialAddress, poBox: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Postal Code</Label><Input value={form.residentialAddress.postalCode} onChange={(e) => setForm({ ...form, residentialAddress: { ...form.residentialAddress, postalCode: e.target.value } })} disabled={hasSubmitted} /></div>
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 3: CONTACT INFORMATION</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Primary Mobile No. (M-Pesa)</Label><Input value={form.contactInformation.primaryMobileMpesa} onChange={(e) => setForm({ ...form, contactInformation: { ...form.contactInformation, primaryMobileMpesa: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Alternative Phone No.</Label><Input value={form.contactInformation.alternativePhone} onChange={(e) => setForm({ ...form, contactInformation: { ...form.contactInformation, alternativePhone: e.target.value } })} disabled={hasSubmitted} /></div>
          <div className="sm:col-span-2"><Label>Email Address</Label><Input type="email" value={form.contactInformation.emailAddress} onChange={(e) => setForm({ ...form, contactInformation: { ...form.contactInformation, emailAddress: e.target.value } })} disabled={hasSubmitted} /></div>
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 4: EMPLOYMENT / BUSINESS DETAILS</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Occupation / Job Title</Label><Input value={form.employmentBusinessDetails.occupationJobTitle} onChange={(e) => setForm({ ...form, employmentBusinessDetails: { ...form.employmentBusinessDetails, occupationJobTitle: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Monthly Gross Income (KES)</Label><Input value={form.employmentBusinessDetails.monthlyGrossIncomeKes} onChange={(e) => setForm({ ...form, employmentBusinessDetails: { ...form.employmentBusinessDetails, monthlyGrossIncomeKes: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Employer / Business Name</Label><Input value={form.employmentBusinessDetails.employerBusinessName} onChange={(e) => setForm({ ...form, employmentBusinessDetails: { ...form.employmentBusinessDetails, employerBusinessName: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Work Phone No.</Label><Input value={form.employmentBusinessDetails.workPhoneNo} onChange={(e) => setForm({ ...form, employmentBusinessDetails: { ...form.employmentBusinessDetails, workPhoneNo: e.target.value } })} disabled={hasSubmitted} /></div>
          <div>
            <Label>Employment Status</Label>
            <select id="reg-form-employment-status" title="Employment Status" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.employmentBusinessDetails.employmentStatus} onChange={(e) => setForm({ ...form, employmentBusinessDetails: { ...form.employmentBusinessDetails, employmentStatus: e.target.value } })} disabled={hasSubmitted}>
              <option value="">Select</option>
              <option value="Employed">Employed</option>
              <option value="Self-Employed">Self-Employed</option>
              <option value="Business Owner">Business Owner</option>
              <option value="Student">Student</option>
              <option value="Retired">Retired</option>
            </select>
          </div>
          <div><Label>Source of Funds</Label><Input value={form.employmentBusinessDetails.sourceOfFunds} onChange={(e) => setForm({ ...form, employmentBusinessDetails: { ...form.employmentBusinessDetails, sourceOfFunds: e.target.value } })} disabled={hasSubmitted} /></div>
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 5: BANKING DETAILS</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Bank Name</Label><Input value={form.bankingDetails.bankName} onChange={(e) => setForm({ ...form, bankingDetails: { ...form.bankingDetails, bankName: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Branch Name</Label><Input value={form.bankingDetails.branchName} onChange={(e) => setForm({ ...form, bankingDetails: { ...form.bankingDetails, branchName: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Account Number</Label><Input value={form.bankingDetails.accountNumber} onChange={(e) => setForm({ ...form, bankingDetails: { ...form.bankingDetails, accountNumber: e.target.value } })} disabled={hasSubmitted} /></div>
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 6: SHARE SUBSCRIPTION & SAVINGS</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>No. of Shares Subscribed</Label><Input value={form.shareSubscriptionSavings.noOfSharesSubscribed} onChange={(e) => setForm({ ...form, shareSubscriptionSavings: { ...form.shareSubscriptionSavings, noOfSharesSubscribed: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Total Share Capital (KES)</Label><Input value={form.shareSubscriptionSavings.totalShareCapitalKes} onChange={(e) => setForm({ ...form, shareSubscriptionSavings: { ...form.shareSubscriptionSavings, totalShareCapitalKes: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Initial Savings Deposit (KES)</Label><Input value={form.shareSubscriptionSavings.initialSavingsDepositKes} onChange={(e) => setForm({ ...form, shareSubscriptionSavings: { ...form.shareSubscriptionSavings, initialSavingsDepositKes: e.target.value } })} disabled={hasSubmitted} /></div>
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 7: NEXT OF KIN / BENEFICIARY</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Full Name of Next of Kin / Beneficiary</Label><Input value={form.nextOfKinBeneficiary.fullName} onChange={(e) => setForm({ ...form, nextOfKinBeneficiary: { ...form.nextOfKinBeneficiary, fullName: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Relationship</Label><Input value={form.nextOfKinBeneficiary.relationship} onChange={(e) => setForm({ ...form, nextOfKinBeneficiary: { ...form.nextOfKinBeneficiary, relationship: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Phone Number</Label><Input value={form.nextOfKinBeneficiary.phoneNumber} onChange={(e) => setForm({ ...form, nextOfKinBeneficiary: { ...form.nextOfKinBeneficiary, phoneNumber: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>National ID No.</Label><Input value={form.nextOfKinBeneficiary.nationalIdNo} onChange={(e) => setForm({ ...form, nextOfKinBeneficiary: { ...form.nextOfKinBeneficiary, nationalIdNo: e.target.value } })} disabled={hasSubmitted} /></div>
          <div><Label>Email (if any)</Label><Input value={form.nextOfKinBeneficiary.emailIfAny} onChange={(e) => setForm({ ...form, nextOfKinBeneficiary: { ...form.nextOfKinBeneficiary, emailIfAny: e.target.value } })} disabled={hasSubmitted} /></div>
          <div className="sm:col-span-2"><Label>Physical Address of Next of Kin</Label><Textarea value={form.nextOfKinBeneficiary.physicalAddress} onChange={(e) => setForm({ ...form, nextOfKinBeneficiary: { ...form.nextOfKinBeneficiary, physicalAddress: e.target.value } })} disabled={hasSubmitted} /></div>
        </CardContent>
      </Card>

      <Card className={sectionCardClass}>
        <CardHeader><CardTitle className="text-base">SECTION 8: DECLARATION & SIGNATURE</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            I declare that all information provided is true and complete, and I agree to abide by SACCO by-laws, policies, and regulations.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Applicant Signature (Full Name)</Label>
              <Input value={form.declarationSignature.applicantSignatureName} onChange={(e) => setForm({ ...form, declarationSignature: { ...form.declarationSignature, applicantSignatureName: e.target.value } })} disabled={hasSubmitted} />
            </div>
            <div>
              <Label>Date Signed (DD/MM/YYYY)</Label>
              <Input value={form.declarationSignature.dateSigned} onChange={(e) => setForm({ ...form, declarationSignature: { ...form.declarationSignature, dateSigned: e.target.value } })} disabled={hasSubmitted} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Passport Photo</Label>
            {passportPhoto ? (
              <img src={passportPhoto} alt="Passport" className="h-24 w-24 rounded-md object-cover border" />
            ) : (
              <p className="text-xs text-muted-foreground">No passport photo selected yet.</p>
            )}
            {!hasSubmitted && (
              <div>
                <Label htmlFor="reg-passport-photo" className="sr-only">Upload passport photo</Label>
                <input
                  id="reg-passport-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  title="Upload passport photo"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await toDataUrl(file);
                      setPassportPhoto(dataUrl);
                      toast.success("Passport photo attached");
                    } catch (err: any) {
                      toast.error(err.message || "Failed to load passport photo");
                    } finally {
                      e.target.value = "";
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => document.getElementById("reg-passport-photo")?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {passportPhoto ? "Change Photo" : "Upload Photo"}
                </Button>
              </div>
            )}
          </div>

          {!hasSubmitted && (
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I confirm that I have filled in all details correctly and accept the terms and declaration for membership application.
              </span>
            </label>
          )}

          {!hasSubmitted && (
            <div className="flex justify-end">
              <Button onClick={submitForm} disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Submitting..." : "Submit Registration Form"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
