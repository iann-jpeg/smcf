import { useMemo, useState, useRef } from "react";
import { useLoans } from "@/hooks/useLoans";
import { useGuarantors } from "@/hooks/useGuarantors";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, FileCheck, FileClock, Download, Upload, Loader2, ClipboardList, CheckCircle2, Eye, RefreshCw, UserCheck, XCircle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadBrandedPolicyDocument, downloadMembershipForm, downloadProjectProposal } from "@/lib/pdf-export";
import { toast } from "sonner";

type KycFieldKey =
  | "doc_id_copy"
  | "doc_passport_photo"
  | "doc_membership_form"
  | "doc_kra_pin_certificate";

const KYC_FIELD_LABELS: Record<KycFieldKey, string> = {
  doc_id_copy: "National ID / Passport",
  doc_passport_photo: "Passport Photo",
  doc_membership_form: "Signed Membership Form",
  doc_kra_pin_certificate: "KRA PIN Certificate",
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  business_development: "Business Development Loan",
  education: "Education Loan",
  emergency: "Emergency Loan",
  asset_acquisition: "Asset Acquisition Loan",
  personal: "Personal Loan",
};

function formatLoanType(value?: string) {
  if (!value) return "—";
  return LOAN_TYPE_LABELS[value] ?? value;
}

function formatInterestModel(value?: string) {
  if (!value) return "flat";
  return value === "reducing_balance" ? "reducing" : value;
}

type KycDocument = {
  memberId: string;
  memberName: string;
  field: KycFieldKey;
  label: string;
  dataUrl: string;
  updatedAt?: string | null;
};

type AdminPolicyTemplate = {
  id: string;
  title: string;
  subtitle: string;
  fileName: string;
  lines: string[];
};

const ADMIN_POLICY_TEMPLATES: AdminPolicyTemplate[] = [
  {
    id: "share-capital-policy",
    title: "Share Capital Policy",
    subtitle: "Ownership, limits, and voting framework",
    fileName: "SMCF_Share_Capital_Policy.pdf",
    lines: [
      "SMART MOVES CASHFLOW (SMCF)",
      "SHARE CAPITAL POLICY",
      "",
      "Purpose:",
      "This policy defines the structure, ownership, and management of share capital within SMART MOVES CASHFLOW (SMCF).",
      "",
      "1. Share Value",
      "Each share shall have a fixed value of KES 1,000.",
      "",
      "2. Minimum Shareholding",
      "Each member shall hold a minimum of 10 shares (KES 10,000).",
      "",
      "3. Maximum Shareholding",
      "No member shall own more than 20% of total shares.",
      "",
      "4. Ownership",
      "Shares represent ownership and determine dividend entitlement.",
      "",
      "5. Voting Rights",
      "Each member shall have one vote only, regardless of shares owned.",
      "",
      "6. Share Records",
      "All shares shall be recorded digitally and maintained permanently.",
    ],
  },
  {
    id: "dividend-policy",
    title: "Dividend Distribution Policy",
    subtitle: "Profit allocation and payout framework",
    fileName: "SMCF_Dividend_Distribution_Policy.pdf",
    lines: [
      "SMART MOVES CASHFLOW (SMCF)",
      "DIVIDEND POLICY",
      "",
      "1. Profit Allocation",
      "70% -> Shareholders",
      "20% -> Reserve Fund",
      "10% -> Operations",
      "",
      "2. Calculation Formula",
      "Dividend = (Member Shares / Total Shares) x Dividend Pool",
      "",
      "3. Payment",
      "Dividends shall be credited to member wallets or paid via M-PESA.",
      "",
      "4. Frequency",
      "Declared annually or as approved.",
    ],
  },
  {
    id: "share-purchase-policy",
    title: "Share Purchase Policy",
    subtitle: "Rules for buying shares",
    fileName: "SMCF_Share_Purchase_Policy.pdf",
    lines: [
      "SHARE PURCHASE POLICY",
      "",
      "Members may purchase shares anytime",
      "Payments via M-PESA or bank",
      "Shares recorded instantly",
      "Receipts generated automatically",
    ],
  },
  {
    id: "share-transfer-policy",
    title: "Share Transfer Policy",
    subtitle: "Internal transfer controls",
    fileName: "SMCF_Share_Transfer_Policy.pdf",
    lines: [
      "SHARE TRANSFER POLICY",
      "",
      "Transfers allowed only between members",
      "Requires committee approval",
      "Must be recorded in system",
      "No external transfers allowed",
    ],
  },
  {
    id: "member-exit-policy",
    title: "Member Exit Policy",
    subtitle: "Exit eligibility and settlement",
    fileName: "SMCF_Member_Exit_Policy.pdf",
    lines: [
      "MEMBER EXIT POLICY",
      "",
      "Conditions:",
      "All loans must be cleared",
      "Shares evaluated",
      "",
      "Settlement:",
      "Paid within 30-90 days",
      "",
      "Shares may be:",
      "Bought by SACCO",
      "Transferred",
    ],
  },
  {
    id: "reserve-fund-policy",
    title: "Reserve Fund Policy",
    subtitle: "Sources, usage, and controls",
    fileName: "SMCF_Reserve_Fund_Policy.pdf",
    lines: [
      "RESERVE FUND POLICY",
      "",
      "Sources:",
      "Loan penalties",
      "Withdrawal penalties",
      "% of profits",
      "",
      "Usage:",
      "Cover loan defaults",
      "Emergency support",
      "Financial stability",
      "",
      "Control:",
      "Admin + committee approval required",
    ],
  },
  {
    id: "shareholder-register",
    title: "Shareholder Register",
    subtitle: "Official register template",
    fileName: "SMCF_Shareholder_Register.pdf",
    lines: [
      "SHAREHOLDER REGISTER",
      "No    Name    ID    Phone    Shares    Value    Date Joined    Signature",
    ],
  },
  {
    id: "share-certificate",
    title: "Share Certificate",
    subtitle: "Issuance certificate template",
    fileName: "SMCF_Share_Certificate_Template.pdf",
    lines: [
      "SHARE CERTIFICATE",
      "",
      "This certifies that:",
      "Name: ____________________",
      "Member ID: _______________",
      "",
      "Owns:",
      "________ Shares",
      "Valued at KES ________",
      "",
      "Issued by:",
      "SMART MOVES CASHFLOW (SMCF)",
      "",
      "Date: __________",
      "",
      "Signature: __________",
      "Stamp:",
    ],
  },
  {
    id: "dividend-statement",
    title: "Dividend Statement",
    subtitle: "Member dividend statement template",
    fileName: "SMCF_Dividend_Statement_Template.pdf",
    lines: [
      "DIVIDEND STATEMENT",
      "",
      "Member: __________________",
      "Shares: __________________",
      "",
      "Total Profit: __________",
      "Dividend Pool: __________",
      "",
      "Dividend Earned: __________",
      "",
      "Date: __________",
    ],
  },
  {
    id: "share-summary-report",
    title: "SACCO Share Summary Report",
    subtitle: "High-level share capital summary",
    fileName: "SMCF_Share_Summary_Report_Template.pdf",
    lines: [
      "SHARE SUMMARY REPORT",
      "",
      "Total Members: ______",
      "",
      "Total Shares: ______",
      "",
      "Share Value: ______",
      "",
      "Total Capital: ______",
    ],
  },
  {
    id: "annual-shareholder-report",
    title: "Annual Shareholder Report",
    subtitle: "Annual performance report structure",
    fileName: "SMCF_Annual_Shareholder_Report_Template.pdf",
    lines: [
      "ANNUAL REPORT",
      "Includes:",
      "Member growth",
      "Total savings",
      "Loans issued",
      "Dividends distributed",
      "Reserve fund growth",
    ],
  },
  {
    id: "shareholder-onboarding-form",
    title: "Shareholder Onboarding Form",
    subtitle: "Registration form template",
    fileName: "SMCF_Shareholder_Onboarding_Form_Template.pdf",
    lines: [
      "SHAREHOLDER REGISTRATION FORM",
      "",
      "Name: __________________",
      "ID: __________________",
      "Phone: ________________",
      "",
      "Shares Purchased: ______",
      "",
      "Signature: __________",
    ],
  },
  {
    id: "constitution-clause-shares",
    title: "Constitution Clause (Shares)",
    subtitle: "Official constitution text",
    fileName: "SMCF_Constitution_Clause_Shares.pdf",
    lines: [
      "CONSTITUTION CLAUSE (SHARES)",
      "Each member shall purchase a minimum of 10 shares valued at KES 1,000 each. Shares determine ownership and dividends but not voting rights.",
    ],
  },
  {
    id: "dividend-resolution-letter",
    title: "Dividend Resolution Letter",
    subtitle: "Resolution template for dividend declaration",
    fileName: "SMCF_Dividend_Resolution_Letter_Template.pdf",
    lines: [
      "RESOLUTION",
      "",
      "We, the members of SMART MOVES CASHFLOW, resolve to distribute dividends as per approved policy.",
      "",
      "Chairperson: __________",
      "Secretary: __________",
    ],
  },
  {
    id: "exit-settlement-letter",
    title: "Exit Settlement Letter",
    subtitle: "Member exit settlement template",
    fileName: "SMCF_Exit_Settlement_Letter_Template.pdf",
    lines: [
      "EXIT LETTER",
      "",
      "This confirms that:",
      "",
      "Member: __________",
      "",
      "Has exited and is entitled to:",
      "",
      "Shares Value: ______",
      "Final Settlement: ______",
    ],
  },
  {
    id: "real-estate-partnership-agreement",
    title: "Real Estate Partnership Agreement",
    subtitle: "Renovation & revenue sharing model",
    fileName: "SMCF_Real_Estate_Partnership_Agreement.pdf",
    lines: [
      "# REAL ESTATE PARTNERSHIP AGREEMENT",
      "",
      "## (RENOVATION & REVENUE SHARING MODEL)",
      "",
      "---",
      "",
      "### THIS AGREEMENT",
      "",
      "This Agreement is made on this ___ day of _______***, 20***",
      "",
      "BETWEEN:",
      "",
      "**SMART MOVES CASH FLOW (SMCF)**",
      "P.O. Box: __________________________",
      "(Hereinafter referred to as “the Investor”)",
      "",
      "AND",
      "",
      "**[LANDLORD FULL NAME]**",
      "ID No: __________________________",
      "Address: __________________________",
      "(Hereinafter referred to as \"the Property Owner\")",
      "",
      "---",
      "",
      "### 1. PURPOSE OF AGREEMENT",
      "",
      "The purpose of this Agreement is to establish a partnership where:",
      "",
      "* The Investor (SMCF) will finance renovation and improvement of the Property",
      "* The Property Owner provides the property",
      "* Both parties will share the increased rental income generated from the improvements",
      "",
      "---",
      "",
      "### 2. PROPERTY DETAILS",
      "",
      "Location: __________________________",
      "Property Description: __________________________",
      "Number of Units: __________________________",
      "",
      "---",
      "",
      "### 3. INVESTMENT AMOUNT",
      "",
      "The Investor agrees to invest:",
      "",
      "**KES __________________________**",
      "",
      "For renovation and improvement works on the Property.",
      "",
      "---",
      "",
      "### 4. SCOPE OF RENOVATION",
      "",
      "The renovation shall include (but not limited to):",
      "",
      "* Painting",
      "* Plumbing repairs",
      "* Electrical improvements",
      "* Structural repairs (if applicable)",
      "* Interior upgrades",
      "",
      "Detailed scope may be attached as Appendix A.",
      "",
      "---",
      "",
      "### 5. PROJECT IMPLEMENTATION",
      "",
      "* The Investor shall manage or supervise the renovation",
      "* Work shall be completed within ______ days/months",
      "* Both parties shall agree on major decisions",
      "",
      "---",
      "",
      "### 6. REVENUE SHARING MODEL",
      "",
      "After renovation, rental income shall be handled as follows:",
      "",
      "---",
      "",
      "### OPTION A (Recommended Structure)",
      "",
      "1. The increased rental income (difference between old rent and new rent) shall be calculated monthly",
      "",
      "2. The Investor shall first recover the full investment amount (KES ________) from the increased income",
      "",
      "3. After full recovery, the net increased income shall be shared as follows:",
      "",
      "* Investor (SMCF): ______ %",
      "* Property Owner: ______ %",
      "",
      "---",
      "",
      "### 7. DURATION OF AGREEMENT",
      "",
      "This Agreement shall remain in force for:",
      "",
      "**______ years**",
      "",
      "Starting from the date of completion of renovation.",
      "",
      "---",
      "",
      "### 8. PAYMENT TERMS",
      "",
      "* Rental income shall be collected and recorded transparently",
      "* Monthly statements shall be shared between both parties",
      "* Payments to the Investor shall be made monthly",
      "",
      "---",
      "",
      "### 9. OWNERSHIP",
      "",
      "* The Property remains fully owned by the Property Owner",
      "* The Investor has rights only to:",
      "",
      "  * Investment recovery",
      "  * Revenue share as agreed",
      "",
      "---",
      "",
      "### 10. MAINTENANCE",
      "",
      "* Routine maintenance shall be agreed upon by both parties",
      "* Costs may be shared or deducted from income as agreed",
      "",
      "---",
      "",
      "### 11. TERMINATION",
      "",
      "This Agreement may be terminated if:",
      "",
      "* Either party breaches terms",
      "* Mutual agreement is reached",
      "",
      "In case of termination:",
      "",
      "* Investor must recover outstanding investment",
      "* Settlement terms must be agreed",
      "",
      "---",
      "",
      "### 12. SALE OF PROPERTY",
      "",
      "If the Property Owner sells the property:",
      "",
      "* The Investor must be notified in writing",
      "* The Investor shall:",
      "",
      "  * Recover remaining investment",
      "  * Receive any agreed compensation",
      "",
      "---",
      "",
      "### 13. DISPUTE RESOLUTION",
      "",
      "Any disputes arising shall be resolved through:",
      "",
      "1. Negotiation",
      "2. Mediation",
      "3. Legal process if necessary",
      "",
      "---",
      "",
      "### 14. GENERAL PROVISIONS",
      "",
      "* This Agreement is legally binding",
      "* Any amendments must be in writing",
      "* Both parties agree to act in good faith",
      "",
      "---",
      "",
      "### 15. SIGNATURES",
      "",
      "Signed by:",
      "",
      "---",
      "",
      "**For SMART MOVES CASH FLOW (SMCF)**",
      "",
      "Name: __________________________",
      "Signature: __________________________",
      "Date: __________________________",
      "",
      "---",
      "",
      "**Property Owner**",
      "",
      "Name: __________________________",
      "Signature: __________________________",
      "Date: __________________________",
      "",
      "---",
      "",
      "**Witness 1**",
      "",
      "Name: __________________________",
      "ID No: __________________________",
      "Signature: __________________________",
      "",
      "---",
      "",
      "**Witness 2**",
      "",
      "Name: __________________________",
      "ID No: __________________________",
      "Signature: __________________________",
      "",
      "---",
      "",
      "**END OF AGREEMENT**",
    ],
  },
  {
    id: "events-unit-business-plan",
    title: "Events Unit Business Plan",
    subtitle: "SMCF Events unit strategy and revenue model",
    fileName: "SMCF_Events_Unit_Business_Plan.pdf",
    lines: [
      "# SMART MOVES CASH FLOW (SMCF)",
      "",
      "## EVENTS UNIT BUSINESS PLAN",
      "",
      "---",
      "",
      "# 1. EXECUTIVE SUMMARY",
      "",
      "SMART MOVES CASH FLOW (SMCF) Events Unit is a structured business arm of SMCF focused on providing **event equipment for hire**, including tents, chairs, tables, and sound systems.",
      "",
      "The unit aims to generate **consistent monthly cash flow**, support SACCO growth, and create a scalable asset-based business.",
      "",
      "---",
      "",
      "# 2. BUSINESS OBJECTIVES",
      "",
      "* Generate steady monthly income for SMCF",
      "* Build a portfolio of income-generating assets",
      "* Provide affordable event solutions in local markets",
      "* Create employment opportunities (setup crew)",
      "* Reinvest profits into SACCO growth and member benefits",
      "",
      "---",
      "",
      "# 3. SERVICES OFFERED",
      "",
      "### Core Services:",
      "",
      "* Tent hire",
      "* Chair hire",
      "* Table hire",
      "* Sound system hire",
      "",
      "---",
      "",
      "### Future Expansion:",
      "",
      "* Event décor",
      "* Lighting systems",
      "* Stage setup",
      "* Full event management",
      "",
      "---",
      "",
      "# 4. TARGET MARKET",
      "",
      "Primary customers:",
      "",
      "* Wedding organizers",
      "* Funeral committees",
      "* Churches",
      "* Schools",
      "* Event planners",
      "* Local communities",
      "",
      "---",
      "",
      "### Key Locations:",
      "",
      "* Athi River",
      "* Kitengela",
      "* Embakasi",
      "* Ruai",
      "",
      "These areas have **high event frequency and growing populations**.",
      "",
      "---",
      "",
      "# 5. MARKET OPPORTUNITY",
      "",
      "Events occur every weekend and frequently during weekdays.",
      "",
      "Demand drivers:",
      "",
      "* Cultural ceremonies",
      "* Religious gatherings",
      "* Social functions",
      "* Political events",
      "",
      "👉 This creates a **consistent and repeatable income stream**",
      "",
      "---",
      "",
      "# 6. BUSINESS MODEL",
      "",
      "SMCF purchases event equipment and rents it out per event.",
      "",
      "Revenue sources:",
      "",
      "* Daily rental charges",
      "* Package pricing (tent + chairs + sound)",
      "* Repeat bookings",
      "",
      "---",
      "",
      "# 7. STARTUP REQUIREMENTS",
      "",
      "### Initial Assets:",
      "",
      "* 1 Medium Tent",
      "* 100 Plastic Chairs",
      "* 10 Tables",
      "* 1 Basic Sound System",
      "",
      "---",
      "",
      "### Estimated Startup Cost:",
      "",
      "👉 KES 150,000 – 250,000",
      "",
      "---",
      "",
      "# 8. PRICING STRATEGY",
      "",
      "### Chairs:",
      "",
      "KES 10 – 20 per chair",
      "",
      "---",
      "",
      "### Tent:",
      "",
      "KES 3,000 – 10,000 per event",
      "",
      "---",
      "",
      "### Tables:",
      "",
      "KES 200 – 500 per table",
      "",
      "---",
      "",
      "### Sound System:",
      "",
      "KES 3,000 – 8,000 per event",
      "",
      "---",
      "",
      "### Package Example:",
      "",
      "Tent + Chairs + Tables + Sound",
      "👉 KES 10,000 – 20,000 per event",
      "",
      "---",
      "",
      "# 9. REVENUE PROJECTIONS",
      "",
      "### Conservative Estimate:",
      "",
      "* 4 events/month",
      "* Average revenue per event: KES 12,000",
      "",
      "👉 Monthly Revenue: ~KES 48,000",
      "",
      "---",
      "",
      "### Growth Potential:",
      "",
      "* 8–12 events/month",
      "  👉 KES 100,000+ monthly",
      "",
      "---",
      "",
      "# 10. COST STRUCTURE",
      "",
      "### Fixed Costs:",
      "",
      "* Equipment purchase",
      "* Storage",
      "",
      "---",
      "",
      "### Variable Costs:",
      "",
      "* Transport",
      "* Casual labor",
      "* Maintenance",
      "",
      "---",
      "",
      "# 11. OPERATIONS PLAN",
      "",
      "---",
      "",
      "## Storage:",
      "",
      "* Secure, dry location",
      "* Preferably near target market",
      "",
      "---",
      "",
      "## Transport:",
      "",
      "* Hire pickup or van per job",
      "* Later: invest in own vehicle",
      "",
      "---",
      "",
      "## Workforce:",
      "",
      "* 2–4 casual workers",
      "* Paid per event",
      "",
      "---",
      "",
      "## Booking System:",
      "",
      "* WhatsApp bookings",
      "* Call-based scheduling",
      "* Future: digital booking system",
      "",
      "---",
      "",
      "# 12. MANAGEMENT STRUCTURE",
      "",
      "* Unit Manager (oversees operations)",
      "* Logistics Coordinator",
      "* Finance/Records Manager",
      "* Setup Team",
      "",
      "---",
      "",
      "# 13. MARKETING STRATEGY",
      "",
      "---",
      "",
      "## Channels:",
      "",
      "* WhatsApp groups",
      "* Word of mouth",
      "* Churches & event planners",
      "* Local advertising",
      "",
      "---",
      "",
      "## Strategy:",
      "",
      "* Share photos of setups",
      "* Offer package discounts",
      "* Build strong relationships",
      "",
      "---",
      "",
      "# 14. RISK MANAGEMENT",
      "",
      "---",
      "",
      "## Risks:",
      "",
      "* Equipment damage/loss",
      "* Low bookings",
      "* Mismanagement",
      "* Weather challenges",
      "",
      "---",
      "",
      "## Mitigation:",
      "",
      "* Security deposit",
      "* Proper tracking",
      "* Strong marketing",
      "* Clear responsibility assignment",
      "",
      "---",
      "",
      "# 15. FINANCIAL STRATEGY",
      "",
      "---",
      "",
      "## Funding Options:",
      "",
      "* SACCO pooled funds",
      "* Member investment pool",
      "* External investors",
      "",
      "---",
      "",
      "## Profit Use:",
      "",
      "* Reinvest into more equipment",
      "* Support SACCO operations",
      "* Increase member returns",
      "",
      "---",
      "",
      "# 16. GROWTH PLAN",
      "",
      "---",
      "",
      "## Phase 1:",
      "",
      "* Start with basic equipment",
      "* Test market",
      "",
      "---",
      "",
      "## Phase 2:",
      "",
      "* Increase inventory",
      "* Improve branding",
      "",
      "---",
      "",
      "## Phase 3:",
      "",
      "* Expand services",
      "* Full event solutions",
      "",
      "---",
      "",
      "# 17. EXIT STRATEGY",
      "",
      "* Sell equipment if needed",
      "* Convert into full event company",
      "* Merge with larger event businesses",
      "",
      "---",
      "",
      "# 18. CONCLUSION",
      "",
      "The SMCF Events Unit is a **low-risk, high-demand business** that provides immediate cash flow and supports long-term SACCO growth.",
      "",
      "---",
      "",
      "“From savings… to income… to assets.”",
      "",
      "---",
      "",
      "**END OF DOCUMENT**",
    ],
  },
  {
    id: "real-estate-renovation-business-plan",
    title: "Real Estate Renovation Business Plan",
    subtitle: "SMCF Real Estate investment & renovation model",
    fileName: "SMCF_Real_Estate_Renovation_Business_Plan.pdf",
    lines: [
      "# SMART MOVES CASH FLOW (SMCF)",
      "",
      "## REAL ESTATE RENOVATION INVESTMENT BUSINESS PLAN",
      "",
      "---",
      "",
      "# 1. EXECUTIVE SUMMARY",
      "",
      "SMART MOVES CASH FLOW (SMCF) Real Estate Unit focuses on identifying underperforming rental properties, renovating them, increasing rental income, and sharing the increased revenue with property owners.",
      "",
      "This model generates:",
      "",
      "* Monthly passive income",
      "* Long-term investment returns",
      "* Asset-backed growth for SMCF",
      "",
      "---",
      "",
      "# 2. BUSINESS OBJECTIVES",
      "",
      "* Generate consistent rental-based income",
      "* Build long-term real estate investment portfolio",
      "* Increase SACCO capital through investments",
      "* Create structured partnerships with landlords",
      "* Deliver strong returns to members and investors",
      "",
      "---",
      "",
      "# 3. BUSINESS MODEL",
      "",
      "SMCF operates a **Value-Add Real Estate Model**:",
      "",
      "1. Identify underperforming property",
      "2. Analyze improvement potential",
      "3. Invest in renovation",
      "4. Increase rental income",
      "5. Recover investment",
      "6. Share profits",
      "",
      "---",
      "",
      "# 4. TARGET MARKET",
      "",
      "### Property Types:",
      "",
      "* Old apartments",
      "* Low-rent housing units",
      "* Poorly maintained buildings",
      "* Vacant or underutilized units",
      "",
      "---",
      "",
      "### Target Locations:",
      "",
      "* Athi River",
      "* Kitengela",
      "* Embakasi",
      "* Ruai",
      "",
      "👉 High growth + high rental demand",
      "",
      "---",
      "",
      "# 5. MARKET OPPORTUNITY",
      "",
      "Many landlords:",
      "",
      "* Lack renovation capital",
      "* Accept low rental income",
      "* Have inefficient property use",
      "",
      "👉 SMCF solves this gap by providing capital and expertise",
      "",
      "---",
      "",
      "# 6. SERVICES PROVIDED",
      "",
      "* Property assessment",
      "* Renovation financing",
      "* Project management",
      "* Rental optimization",
      "* Revenue tracking",
      "",
      "---",
      "",
      "# 7. INVESTMENT STRUCTURE",
      "",
      "---",
      "",
      "## Typical Deal Flow:",
      "",
      "* SMCF funds renovation",
      "* Landlord provides property",
      "* Rental income increases",
      "* Increased income is shared",
      "",
      "---",
      "",
      "## Revenue Model Options:",
      "",
      "### Option A (Recommended):",
      "",
      "* Recover investment first",
      "* Then share profit (e.g. 50/50)",
      "",
      "---",
      "",
      "### Option B:",
      "",
      "* Fixed monthly return",
      "",
      "---",
      "",
      "### Option C:",
      "",
      "* Hybrid (recovery + profit share)",
      "",
      "---",
      "",
      "# 8. SAMPLE FINANCIAL MODEL",
      "",
      "---",
      "",
      "## Example:",
      "",
      "Before renovation:",
      "",
      "* Rent = KES 100,000/month",
      "",
      "After renovation:",
      "",
      "* Rent = KES 150,000/month",
      "",
      "Increase:",
      "👉 KES 50,000/month",
      "",
      "---",
      "",
      "## Investment:",
      "",
      "* KES 300,000",
      "",
      "---",
      "",
      "## Outcome:",
      "",
      "* Payback period: ~6 months",
      "* After that:",
      "",
      "  * Monthly profit share begins",
      "",
      "---",
      "",
      "# 9. STARTUP REQUIREMENTS",
      "",
      "---",
      "",
      "## Capital Needed:",
      "",
      "👉 KES 200,000 – 500,000 (first project)",
      "",
      "---",
      "",
      "## Team:",
      "",
      "* Project manager",
      "* Contractor / fundi",
      "* Financial tracker",
      "",
      "---",
      "",
      "## Tools:",
      "",
      "* Budget tracking system",
      "* Profit calculator",
      "* Agreement templates",
      "",
      "---",
      "",
      "# 10. OPERATIONS PLAN",
      "",
      "---",
      "",
      "## Step 1:",
      "",
      "Identify property",
      "",
      "---",
      "",
      "## Step 2:",
      "",
      "Conduct site assessment",
      "",
      "---",
      "",
      "## Step 3:",
      "",
      "Estimate renovation cost",
      "",
      "---",
      "",
      "## Step 4:",
      "",
      "Sign agreement with landlord",
      "",
      "---",
      "",
      "## Step 5:",
      "",
      "Execute renovation",
      "",
      "---",
      "",
      "## Step 6:",
      "",
      "Monitor rental performance",
      "",
      "# 11. MANAGEMENT STRUCTURE",
      "",
      "* Investment Manager",
      "* Project Supervisor",
      "* Finance Officer",
      "* Legal/Documentation support",
      "",
      "---",
      "",
      "# 12. MARKETING STRATEGY",
      "",
      "---",
      "",
      "## Target:",
      "",
      "Landlords",
      "",
      "---",
      "",
      "## Channels:",
      "",
      "* Direct visits",
      "* Referrals",
      "* Real estate agents",
      "* Word of mouth",
      "",
      "---",
      "",
      "## Message:",
      "",
      "“We help you increase rental income without using your own money.”",
      "",
      "---",
      "",
      "# 13. RISK MANAGEMENT",
      "",
      "---",
      "",
      "## Risks:",
      "",
      "* Poor property selection",
      "* Over-budget renovation",
      "* Low rent increase",
      "* Landlord disputes",
      "",
      "---",
      "",
      "## Mitigation:",
      "",
      "* Detailed agreements",
      "* Market analysis",
      "* Budget control",
      "* Start small",
      "",
      "---",
      "",
      "# 14. FINANCIAL STRATEGY",
      "",
      "---",
      "",
      "## Funding Sources:",
      "",
      "* SACCO pooled funds",
      "* Member investment pools",
      "* External investors",
      "",
      "---",
      "",
      "## Profit Allocation:",
      "",
      "* Reinvestment",
      "* SACCO growth",
      "* Member returns",
      "",
      "---",
      "",
      "# 15. GROWTH PLAN",
      "",
      "---",
      "",
      "## Phase 1:",
      "",
      "1–2 pilot properties",
      "",
      "---",
      "",
      "## Phase 2:",
      "",
      "Scale to multiple units",
      "",
      "---",
      "",
      "## Phase 3:",
      "",
      "Build property portfolio",
      "",
      "---",
      "",
      "## Phase 4:",
      "",
      "Acquire own properties",
      "",
      "---",
      "",
      "# 16. EXIT STRATEGY",
      "",
      "* End of contract with landlord",
      "* Move to new projects",
      "* Reinvest profits",
      "* Potential property acquisition",
      "",
      "---",
      "",
      "# 17. COMPETITIVE ADVANTAGE",
      "",
      "SMCF stands out because:",
      "",
      "* Combines SACCO + investment model",
      "* Already has member base",
      "* Focuses on income-generating assets",
      "* Uses structured agreements",
      "",
      "---",
      "",
      "# 18. CONCLUSION",
      "",
      "SMCF Real Estate Unit is a scalable, income-generating investment model that transforms underperforming properties into profitable assets.",
      "",
      "---",
      "",
      "“From contributions… to investments… to financial freedom.”",
      "",
      "---",
      "",
      "**END OF DOCUMENT**",
    ],
  },
];

export default function Documents() {
  const { data: loans = [] } = useLoans();
  const { data: guarantors = [] } = useGuarantors();
  const { data: members = [] } = useMembers();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isStaff = hasRole("admin") || hasRole("credit_officer") || hasRole("treasurer") || hasRole("auditor");

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [kycSearch, setKycSearch] = useState("");
  const [kycCategory, setKycCategory] = useState<KycFieldKey | "all">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Admin: submitted membership forms ──────────────────────────────────
  type SubmissionStatus = "pending" | "approved" | "rejected";
  interface Submission {
    path: string;        // full storage path e.g. submissions/uuid_ts.pdf
    name: string;        // raw filename
    userId: string;
    memberName: string;
    submittedAt: Date;
    ext: string;
    status: SubmissionStatus;
  }

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, SubmissionStatus>>({});

  async function loadSubmissions() {
    setLoadingSubs(true);
    try {
      const { data, error } = await supabase.storage
        .from("membership-forms")
        .list("submissions", { sortBy: { column: "created_at", order: "desc" } });

      if (error) throw error;

      const parsed: Submission[] = (data ?? []).map((f) => {
        // filename: uuid_timestamp.ext  (UUID uses hyphens so first _ is the separator)
        const dotIdx  = f.name.lastIndexOf(".");
        const ext     = dotIdx > -1 ? f.name.slice(dotIdx + 1).toLowerCase() : "file";
        const base    = dotIdx > -1 ? f.name.slice(0, dotIdx) : f.name;
        const sepIdx  = base.indexOf("_");
        const userId  = sepIdx > -1 ? base.slice(0, sepIdx) : base;
        const tsRaw   = sepIdx > -1 ? parseInt(base.slice(sepIdx + 1), 10) : NaN;
        const submittedAt = !isNaN(tsRaw) ? new Date(tsRaw) : new Date(f.created_at ?? Date.now());
        const member  = (members as any[]).find((m: any) => m.id === userId || m.user_id === userId);
        return {
          path: `submissions/${f.name}`,
          name: f.name,
          userId,
          memberName: member?.name ?? userId,
          submittedAt,
          ext,
          status: "pending",
        };
      });

      setSubmissions(parsed);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      if (!msg.includes("Bucket not found") && !msg.includes("bucket")) {
        toast.error("Could not load submissions: " + (msg || "unknown error"));
      }
    } finally {
      setLoadingSubs(false);
    }
  }

  async function openFile(path: string) {
    const { data, error } = await supabase.storage
      .from("membership-forms")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate file link. Try again.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function setStatus(path: string, status: SubmissionStatus) {
    setStatuses((prev) => ({ ...prev, [path]: status }));
  }

  const activeLoans = loans.filter((l: any) => ["active", "disbursed", "approved"].includes(l.status));

  const memberKycDocuments = useMemo<KycDocument[]>(() => {
    const docs: KycDocument[] = [];
    const kycFields = Object.keys(KYC_FIELD_LABELS) as KycFieldKey[];

    (members as any[]).forEach((member) => {
      const memberName = member?.name || member?.username || member?.email || "Unknown Member";
      const memberId = member?.member_id || member?.memberId || member?.id || member?._id || "N/A";

      kycFields.forEach((field) => {
        const value = member?.[field];
        if (typeof value === "string" && value.startsWith("data:")) {
          docs.push({
            memberId: String(memberId),
            memberName,
            field,
            label: KYC_FIELD_LABELS[field],
            dataUrl: value,
            updatedAt: member?.updated_at || member?.updatedAt || null,
          });
        }
      });
    });

    return docs;
  }, [members]);

  const filteredMemberKycDocuments = useMemo(() => {
    const q = kycSearch.trim().toLowerCase();
    if (!q && kycCategory === "all") return memberKycDocuments;
    return memberKycDocuments.filter((doc) => {
      const matchesCategory = kycCategory === "all" || doc.field === kycCategory;
      if (!matchesCategory) return false;
      return (
        doc.memberName.toLowerCase().includes(q) ||
        doc.memberId.toLowerCase().includes(q) ||
        doc.label.toLowerCase().includes(q)
      );
    });
  }, [memberKycDocuments, kycSearch, kycCategory]);

  const stats = useMemo(() => ({
    loanAgreements: loans.length,
    guarantorAgreements: guarantors.length,
    repaymentSchedules: activeLoans.length,
    memberStatements: members.length,
  }), [loans, guarantors, activeLoans, members]);

  async function handleFormUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, or PNG files are accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must not exceed 10 MB.");
      return;
    }

    setUploading(true);
    setUploaded(false);
    try {
      const ext = file.name.split(".").pop();
      const userId = user?.id ?? "anon";
      const path = `submissions/${userId}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("membership-forms")
        .upload(path, file, { upsert: false });

      if (error) throw error;

      setUploaded(true);
      toast.success(
        "Application form submitted! An admin will review and contact you.",
        { duration: 6000 }
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("Bucket not found") || msg.includes("bucket")) {
        toast.error(
          "Document storage is not yet configured. Please email your signed form to admin@smcfsacco.co.ke"
        );
      } else {
        toast.error(msg || "Upload failed. Please try again or contact the SACCO office.");
      }
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openDataUrl(dataUrl: string) {
    window.open(dataUrl, "_blank", "noopener,noreferrer");
  }

  function downloadDataUrl(dataUrl: string, filename = "document") {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Document Engine</h1>
        <p className="text-muted-foreground text-sm">Auto-generated legal and financial documents</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Loan Agreements", count: stats.loanAgreements, icon: FileText, desc: "Auto-generated loan contracts" },
          { title: "Guarantor Agreements", count: stats.guarantorAgreements, icon: FileCheck, desc: "Joint liability guarantee docs" },
          { title: "Repayment Schedules", count: stats.repaymentSchedules, icon: FileClock, desc: "Amortization schedules" },
          { title: "Member Statements", count: stats.memberStatements, icon: FileText, desc: "Account statements" },
        ].map((doc) => (
          <Card key={doc.title} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-accent/10">
                  <doc.icon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-base font-heading">{doc.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{doc.desc}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-heading font-bold">{doc.count.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">documents generated</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail tabs */}
      <Tabs defaultValue={isAdmin ? "admin-docs" : "loans"}>
        <TabsList className="w-full overflow-x-auto whitespace-nowrap justify-start">
          <TabsTrigger value="loans" className="shrink-0">Loan Agreements</TabsTrigger>
          <TabsTrigger value="guarantors" className="shrink-0">Guarantor Agreements</TabsTrigger>
          <TabsTrigger value="schedules" className="shrink-0">Repayment Schedules</TabsTrigger>
          <TabsTrigger value="forms" className="shrink-0">Membership Forms</TabsTrigger>
          {isAdmin && <TabsTrigger value="proposal" className="shrink-0">Project Proposal</TabsTrigger>}
          <TabsTrigger value="admin-docs" className="shrink-0">SACCO Documents (15)</TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading">Loan Agreements</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead><TableHead>Member</TableHead>
                    <TableHead className="text-right">Principal</TableHead><TableHead>Term</TableHead>
                    <TableHead>Type</TableHead><TableHead>Rate</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan: any) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                      <TableCell>{loan.members?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">KES {Number(loan.principal).toLocaleString()}</TableCell>
                      <TableCell>{loan.term_months}mo</TableCell>
                      <TableCell>{formatLoanType(loan.loan_type)}</TableCell>
                      <TableCell>{loan.interest_rate}% {formatInterestModel(loan.interest_model)}</TableCell>
                      <TableCell><Badge variant={loan.status === "active" || loan.status === "completed" ? "default" : loan.status === "defaulted" ? "destructive" : "secondary"}>{loan.status}</Badge></TableCell>
                      <TableCell className="text-sm">{loan.applied_at?.split("T")[0]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guarantors" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading">Guarantor Agreements</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guarantor</TableHead><TableHead>Loan #</TableHead>
                    <TableHead className="text-right">Guarantee Amount</TableHead><TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guarantors.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.members?.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{g.loans?.loan_number ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">KES {Number(g.guarantee_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{g.created_at?.split("T")[0]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading">Repayment Schedules</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead><TableHead>Member</TableHead>
                    <TableHead className="text-right">Monthly Payment</TableHead><TableHead className="text-right">Total Payable</TableHead>
                    <TableHead className="text-right">Balance</TableHead><TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLoans.map((loan: any) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                      <TableCell>{loan.members?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">KES {Number(loan.monthly_installment).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">KES {Number(loan.total_payable).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">KES {Number(loan.balance).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary">{formatLoanType(loan.loan_type)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="proposal" className="mt-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-[#0F172A]/10 dark:bg-[#B89C3C]/10">
                    <FileText className="h-6 w-6 text-[#0F172A] dark:text-[#B89C3C]" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-heading">SMCF SACCO Project Proposal</CardTitle>
                    <p className="text-xs text-muted-foreground">Official document — Admin access only</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Download the official SMCF SACCO Project Proposal document. This comprehensive proposal covers
                  the cooperative's vision, mission, contribution structure, loan services, technology platform,
                  governance, implementation plan, and projected financial sustainability.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Executive Summary &amp; Background</li>
                  <li>Vision, Mission &amp; Objectives</li>
                  <li>Contribution Tiers &amp; Loan Policies</li>
                  <li>Technology &amp; Digital Platform</li>
                  <li>Governance &amp; Implementation Plan</li>
                  <li>Financial Sustainability &amp; Expected Impact</li>
                </ul>
                <Button className="w-full gap-2" onClick={downloadProjectProposal}>
                  <Download className="h-4 w-4" />
                  Download Project Proposal (PDF)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="admin-docs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">SACCO Documents</CardTitle>
              <p className="text-sm text-muted-foreground">
                15 branded policy and form templates available for members and admin to view and download.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ADMIN_POLICY_TEMPLATES.map((template) => (
                  <Card key={template.id} className="border border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-heading">{template.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">{template.subtitle}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        className="w-full gap-2"
                        variant="outline"
                        onClick={() =>
                          downloadBrandedPolicyDocument(
                            template.title,
                            template.fileName,
                            template.lines
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="mt-4" onAnimationStart={isStaff ? loadSubmissions : undefined}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Download card */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-heading">Membership Application Form</CardTitle>
                    <p className="text-xs text-muted-foreground">SMCF-MAF — Printable PDF</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Download the official SMCF SACCO membership application form. Print it out, fill in all sections
                  clearly in block capitals, sign, and submit the completed form via the upload button.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Personal &amp; contact details</li>
                  <li>Employment &amp; income information</li>
                  <li>Share subscription &amp; initial savings</li>
                  <li>Next of kin / beneficiary details</li>
                  <li>Declaration &amp; signature</li>
                </ul>
                <Button
                  className="w-full gap-2"
                  onClick={downloadMembershipForm}
                >
                  <Download className="h-4 w-4" />
                  Download Application Form (PDF)
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <ClipboardList className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-heading">Events Unit Business Plan</CardTitle>
                    <p className="text-xs text-muted-foreground">Printable PDF</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Download the business plan for SMCF Events Unit, including strategy, market, operations and financial model.
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={() => downloadBrandedPolicyDocument(
                    "Events Unit Business Plan",
                    "SMCF_Events_Unit_Business_Plan.pdf",
                    ADMIN_POLICY_TEMPLATES.find(t => t.id === "events-unit-business-plan")?.lines ?? []
                  )}
                >
                  <Download className="h-4 w-4" />
                  Download Events Unit Plan (PDF)
                </Button>
              </CardContent>
            </Card>

            {/* Upload / Submit card */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Upload className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-heading">Submit Signed Form</CardTitle>
                    <p className="text-xs text-muted-foreground">Upload your completed application</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Once you have filled and signed the form, upload a scanned copy or a clear photo here.
                  An admin will review your submission and get in touch.
                </p>

                {uploaded ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      Form submitted successfully!
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      We will review your application and contact you within 2–3 business days.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setUploaded(false)}>
                      Submit Another
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border-2 border-dashed border-border p-6 text-center space-y-3">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                      <div>
                        <p className="text-sm font-medium">Click to select your file</p>
                        <p className="text-xs text-muted-foreground">PDF, JPG, or PNG — max 10 MB</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        aria-label="Upload signed membership application form"
                        title="Upload signed membership application form"
                        className="hidden"
                        onChange={handleFormUpload}
                        disabled={uploading}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="gap-2"
                      >
                        {uploading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</>
                        ) : (
                          <><FileText className="h-4 w-4" />Choose File</>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Alternatively, email your form to{" "}
                      <span className="font-semibold text-foreground">admin@smcfsacco.co.ke</span>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Admin: Submitted Application Forms ──────────────────── */}
          {isStaff && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <h2 className="font-heading font-bold text-lg">Submitted Application Contracts</h2>
                  <Badge variant="secondary" className="ml-1">
                    {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSubmissions}
                  disabled={loadingSubs}
                  className="gap-2"
                >
                  {loadingSubs
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</>
                    : <><RefreshCw className="h-3.5 w-3.5" />Refresh</>}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Signed membership application forms submitted by prospective and existing members.
                Review, approve, or reject each submission below.
              </p>

              <Card>
                <CardContent className="p-0">
                  {loadingSubs ? (
                    <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-sm">Loading submitted forms…</span>
                    </div>
                  ) : submissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                      <FileText className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No membership forms have been submitted yet.</p>
                      <p className="text-xs">Forms will appear here once members upload their signed applications.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member / Submitter</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead>File Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map((sub) => {
                          const currentStatus = statuses[sub.path] ?? sub.status;
                          return (
                            <TableRow key={sub.path}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{sub.memberName}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{sub.userId}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                <div>
                                  <p>{sub.submittedAt.toLocaleDateString("en-KE")}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {sub.submittedAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="uppercase text-[10px] font-mono">
                                  {sub.ext}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {currentStatus === "approved" && (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 gap-1">
                                    <CheckCircle2 className="h-3 w-3" />Approved
                                  </Badge>
                                )}
                                {currentStatus === "rejected" && (
                                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
                                    <XCircle className="h-3 w-3" />Rejected
                                  </Badge>
                                )}
                                {currentStatus === "pending" && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Loader2 className="h-3 w-3" />Pending Review
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    title="View / Download"
                                    onClick={() => openFile(sub.path)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />View
                                  </Button>
                                  {isAdmin && currentStatus !== "approved" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                      onClick={() => {
                                        setStatus(sub.path, "approved");
                                        toast.success(`${sub.memberName}'s application approved.`);
                                      }}
                                    >
                                      <UserCheck className="h-3.5 w-3.5" />Approve
                                    </Button>
                                  )}
                                  {isAdmin && currentStatus !== "rejected" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20"
                                      onClick={() => {
                                        setStatus(sub.path, "rejected");
                                        toast.error(`${sub.memberName}'s application marked as rejected.`);
                                      }}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />Reject
                                    </Button>
                                  )}
                                  {isAdmin && currentStatus !== "pending" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-xs text-muted-foreground"
                                      onClick={() => setStatus(sub.path, "pending")}
                                    >
                                      <RefreshCw className="h-3 w-3" />Reset
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Staff: Member KYC Documents from My Account uploads ───────── */}
          {isStaff && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-blue-500" />
                <h2 className="font-heading font-bold text-lg">Member KYC Documents</h2>
                <Badge variant="secondary" className="ml-1">
                  {filteredMemberKycDocuments.length} document{filteredMemberKycDocuments.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                Documents uploaded by members in My Account are listed here for review and retrieval.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  className="md:col-span-2"
                  placeholder="Search by member name, member ID, or document type"
                  value={kycSearch}
                  onChange={(e) => setKycSearch(e.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={kycCategory}
                  aria-label="Filter KYC documents by type"
                  title="Filter KYC documents by type"
                  onChange={(e) => setKycCategory(e.target.value as KycFieldKey | "all")}
                >
                  <option value="all">All Document Types</option>
                  <option value="doc_id_copy">National ID / Passport</option>
                  <option value="doc_passport_photo">Passport Photo</option>
                  <option value="doc_membership_form">Signed Membership Form</option>
                  <option value="doc_kra_pin_certificate">KRA PIN Certificate</option>
                </select>
              </div>

              <Card>
                <CardContent className="p-0">
                  {filteredMemberKycDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                      <FileText className="h-10 w-10 opacity-30" />
                      <p className="text-sm">
                        {kycSearch.trim() || kycCategory !== "all"
                          ? "No documents matched your search."
                          : "No member KYC documents found yet."}
                      </p>
                      <p className="text-xs">
                        {kycSearch.trim() || kycCategory !== "all"
                          ? "Try a different name, member ID, or document type."
                          : "Uploaded documents from My Account will appear here."}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Document Type</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMemberKycDocuments.map((doc, index) => (
                          <TableRow key={`${doc.memberId}-${doc.field}-${index}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{doc.memberName}</p>
                                <p className="text-xs text-muted-foreground font-mono">{doc.memberId}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{doc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {doc.updatedAt
                                ? new Date(doc.updatedAt).toLocaleString("en-KE", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => openDataUrl(doc.dataUrl)}
                                  title="View"
                                >
                                  <Eye className="h-3.5 w-3.5" />View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() =>
                                    downloadDataUrl(
                                      doc.dataUrl,
                                      `${doc.memberName.replace(/\s+/g, "_")}_${doc.field}`
                                    )
                                  }
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />Download
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
