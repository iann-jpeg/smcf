/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

function openDataUrl(dataUrl: string) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  const blob = new Blob([u8arr], { type: mime });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
import { Link } from "react-router-dom";
import { useMyMember, useMyLoans, useMyRepayments, useMyTransactions, useMySavingsHistory, useMyUnifiedAccount, useMyGuarantorRequests, useRespondToGuarantorRequest } from "@/hooks/useMyAccount";
import { useMyGuaranteedLoans } from "@/hooks/useGuaranteedLoans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Wallet, Landmark, TrendingUp, CreditCard, CalendarCheck, PlusCircle, User, Download, Bell, CheckCheck, Save, Lock, FileText, CalendarIcon, Sparkles, Shield, ShieldCheck, ShieldX, Clock, ArrowRightLeft, Camera, Upload, Eye, Trash2, AlertCircle, Loader2, Smartphone, UsersRound, Target, Trophy } from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Separator } from "@/components/ui/separator";
import { exportMyTransactions, exportMyRepayments, exportMyLoans, exportMyStatement, downloadMembershipForm } from "@/lib/pdf-export";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { GrowthInsightsPopup } from "@/components/GrowthInsightsPopup";
import { TrustScoreCard } from "@/components/TrustScoreCard";
import { GuarantorVisibility } from "@/components/GuarantorVisibility";
import { GrowthDashboardTab } from "@/components/GrowthDashboardTab";
import { DepositSavingsDialog } from "@/components/DepositSavingsDialog";
import { LoanRepaymentDialog } from "@/components/LoanRepaymentDialog";
import { ShareSubscriptionDialog } from "@/components/ShareSubscriptionDialog";
import { ShareTransferDialog } from "@/components/ShareTransferDialog";
import MemberRegistrationFormPanel from "@/components/member/MemberRegistrationFormPanel";
import MembershipCardPanel from "@/components/member/MembershipCardPanel";
import { UnifiedAccountModules } from "@/components/UnifiedAccountModules";
import { FinancialCalendar } from "@/components/FinancialCalendar";
import { NextActionCard } from "@/components/NextActionCard";
import { WalletSummaryVisual } from "@/components/WalletSummaryVisual";
import { CycleProgressVisual } from "@/components/CycleProgressVisual";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberGrowthPanel } from "@/components/MemberGrowthPanel";

function statusVariant(status: string) {
  switch (status) {
    case "paid": case "completed": case "active": case "disbursed": return "default" as const;
    case "pending": return "outline" as const;
    case "overdue": case "defaulted": return "destructive" as const;
    default: return "secondary" as const;
  }
}

const profileSchema = z.object({
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters").optional().or(z.literal("")),
});

export default function MyAccount() {
  const { data: rawMember, isLoading: memberLoading } = useMyMember();
  const member = rawMember as any;
  const { data: loans = [] } = useMyLoans(member?.id);
  const { data: repayments = [] } = useMyRepayments(member?.id);
  const { data: transactions = [] } = useMyTransactions(member?.id);
  const { data: savingsHistory = [] } = useMySavingsHistory(member?.id);
  const { data: unifiedAccount, isLoading: unifiedAccountLoading } = useMyUnifiedAccount();
  const { data: notifications = [], unreadCount } = useNotifications();
  const { data: guaranteedLoans = [], isLoading: guaranteedLoading } = useMyGuaranteedLoans(member?.id);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const queryClient = useQueryClient();
  const { data: guarantorRequests = [] } = useMyGuarantorRequests();
  const respondToGuarantor = useRespondToGuarantorRequest();
  const pendingGuarantorCount = (guarantorRequests as any[]).filter((r) => r.consent_status === 'pending').length;
  const { data: nextActionData } = useQuery({
    queryKey: ["member-next-action"],
    queryFn: () => api.get<{ action?: { title: string; description: string; href: string }; profileComplete?: boolean }>("/dashboard/member-next-action"),
    enabled: Boolean(rawMember),
    staleTime: 60_000,
  });
  const { data: calendarData } = useQuery({
    queryKey: ["financial-calendar"],
    queryFn: () => api.get<any[]>("/calendar-events"),
    enabled: Boolean(rawMember),
    staleTime: 120_000,
  });
  const { data: tenXProgress } = useQuery({
    queryKey: ["tenx-progress"],
    queryFn: () => api.get<any>("/tenx/progress"),
    enabled: Boolean(rawMember),
    staleTime: 60_000,
  });
  const [calendarNoticeOpen, setCalendarNoticeOpen] = useState(false);

  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositType, setDepositType] = useState<"wallet" | "savings" | "cycle" | "tenx">("savings");
  const [repayLoan, setRepayLoan] = useState<any | null>(null);
  const [historyLoanId, setHistoryLoanId] = useState<string | null>(null);
  const [shareSubscribeOpen, setShareSubscribeOpen] = useState(false);
  const [shareTransferOpen, setShareTransferOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const regFeePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const regFeeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [regFeeProcessing, setRegFeeProcessing] = useState(false);
  const [regFeeCheckoutId, setRegFeeCheckoutId] = useState<string | null>(null);
  const [regFeePaymentMethod, setRegFeePaymentMethod] = useState<"mpesa" | "card">("mpesa");

  useEffect(() => {
    if (!rawMember || !Array.isArray(calendarData) || calendarData.length === 0) return;
    setCalendarNoticeOpen(true);
  }, [rawMember, calendarData]);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [extProfile, setExtProfile] = useState<{
    name: string; nationalId: string; dateOfBirth: string;
    gender: string; county: string; occupation: string; employer: string;
  } | null>(null);
  const [savingExt, setSavingExt] = useState(false);

  // Document upload states
  const [uploadingDoc, setUploadingDoc] = useState<Record<string, boolean>>({});
  const docRefs = {
    docIdCopy: useRef<HTMLInputElement>(null),
    docPassportPhoto: useRef<HTMLInputElement>(null),
    docMembershipForm: useRef<HTMLInputElement>(null),
    docKraPinCertificate: useRef<HTMLInputElement>(null),
  };
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [declineNote, setDeclineNote] = useState<Record<string, string>>({});

  const { data: repaymentHistoryData, isLoading: repaymentHistoryLoading } = useQuery({
    queryKey: ["repayment-history", historyLoanId],
    queryFn: async () => {
      if (!historyLoanId) return null;
      return api.get(`/repayments/loan/${historyLoanId}/history`);
    },
    enabled: !!historyLoanId,
  });

  const { data: systemConfig } = useQuery({
    queryKey: ["system-config"],
    queryFn: async () => api.get("/config"),
  });

  const { data: shareCapitalDividendsData } = useQuery({
    queryKey: ["my-share-capital-dividends", member?.id],
    queryFn: async () => api.get("/share-capital-dividends/member/me"),
    enabled: !!member?.id,
  });

  const stopRegFeePolling = () => {
    if (regFeePollRef.current) {
      clearInterval(regFeePollRef.current);
      regFeePollRef.current = null;
    }
    if (regFeeTimeoutRef.current) {
      clearTimeout(regFeeTimeoutRef.current);
      regFeeTimeoutRef.current = null;
    }
  };

  // Initialize form fields from member data
  const currentPhone = phone ?? member?.phone ?? "";
  const currentEmail = email ?? member?.email ?? "";

  // Handle tab navigation with smooth scroll
  useEffect(() => {
    if (tabsContainerRef.current) {
      // Scroll the tabs container into view with smooth behavior
      const headerOffset = 80; // Account for any fixed headers
      const elementPosition = tabsContainerRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "repayment-history") return;
    if (!historyLoanId && loans.length > 0) {
      setHistoryLoanId(loans[0].id);
    }
  }, [activeTab, historyLoanId, loans]);

  useEffect(() => {
    return () => {
      stopRegFeePolling();
    };
  }, []);

  const registrationFeePaid = Boolean((member as any)?.registration_fee_paid);
  const registrationFeeAmount = Number((member as any)?.registration_fee_amount ?? 100);
  const registrationPaymentAmount = registrationFeeAmount + 10;
  const registrationFeeMpesaCode = (member as any)?.registration_fee_mpesa_code as string | null;
  const registrationFeeDate = (member as any)?.registration_fee_date as string | null;
  const sharePurchaseEnabled = (systemConfig as any)?.sharePurchaseEnabled !== false;
  const sharePurchaseDisabledMessage = "Share purchases are currently disabled by the SACCO administrator.";

  const handleRegistrationFeePayment = async () => {
    if (!member?.id) return;
    if (registrationFeePaid) return;

    setRegFeeProcessing(true);
    try {
      const response = regFeePaymentMethod === "card"
        ? await api.post('/pesapal/orders', {
            memberId: member.id,
            amount: registrationPaymentAmount,
            purpose: 'registration_fee',
          }) as any
        : await api.post('/mpesa/registration-fee/initiate', {
            memberId: member.id,
            phone: member.phone || currentPhone || undefined,
          }) as any;

      const order = response?.data ?? response;
      if (regFeePaymentMethod === "card" && order.redirectUrl) {
        window.location.assign(String(order.redirectUrl));
        return;
      }
      const checkoutId = String(order?.checkoutRequestId || '');
      if (!checkoutId) {
        throw new Error('Could not start registration fee payment. Try again.');
      }

      setRegFeeCheckoutId(checkoutId);

      regFeePollRef.current = setInterval(async () => {
        try {
          const status = regFeePaymentMethod === "card"
            ? await api.get(`/pesapal/orders/${encodeURIComponent(checkoutId)}/status`) as any
            : await api.get(`/mpesa/status/${checkoutId}`) as any;
          const statusData = status?.data ?? status;
          const state = statusData?.status;
          if (state === 'success') {
            stopRegFeePolling();
            setRegFeeProcessing(false);
            toast.success('Registration fee payment verified successfully');
            queryClient.invalidateQueries({ queryKey: ['my-member'] });
            queryClient.invalidateQueries({ queryKey: ['members'] });
            queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            return;
          }
          if (state === 'failed') {
            stopRegFeePolling();
            setRegFeeProcessing(false);
            toast.error(statusData?.resultDesc || 'Registration fee payment failed');
          }
        } catch {
          // keep polling on transient errors
        }
      }, 10_000);

      regFeeTimeoutRef.current = setTimeout(() => {
        stopRegFeePolling();
        setRegFeeProcessing(false);
        toast.error('Payment verification timed out. If you completed payment, refresh shortly.');
      }, 2 * 60 * 1000);
    } catch (err: any) {
      setRegFeeProcessing(false);
      toast.error(err.message || 'Failed to initiate registration fee payment');
    }
  };

  const handleProfileSave = async () => {
    const result = profileSchema.safeParse({ phone: currentPhone, email: currentEmail });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setProfileErrors(errs);
      return;
    }
    setProfileErrors({});
    setSaving(true);
    try {
      const normalizedEmail = String(currentEmail || "").trim().toLowerCase();
      const trimmedPhone = String(currentPhone || "").trim();

      await api.put("/members/me", {
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      });
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["my-member"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      if (member?.id) {
        queryClient.invalidateQueries({ queryKey: ["members", member.id] });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext("2d")!;
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 200, 200);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = e.target!.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      await api.put("/members/me/photo", { photo: dataUrl });
      toast.success("Profile photo updated");
      queryClient.invalidateQueries({ queryKey: ["my-member"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Lazy-initialise extended profile form fields from loaded member data
  const currentExt = extProfile ?? {
    name: member?.name ?? "",
    nationalId: (member as any)?.national_id ?? "",
    dateOfBirth: (member as any)?.date_of_birth
      ? new Date((member as any).date_of_birth).toISOString().split("T")[0]
      : "",
    gender: (member as any)?.gender ?? "",
    county: (member as any)?.county ?? "",
    occupation: (member as any)?.occupation ?? "",
    employer: (member as any)?.employer ?? "",
  };

  const profileCompletionItems = [
    { label: "Profile photo", complete: Boolean(member?.profile_photo) },
    { label: "Full name", complete: Boolean(currentExt.name.trim()) },
    { label: "National ID / Passport", complete: Boolean(currentExt.nationalId.trim()) },
    { label: "Phone number", complete: Boolean(currentPhone.trim()) },
    { label: "Email address", complete: Boolean(currentEmail.trim()) },
    { label: "Date of birth", complete: Boolean(currentExt.dateOfBirth) },
    { label: "Gender", complete: Boolean(currentExt.gender) },
    { label: "County / Physical address", complete: Boolean(currentExt.county.trim()) },
    { label: "Occupation", complete: Boolean(currentExt.occupation.trim()) },
    { label: "Employer / Business name", complete: Boolean(currentExt.employer.trim()) },
  ];
  const completedProfileFields = profileCompletionItems.filter((item) => item.complete).length;
  const profileCompletionPercentage = Math.round((completedProfileFields / profileCompletionItems.length) * 100);
  const missingProfileFields = profileCompletionItems
    .filter((item) => !item.complete)
    .map((item) => item.label);

  const handleExtProfileSave = async () => {
    if (!currentExt.name.trim()) { toast.error("Full name is required"); return; }
    const trimmedPhone = currentPhone.trim();
    const normalizedEmail = currentEmail.trim().toLowerCase();
    const contactValidation = profileSchema.safeParse({
      phone: trimmedPhone,
      email: normalizedEmail || "",
    });
    if (!contactValidation.success) {
      const errs: Record<string, string> = {};
      contactValidation.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setProfileErrors(errs);
      return;
    }
    setProfileErrors({});

    setSavingExt(true);
    try {
      if (trimmedPhone) {
        await api.put("/members/me", { phone: trimmedPhone });
      }
      if (normalizedEmail) {
        await api.put("/members/me", { email: normalizedEmail });
      }

      const payload: Record<string, string> = {
        name: currentExt.name.trim(),
      };
      if (currentExt.nationalId.trim()) payload.nationalId = currentExt.nationalId.trim();
      if (currentExt.dateOfBirth) payload.dateOfBirth = currentExt.dateOfBirth;
      if (currentExt.gender) payload.gender = currentExt.gender;
      if (currentExt.county.trim()) payload.county = currentExt.county.trim();
      if (currentExt.occupation.trim()) payload.occupation = currentExt.occupation.trim();
      if (currentExt.employer.trim()) payload.employer = currentExt.employer.trim();

      await api.put("/members/me/profile", payload);
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["my-member"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      if (member?.id) {
        queryClient.invalidateQueries({ queryKey: ["members", member.id] });
      }
      setExtProfile(null); // reset so it re-initialises from fresh data
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingExt(false);
    }
  };

  const handleDocumentUpload = async (field: string, file: File) => {
    setUploadingDoc((prev) => ({ ...prev, [field]: true }));
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target!.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      await api.put("/members/me/document", { field, data });
      toast.success("Document uploaded");
      queryClient.invalidateQueries({ queryKey: ["my-member"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploadingDoc((prev) => ({ ...prev, [field]: false }));
    }
  };

  if (memberLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={3} className="h-28" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <User className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-heading font-semibold">No Member Account Linked</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Your login is not linked to a member account. Please contact your SACCO administrator to link your account.
        </p>
      </div>
    );
  }

  const activeLoans = loans.filter((l: any) => ["active", "disbursed"].includes(l.status));
  const pendingLoans = loans.filter((l: any) => l.status === "pending");
  const upcomingRepayments = repayments.filter((r: any) => r.status === "pending");
  const overdueRepayments = repayments.filter((r: any) => r.status === "overdue");
  const historyLoan = historyLoanId ? loans.find((l: any) => l.id === historyLoanId) : null;
  const memberShareData = (shareCapitalDividendsData as any) || {};
  const memberSharesOwned = Number(memberShareData.numberOfSharesOwned ?? Number(member?.shares || 0) / 100);
  const memberTotalShareCapital = Number(memberShareData.totalShareCapital ?? member?.shares ?? 0);
  const memberShareProgress = Number(memberShareData.progressTowardMinimumShareCapital ?? Math.min(100, (memberTotalShareCapital / 10000) * 100));
  const memberCurrentDividend = Number(memberShareData.dividendEarnedCurrentPeriod ?? 0);
  const memberContributionHistory = Array.isArray(memberShareData.shareContributionHistory)
    ? memberShareData.shareContributionHistory
    : [];
  const memberDividendHistory = Array.isArray(memberShareData.dividendHistory)
    ? memberShareData.dividendHistory
    : [];
  const activeCycle = unifiedAccount?.cycles?.active;
  const walletHistory = (unifiedAccount?.wallet?.transactions || transactions)
    .slice()
    .reverse()
    .slice(-8)
    .map((item: any) => ({ label: item.processedAt || item.processed_at, amount: Number(item.balance ?? item.amount ?? 0) }));
  const calendarEvents = [
    ...(Array.isArray(calendarData) ? calendarData.map((event: any) => ({
      date: event.startsAt,
      label: event.title,
      amount: event.amount == null ? undefined : Number(event.amount),
      tone: event.type === "loan_repayment" ? "warning" as const : event.type === "notice" ? "default" as const : "success" as const,
    })) : []),
    ...upcomingRepayments.slice(0, 3).filter((item: any) => item.due_date).map((item: any) => ({ date: item.due_date, label: "Loan repayment due", amount: Number(item.amount || item.installment_amount || 0), tone: "warning" as const })),
    ...(activeCycle?.endDate || activeCycle?.end_date ? [{ date: activeCycle.endDate || activeCycle.end_date, label: `Cycle #${activeCycle.cycleNumber || activeCycle.cycle_number || ""} closes`, tone: "default" as const }] : []),
  ];
  const managedCalendarEvents = Array.isArray(calendarData)
    ? calendarData
      .filter((event: any) => event?.startsAt)
      .sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    : [];

  return (
    <div className="space-y-6">
      <Dialog open={calendarNoticeOpen} onOpenChange={setCalendarNoticeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Upcoming SMCF dates
            </DialogTitle>
            <DialogDescription>
              Your SACCO administrator has added the following dates and events to your financial calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {managedCalendarEvents.map((event: any) => (
              <div key={event._id || `${event.title}-${event.startsAt}`} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.startsAt), "EEEE, dd MMMM yyyy")}
                      {event.endsAt ? ` - ${format(new Date(event.endsAt), "dd MMMM yyyy")}` : ""}
                    </p>
                  </div>
                  {event.amount != null && (
                    <span className="shrink-0 text-sm font-semibold">
                      KES {Number(event.amount).toLocaleString()}
                    </span>
                  )}
                </div>
                {event.description && <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {/* Compact member command-center header */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <MemberAvatar name={member.name} photo={member.profile_photo} size="md" />
          <div>
            <h1 className="font-heading text-xl font-bold sm:text-2xl">
              Good morning, {member.name?.split(" ")[0] || "Member"} 👋
            </h1>
            <p className="text-sm text-muted-foreground">Your SMCF financial journey · Member ID: {member.member_id}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {registrationFeePaid && <Badge className="border border-emerald-300 bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100">✓ Verified Member</Badge>}
              {Boolean((unifiedAccount as any)?.tenX?.enrolled) && <Badge variant="secondary" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">10X Member</Badge>}
              {Boolean((unifiedAccount as any)?.cycles?.eligible) && <Badge variant="secondary" className="border-sky-300 bg-sky-50 text-[10px] text-sky-800">Cycle Member</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportMyStatement(member.name, member.member_id, member, loans, repayments, transactions, savingsHistory, { from: dateFrom, to: dateTo })}>
            <FileText className="mr-2 h-4 w-4" /> Full Statement
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSearchParams({ tab: "profile" }, { replace: true })}>More <ArrowRightLeft className="ml-2 h-4 w-4 rotate-90" /></Button>
        </div>
      </div>

      {/* Authoritative position hero: values are read from existing member/account data. */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SMCF member command center</p>
              <CardTitle className="mt-1 font-heading text-2xl">My financial position</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Your verified balances, kept separate for clarity.</p>
            </div>
            <Badge variant="outline" className="gap-1.5 bg-background/70 text-xs"><Clock className="h-3.5 w-3.5" /> Updated just now</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">SACCO savings</p>
              <p className="mt-2 text-2xl font-bold">KES {Number(member?.savings ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs opacity-75">Your savings balance</p>
              <Button size="sm" variant="secondary" className="mt-4 gap-1.5" onClick={() => { setDepositType("savings"); setDepositOpen(true); }}><Save className="h-3.5 w-3.5" /> Save now</Button>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Wallet</p>
              <p className="mt-2 text-2xl font-bold">KES {Number(unifiedAccount?.wallet?.balance ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Available balance</p>
              <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => { setDepositType("wallet"); setDepositOpen(true); }}><Wallet className="h-3.5 w-3.5" /> Deposit</Button>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shares · ownership stake</p>
              <p className="mt-2 text-2xl font-bold">{memberSharesOwned.toLocaleString(undefined, { maximumFractionDigits: 2 })} units</p>
              <p className="mt-1 text-xs text-muted-foreground">Share capital: KES {memberTotalShareCapital.toLocaleString()}</p>
              <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => { if (!sharePurchaseEnabled) { toast.error(sharePurchaseDisabledMessage); return; } setShareSubscribeOpen(true); }} disabled={!sharePurchaseEnabled}><Landmark className="h-3.5 w-3.5" /> Buy shares</Button>
            </div>
            <div className={cn("rounded-2xl border p-4 shadow-sm", Number(member.loan_balance) > 0 ? "border-amber-300 bg-amber-50/60" : "bg-card")}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Loan balance</p>
              <p className="mt-2 text-2xl font-bold">KES {Number(member.loan_balance || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{activeLoans.length} active loan{activeLoans.length === 1 ? "" : "s"}</p>
              <Button asChild size="sm" variant="outline" className="mt-4 gap-1.5"><Link to="/loans/apply"><PlusCircle className="h-3.5 w-3.5" /> Apply for loan</Link></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50/80 via-card to-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700"><Trophy className="h-4 w-4" /> 10X group movement</p>
              <CardTitle className="mt-1 font-heading text-xl">See the group move forward together</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">A transparent view of 10X progress, without exposing other members’ personal payment details.</p>
            </div>
            <Badge variant="outline" className={tenXProgress?.enrolled ? "border-amber-300 bg-amber-100/70 text-amber-800" : ""}>
              {tenXProgress?.enrolled ? "You are enrolled" : "Group progress"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!tenXProgress ? (
            <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-amber-600 p-4 text-white shadow-sm">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100"><UsersRound className="h-3.5 w-3.5" /> Enrolled members</p>
                  <p className="mt-2 text-2xl font-bold">{tenXProgress.group.enrolledMembers}</p>
                  <p className="mt-1 text-xs text-amber-100">Moving as one team</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Target className="h-3.5 w-3.5" /> Current month</p>
                  <p className="mt-2 text-2xl font-bold">{tenXProgress.group.current.paymentRate}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tenXProgress.group.current.paidMembers}/{tenXProgress.group.enrolledMembers} members paid</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Group collected</p>
                  <p className="mt-2 text-2xl font-bold">KES {Number(tenXProgress.group.current.collected || 0).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tenXProgress.group.current.period}</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your status</p>
                  <p className="mt-2 text-lg font-bold">{tenXProgress.enrolled ? tenXProgress.member.status : "Not enrolled"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tenXProgress.enrolled ? `KES ${Number(tenXProgress.member.amountPaid || 0).toLocaleString()} paid this month` : "Ask an administrator to enroll you"}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">This month’s group momentum</span>
                  <span className="font-bold text-amber-700">{tenXProgress.group.current.paymentRate}%</span>
                </div>
                <Progress value={tenXProgress.group.current.paymentRate} className="mt-3 h-3 [&>div]:bg-amber-500" />
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>KES {Number(tenXProgress.group.current.collected || 0).toLocaleString()} collected</span>
                  <span>KES {Number(tenXProgress.group.current.outstanding || 0).toLocaleString()} remaining</span>
                </div>
              </div>

              {Array.isArray(tenXProgress.history) && tenXProgress.history.length > 1 && (
                <div className="mt-5">
                  <p className="mb-3 text-sm font-semibold">Recent group journey</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {tenXProgress.history.slice(0, 3).map((item: any) => (
                      <div key={item.period} className="rounded-xl border bg-background/60 p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{item.period}</span><span className="font-bold text-primary">{item.paymentRate}%</span></div>
                        <Progress value={item.paymentRate} className="mt-2 h-2" />
                        <p className="mt-2 text-xs text-muted-foreground">KES {Number(item.collected || 0).toLocaleString()} collected</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions retain their existing handlers, but now have a clear hierarchy. */}
      <Card className="border-muted shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-heading text-lg font-semibold">Your next move</h2><p className="text-sm text-muted-foreground">Keep your financial journey moving with one focused action.</p></div>
            <Button className="h-11 gap-2 rounded-xl px-6 shadow-md" onClick={() => { setDepositType("savings"); setDepositOpen(true); }}><Save className="h-4 w-4" /> Save now</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { setDepositType("wallet"); setDepositOpen(true); }}><Wallet className="h-4 w-4" /> Wallet deposit</Button>
            <Button variant="outline" className="gap-2" onClick={() => { setDepositType("cycle"); setDepositOpen(true); }}><CalendarCheck className="h-4 w-4" /> Pay cycle</Button>
            <Button variant="outline" className="gap-2" onClick={() => { if (!sharePurchaseEnabled) { toast.error(sharePurchaseDisabledMessage); return; } setShareSubscribeOpen(true); }} disabled={!sharePurchaseEnabled}><Landmark className="h-4 w-4" /> Buy shares</Button>
            <Button asChild variant="ghost" className="gap-2"><Link to="/loans/apply"><PlusCircle className="h-4 w-4" /> Apply for loan</Link></Button>
            <Button variant="ghost" className="gap-2" onClick={() => setShareTransferOpen(true)} disabled={Number(member?.shares) === 0}><ArrowRightLeft className="h-4 w-4" /> Transfer shares</Button>
          </div>
          {!sharePurchaseEnabled && <p className="text-xs text-muted-foreground">Share purchases are currently disabled by the SACCO administrator.</p>}
        </CardContent>
      </Card>

      {/* Date range controls remain available for authoritative statement exports. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statement period</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd MMM yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              Clear
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              const filterDate = (dateStr: string) => {
                const d = new Date(dateStr);
                if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
                if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
                return true;
              };
              const filteredLoans = loans.filter((l: any) => filterDate(l.applied_at || l.created_at));
              const filteredRepayments = repayments.filter((r: any) => filterDate(r.due_date));
              const filteredTransactions = transactions.filter((t: any) => filterDate(t.processed_at));
              const filteredSavings = savingsHistory.filter((s: any) => filterDate(s.month));
              exportMyStatement(member.name, member.member_id, member, filteredLoans, filteredRepayments, filteredTransactions, filteredSavings, { from: dateFrom, to: dateTo });
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            {dateFrom || dateTo ? "Filtered Statement" : "Full Statement"}
          </Button>
        </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <WalletSummaryVisual balance={Number(unifiedAccount?.wallet?.balance ?? 0)} history={walletHistory} />
        <CycleProgressVisual
          cycleNumber={activeCycle?.cycleNumber || activeCycle?.cycle_number}
          paid={Number(activeCycle?.paidMembers || activeCycle?.paid_members || 0)}
          total={Number(activeCycle?.memberCount || activeCycle?.member_count || 0)}
          collected={Number(activeCycle?.memberContribution || activeCycle?.member_contribution || 0)}
        />
        <NextActionCard
          title={nextActionData?.action?.title || "Next best action"}
          description={nextActionData?.action?.description || (overdueRepayments.length > 0 ? `You have ${overdueRepayments.length} overdue repayment${overdueRepayments.length === 1 ? "" : "s"}.` : "Your account is up to date. Keep building your savings habit.")}
          actionLabel="Take action"
          href={nextActionData?.action?.href}
          onAction={() => setSearchParams({ tab: overdueRepayments.length > 0 ? "repayments" : "overview" })}
          complete={!nextActionData?.action && overdueRepayments.length === 0 && pendingGuarantorCount === 0}
        />
      </div>
      <FinancialCalendar events={calendarEvents} />
      <MemberGrowthPanel onSave={() => { setDepositType("savings"); setDepositOpen(true); }} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Share Capital & Dividends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Number of Shares Owned</p>
              <p className="font-semibold">{memberSharesOwned.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total Share Capital</p>
              <p className="font-semibold">KES {memberTotalShareCapital.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Progress to Minimum (KES 10,000)</p>
              <p className="font-semibold">{memberShareProgress.toFixed(1)}%</p>
              <Progress className="mt-2 h-2" value={Math.min(100, memberShareProgress)} />
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Current Period Dividend</p>
              <p className="font-semibold">KES {memberCurrentDividend.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Share Contribution History</CardTitle>
              </CardHeader>
              <CardContent className="max-h-56 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberContributionHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">No share contributions found.</TableCell>
                      </TableRow>
                    ) : (
                      memberContributionHistory.slice(0, 10).map((item: any) => (
                        <TableRow key={item._id || `${item.contributionDate}-${item.amount}`}>
                          <TableCell>{item.contributionDate ? new Date(item.contributionDate).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-right">KES {Number(item.amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === "approved" ? "default" : "outline"}>{item.status || "pending"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Dividend History</CardTitle>
              </CardHeader>
              <CardContent className="max-h-56 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberDividendHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">No dividends distributed yet.</TableCell>
                      </TableRow>
                    ) : (
                      memberDividendHistory.slice(0, 10).map((item: any) => (
                        <TableRow key={item._id || `${item.distributionPeriod}-${item.approvedAt}`}>
                          <TableCell>{item.distributionPeriod || "-"}</TableCell>
                          <TableCell className="text-right">KES {Number(item.dividendAmount || 0).toLocaleString()}</TableCell>
                          <TableCell>{item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className={registrationFeePaid ? 'border-green-200 bg-green-50/40' : 'border-green-200 bg-green-50/40'}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <ShieldCheck className={registrationFeePaid ? 'h-4 w-4 text-green-700' : 'h-4 w-4 text-green-600'} />
            Registration Fee
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">KES {registrationPaymentAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Registration fee</span>
            <span>KES {registrationFeeAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Transaction fee</span>
            <span>KES 10</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={registrationFeePaid ? 'default' : 'outline'}>
              {registrationFeePaid ? 'Paid' : 'Not Paid'}
            </Badge>
          </div>
          {registrationFeePaid && registrationFeeMpesaCode && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">M-Pesa Code</span>
              <span className="font-mono text-xs">{registrationFeeMpesaCode}</span>
            </div>
          )}
          {registrationFeePaid && registrationFeeDate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paid On</span>
              <span>{new Date(registrationFeeDate).toLocaleString()}</span>
            </div>
          )}
          {!registrationFeePaid && (
            <div className="pt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={regFeePaymentMethod === "mpesa" ? "default" : "outline"}
                  onClick={() => setRegFeePaymentMethod("mpesa")}
                  disabled={regFeeProcessing}
                  className="gap-2"
                >
                  <Smartphone className="h-4 w-4" /> M-Pesa
                </Button>
                <Button
                  type="button"
                  variant={regFeePaymentMethod === "card" ? "default" : "outline"}
                  onClick={() => setRegFeePaymentMethod("card")}
                  disabled={regFeeProcessing}
                  className="gap-2"
                >
                  <CreditCard className="h-4 w-4" /> Card
                </Button>
              </div>
              <Button onClick={handleRegistrationFeePayment} disabled={regFeeProcessing} className="gap-2">
                {regFeeProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : regFeePaymentMethod === "card" ? <CreditCard className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                {regFeeProcessing ? 'Processing payment...' : 'Pay Now'}
              </Button>
              {regFeeProcessing && regFeeCheckoutId && (
                <p className="text-xs text-muted-foreground">Checkout ID: {regFeeCheckoutId}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert for overdue */}
      {overdueRepayments.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm font-medium text-destructive">
              You have {overdueRepayments.length} overdue repayment{overdueRepayments.length > 1 ? "s" : ""}. Please make payment to avoid penalties.
            </p>
          </CardContent>
        </Card>
      )}

      {/* SMCF Trust Score & Guarantor Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrustScoreCard member={member} repayments={repayments} savingsHistory={savingsHistory} transactions={transactions} />
        {guaranteedLoans.length > 0 && (
          <GuarantorVisibility guaranteedLoans={guaranteedLoans} isLoading={guaranteedLoading} />
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">{unreadCount}</Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {notifications.slice(0, 10).map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 rounded-md p-3 text-sm transition-colors ${
                  n.read ? "bg-muted/30" : "bg-primary/5 border border-primary/20"
                }`}
              >
                <div className="flex-1 min-w-0">
                  {n.link ? (
                    <Link to={n.link} className="font-medium hover:underline" onClick={() => !n.read && markRead.mutate(n.id)}>
                      {n.title}
                    </Link>
                  ) : (
                    <p className={`font-medium ${n.read ? "text-muted-foreground" : ""}`}>{n.title}</p>
                  )}
                  <p className="text-muted-foreground text-xs mt-0.5">{n.message}</p>
                  <p className="text-muted-foreground/60 text-[10px] mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <Button variant="ghost" size="sm" className="shrink-0 h-7 text-xs" onClick={() => markRead.mutate(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div ref={tabsContainerRef}>
        <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm w-full">
          <TabsTrigger
            value="repayments"
            className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none"
          >
            <span className="hidden sm:inline">Repayments</span>
            <span className="sm:hidden">Pay</span>
            {upcomingRepayments.length > 0 && (
              <Badge variant="outline" className="ml-2 text-[10px] border-current">{upcomingRepayments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="repayment-history" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <span className="hidden sm:inline">Repayment History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
          <TabsTrigger value="loans" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <span className="hidden sm:inline">My Loans</span>
            <span className="sm:hidden">Loans</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <span className="hidden sm:inline">Transactions</span>
            <span className="sm:hidden">Trans</span>
          </TabsTrigger>
          <TabsTrigger value="savings" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <span className="hidden sm:inline">Savings History</span>
            <span className="sm:hidden">Save</span>
          </TabsTrigger>
          <TabsTrigger value="wallet-cycles" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <Wallet className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wallet & Cycles</span>
            <span className="sm:hidden">Wallet</span>
          </TabsTrigger>
          <TabsTrigger value="growth" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Growth</span>
            <span className="sm:hidden">Grow</span>
          </TabsTrigger>
          <TabsTrigger value="guarantors" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <Shield className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Guarantor Requests</span>
            <span className="sm:hidden">Guar</span>
            {pendingGuarantorCount > 0 && <Badge variant="outline" className="ml-1 text-[10px] border-current">{pendingGuarantorCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="registration-form" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
            <FileText className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Registration Form</span>
            <span className="sm:hidden">Form</span>
          </TabsTrigger>
            <TabsTrigger value="membership-card" className="rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1 sm:flex-none">
              <Shield className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">ID Card</span>
              <span className="sm:hidden">Card</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader><CardTitle className="font-heading text-lg">Quick actions</CardTitle><p className="text-sm text-muted-foreground">Keep your financial life moving from one place.</p></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <Button className="justify-start gap-2" onClick={() => { setDepositType("savings"); setDepositOpen(true); }}><Wallet className="h-4 w-4" /> Deposit Savings</Button>
                  <Button variant="outline" className="justify-start gap-2" onClick={() => setShareSubscribeOpen(true)} disabled={!sharePurchaseEnabled}><Landmark className="h-4 w-4" /> Buy Shares</Button>
                  <Button asChild variant="outline" className="justify-start gap-2"><Link to="/loans/apply"><PlusCircle className="h-4 w-4" /> Apply for Loan</Link></Button>
                  <Button variant="outline" className="justify-start gap-2" onClick={() => { const activeLoan = activeLoans[0]; if (activeLoan) setRepayLoan(activeLoan); else setSearchParams({ tab: "repayments" }); }}><CreditCard className="h-4 w-4" /> Make Repayment</Button>
                  <Button variant="outline" className="justify-start gap-2" onClick={() => setSearchParams({ tab: "wallet-cycles" })}><CalendarCheck className="h-4 w-4" /> Open Wallet & Cycles</Button>
                  <Button variant="outline" className="justify-start gap-2" onClick={() => setSearchParams({ tab: "transactions" })}><ArrowRightLeft className="h-4 w-4" /> View Transactions</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="font-heading text-lg">Recent activity</CardTitle><p className="text-sm text-muted-foreground">Your latest account movements.</p></CardHeader>
                <CardContent className="space-y-2">
                  {(unifiedAccount?.wallet?.transactions || transactions).slice(0, 5).length === 0 ? <p className="py-4 text-sm text-muted-foreground">Your transactions will appear here.</p> : (unifiedAccount?.wallet?.transactions || transactions).slice(0, 5).map((transaction: any) => <div key={String(transaction._id || transaction.id || transaction.transaction_ref)} className="flex items-center justify-between border-b py-2 last:border-0"><div><p className="text-sm font-medium capitalize">{transaction.cycleNumber || transaction.cycle_number ? `Cycle ${transaction.cycleNumber || transaction.cycle_number} contribution` : String(transaction.type || "transaction").replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{transaction.processedAt || transaction.processed_at ? new Date(transaction.processedAt || transaction.processed_at).toLocaleDateString() : "-"}</p></div><div className="text-right"><p className="text-sm font-semibold">KES {Number(transaction.amount || 0).toLocaleString()}</p><Badge variant={transaction.status === "completed" ? "default" : "outline"}>{transaction.status || "-"}</Badge></div></div>)}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="shares" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg">Shares & Dividends</CardTitle><p className="text-sm text-muted-foreground">Your share capital, contribution history, and dividend record.</p></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Shares owned</p><p className="mt-1 text-2xl font-semibold">{memberSharesOwned.toLocaleString()}</p></div>
                <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Share capital</p><p className="mt-1 text-2xl font-semibold">KES {memberTotalShareCapital.toLocaleString()}</p></div>
                <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Minimum progress</p><p className="mt-1 text-2xl font-semibold">{memberShareProgress.toFixed(1)}%</p><Progress className="mt-2 h-2" value={Math.min(100, memberShareProgress)} /></div>
                <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Current dividend</p><p className="mt-1 text-2xl font-semibold">KES {memberCurrentDividend.toLocaleString()}</p></div>
              </CardContent>
            </Card>
            <Button onClick={() => setShareSubscribeOpen(true)} disabled={!sharePurchaseEnabled}><Landmark className="mr-2 h-4 w-4" /> Buy Shares</Button>
          </TabsContent>

          <TabsContent value="statements" className="space-y-4">
            <Card><CardHeader><CardTitle className="font-heading text-lg">Statement Centre</CardTitle><p className="text-sm text-muted-foreground">Generate a statement from your existing savings, loans, repayments, transactions, and member records.</p></CardHeader><CardContent className="flex flex-wrap gap-3"><Button onClick={() => exportMyStatement(member.name, member.member_id, member, loans, repayments, transactions, savingsHistory, { from: dateFrom, to: dateTo })}><FileText className="mr-2 h-4 w-4" /> Download Statement</Button><Button variant="outline" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} disabled={!dateFrom && !dateTo}>Clear date filters</Button></CardContent></Card>
          </TabsContent>

          {/* Repayments */}
          <TabsContent value="repayments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="font-heading text-lg">Repayment Schedule</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {loans.filter((l: any) => ["active", "disbursed"].includes(l.status) && Number(l.balance) > 0).length > 0 && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
                    onClick={() => {
                      const activeLoan = loans.find((l: any) => ["active", "disbursed"].includes(l.status) && Number(l.balance) > 0);
                      if (activeLoan) setRepayLoan(activeLoan);
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                    Repay Loan via M-Pesa
                  </Button>
                )}
                {repayments.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportMyRepayments(member.name, member.member_id, repayments)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {repayments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No repayments found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan #</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repayments.map((r: any) => {
                      const matchedLoan = loans.find((l: any) => l.id === r.loan_id && ["active", "disbursed"].includes(l.status) && Number(l.balance) > 0);
                      return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.loans?.loan_number ?? "—"}</TableCell>
                        <TableCell>{new Date(r.due_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">KES {Number(r.amount_due).toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {Number(r.amount_paid).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {matchedLoan && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs whitespace-nowrap"
                              onClick={() => setRepayLoan(matchedLoan)}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Pay via M-Pesa
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repayment History */}
        <TabsContent value="repayment-history">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="font-heading text-lg">Repayment History</CardTitle>
                <p className="text-xs text-muted-foreground">View your full repayment schedule and payment transactions.</p>
              </div>
              <div className="w-full sm:max-w-sm">
                <Label htmlFor="history-loan" className="text-xs">Select Loan</Label>
                <select
                  id="history-loan"
                  aria-label="Select loan"
                  title="Select loan"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={historyLoanId ?? ""}
                  onChange={(e) => setHistoryLoanId(e.target.value || null)}
                >
                  <option value="">Choose a loan</option>
                  {loans.map((loan: any) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.loan_number} - KES {Number(loan.principal ?? 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {!historyLoanId ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Select a loan to view repayment history.</p>
              ) : repaymentHistoryLoading ? (
                <div className="py-6"><Skeleton className="h-10 w-full" /></div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="text-lg font-semibold">KES {Number(historyLoan?.balance ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Monthly Installment</p>
                      <p className="text-lg font-semibold">KES {Number(historyLoan?.monthly_installment ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-lg font-semibold capitalize">{historyLoan?.status ?? "—"}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Repayment Schedule</h3>
                    {repaymentHistoryData?.schedule?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Due (KES)</TableHead>
                            <TableHead className="text-right">Paid (KES)</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Paid On</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {repaymentHistoryData.schedule.map((r: any) => (
                            <TableRow key={r._id ?? r.id}>
                              <TableCell>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"}</TableCell>
                              <TableCell className="text-right">{Number(r.amountDue ?? 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right">{Number(r.amountPaid ?? 0).toLocaleString()}</TableCell>
                              <TableCell><Badge variant={statusVariant(String(r.status ?? "pending"))}>{r.status}</Badge></TableCell>
                              <TableCell>{r.paidDate ? new Date(r.paidDate).toLocaleDateString() : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No repayment schedule found.</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Payment Transactions</h3>
                    {repaymentHistoryData?.payments?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Ref</TableHead>
                            <TableHead className="text-right">Amount (KES)</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {repaymentHistoryData.payments.map((p: any) => (
                            <TableRow key={p._id ?? p.id}>
                              <TableCell>{new Date(p.processedAt ?? p.processed_at ?? p.createdAt ?? p.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="font-mono text-xs">{p.transactionRef ?? p.transaction_ref ?? "—"}</TableCell>
                              <TableCell className="text-right">{Number(p.amount ?? 0).toLocaleString()}</TableCell>
                              <TableCell><Badge variant={statusVariant(String(p.status ?? "completed"))}>{p.status ?? "completed"}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No repayment transactions yet.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loans */}
        <TabsContent value="loans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg">My Loans</CardTitle>
              {loans.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportMyLoans(member.name, member.member_id, loans)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No loans yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan #</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Monthly</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan: any) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                        <TableCell className="text-right">KES {Number(loan.principal).toLocaleString()}</TableCell>
                        <TableCell>{loan.interest_rate}% {loan.interest_model}</TableCell>
                        <TableCell>{loan.term_months}mo</TableCell>
                        <TableCell className="text-right font-semibold">KES {Number(loan.balance).toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {Number(loan.monthly_installment).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(loan.status)}>{loan.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {["active", "disbursed"].includes(loan.status) && Number(loan.balance) > 0 && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs whitespace-nowrap"
                              onClick={() => setRepayLoan(loan)}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Pay via M-Pesa
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg">Recent Transactions</CardTitle>
              {transactions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportMyTransactions(member.name, member.member_id, transactions)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn: any) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-xs">{txn.transaction_ref}</TableCell>
                        <TableCell>{new Date(txn.processed_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{txn.type}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(txn.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(txn.status)}>{txn.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Savings History */}
        <TabsContent value="savings">
          {/* Quick deposit callout */}
          <div className="mb-4 rounded-xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30 flex items-center justify-between px-5 py-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Current Savings Balance</p>
                <p className="text-2xl font-bold font-heading text-green-700 dark:text-green-400">
                  KES {Number(member.savings).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2 shrink-0"
              onClick={() => { setDepositType("savings"); setDepositOpen(true); }}
            >
              <Wallet className="h-4 w-4" />
              Deposit via M-Pesa
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Savings Growth</CardTitle>
            </CardHeader>
            <CardContent>
              {savingsHistory.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-sm text-muted-foreground">No savings history yet. Make your first deposit to get started!</p>
                  <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={() => { setDepositType("savings"); setDepositOpen(true); }}>
                    <Wallet className="h-4 w-4" /> Make First Deposit
                  </Button>
                </div>
              ) : (
                <ChartContainer
                  config={{ savings: { label: "Savings (KES)", color: "hsl(var(--primary))" } }}
                  className="h-[300px] w-full"
                >
                  <AreaChart
                    data={savingsHistory.map((s: any) => ({
                      month: new Date(s.month).toLocaleDateString("en-KE", { year: "2-digit", month: "short" }),
                      savings: Number(s.amount),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="savings"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.15)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unified Wallet and Cycles */}
        <TabsContent value="wallet-cycles">
          <UnifiedAccountModules
            data={unifiedAccount}
            isLoading={unifiedAccountLoading}
            memberName={member.name}
            memberId={member.member_id}
            onPayCycle={() => { setDepositType("cycle"); setDepositOpen(true); }}
            onPayTenX={() => { setDepositType("tenx"); setDepositOpen(true); }}
            onDepositSavings={() => { setDepositType("savings"); setDepositOpen(true); }}
          />
        </TabsContent>

        {/* Growth Dashboard */}
        <TabsContent value="growth">
          <GrowthDashboardTab member={member} savingsHistory={savingsHistory} />
        </TabsContent>

        {/* Digital Membership Registration Form */}
        <TabsContent value="registration-form">
          <MemberRegistrationFormPanel member={member} />
        </TabsContent>
  
          {/* Membership Card */}
          <TabsContent value="membership-card">
            <MembershipCardPanel member={member} />
          </TabsContent>

          {/* Profile */}
          <TabsContent value="profile">
            <div className="space-y-6 mt-6">
              <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base flex items-center justify-between gap-3">
                  <span>Profile Completion</span>
                  <Badge variant={profileCompletionPercentage === 100 ? "default" : "outline"}>
                    {profileCompletionPercentage}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={profileCompletionPercentage} className="h-2.5" />
                <p className="text-sm text-muted-foreground">
                  {completedProfileFields} of {profileCompletionItems.length} required profile details completed.
                </p>
                {profileCompletionPercentage < 100 && (
                  <Alert className="border-amber-300/70 bg-amber-50 text-amber-900">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    <AlertTitle>Finish updating your profile</AlertTitle>
                    <AlertDescription>
                      Complete the remaining details to keep your member account accurate.
                      {missingProfileFields.length > 0 ? ` Missing: ${missingProfileFields.join(", ")}.` : ""}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* ── Personal Information ─────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Photo */}
                <div className="space-y-2">
                  <Label>Profile Photo</Label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      title="Click to change photo"
                    >
                      <MemberAvatar name={member.name} photo={member.profile_photo} size="lg" />
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="h-6 w-6 text-white" />
                      </span>
                    </button>
                    <div className="text-sm text-muted-foreground">
                      <p>{uploadingPhoto ? "Uploading…" : "Click the photo to change it"}</p>
                      <p className="text-xs">JPG, PNG or WebP · max 200KB</p>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Upload profile photo"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Member ID</Label>
                    <Input value={member.member_id} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>Date Joined SMCF</Label>
                    <Input
                      value={member.join_date ? new Date(member.join_date as string).toLocaleDateString() : "—"}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-name">Full Name</Label>
                    <Input
                      id="ext-name"
                      value={currentExt.name}
                      onChange={(e) => setExtProfile({ ...currentExt, name: e.target.value })}
                      placeholder="Your full name"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-nid">National ID / Passport Number</Label>
                    <Input
                      id="ext-nid"
                      value={currentExt.nationalId}
                      onChange={(e) => setExtProfile({ ...currentExt, nationalId: e.target.value })}
                      placeholder="e.g. 12345678"
                      maxLength={30}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-phone">Phone Number</Label>
                    <Input
                      id="ext-phone"
                      value={currentPhone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +254712345678"
                      maxLength={20}
                    />
                    {profileErrors.phone && <p className="text-destructive text-xs">{profileErrors.phone}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-email">Email Address</Label>
                    <Input
                      id="ext-email"
                      type="email"
                      value={currentEmail}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. name@example.com"
                      maxLength={255}
                    />
                    {profileErrors.email && <p className="text-destructive text-xs">{profileErrors.email}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-dob">Date of Birth</Label>
                    <Input
                      id="ext-dob"
                      type="date"
                      value={currentExt.dateOfBirth}
                      onChange={(e) => setExtProfile({ ...currentExt, dateOfBirth: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-gender">Gender</Label>
                    <select
                      id="ext-gender"
                      aria-label="Gender"
                      title="Gender"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={currentExt.gender}
                      onChange={(e) => setExtProfile({ ...currentExt, gender: e.target.value })}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-county">Physical Address / County</Label>
                    <Input
                      id="ext-county"
                      value={currentExt.county}
                      onChange={(e) => setExtProfile({ ...currentExt, county: e.target.value })}
                      placeholder="e.g. Nairobi County"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext-occupation">Occupation</Label>
                    <Input
                      id="ext-occupation"
                      value={currentExt.occupation}
                      onChange={(e) => setExtProfile({ ...currentExt, occupation: e.target.value })}
                      placeholder="e.g. Business Owner"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="ext-employer">Employer / Business Name</Label>
                    <Input
                      id="ext-employer"
                      value={currentExt.employer}
                      onChange={(e) => setExtProfile({ ...currentExt, employer: e.target.value })}
                      placeholder="e.g. ABC Company Ltd"
                      maxLength={150}
                    />
                  </div>
                </div>

                <Button onClick={handleExtProfileSave} disabled={savingExt}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingExt ? "Saving…" : "Save Profile"}
                </Button>

                <Separator className="my-2" />

                <h3 className="font-heading font-semibold flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Change Password
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      maxLength={128}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      maxLength={128}
                    />
                  </div>
                </div>
                {passwordError && <p className="text-destructive text-xs">{passwordError}</p>}
                <Button
                  variant="secondary"
                  disabled={changingPassword}
                  onClick={async () => {
                    setPasswordError("");
                    if (newPassword.length < 8) {
                      setPasswordError("Password must be at least 8 characters");
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      setPasswordError("Passwords do not match");
                      return;
                    }
                    setChangingPassword(true);
                    try {
                      await api.put("/auth/change-password", { newPassword });
                      toast.success("Password updated successfully");
                      setNewPassword("");
                      setConfirmPassword("");
                    } catch (err: any) {
                      setPasswordError(err.message || "Failed to update password");
                    } finally {
                      setChangingPassword(false);
                    }
                  }}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  {changingPassword ? "Updating…" : "Update Password"}
                </Button>
              </CardContent>
            </Card>

            {/* ── Documents ────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Documents
                </CardTitle>
                <p className="text-sm text-muted-foreground">Upload your verification documents. Max 500KB per file. Images and PDFs accepted.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Membership form download banner */}
                <div className="flex items-center justify-between rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Membership Application Form</p>
                    <p className="text-xs text-muted-foreground">Complete your form digitally in this account under "Registration Form". Download/print remains optional.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1.5"
                      onClick={() => setSearchParams({ tab: "registration-form" }, { replace: true })}
                    >
                      <FileText className="h-3.5 w-3.5" /> Open Digital Form
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 dark:border-blue-700" onClick={() => downloadMembershipForm()}>
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { field: "docIdCopy", label: "ID Copy", desc: "National ID or Passport scan", key: "doc_id_copy" },
                    { field: "docPassportPhoto", label: "Passport Photo", desc: "Clear passport-size photo", key: "doc_passport_photo" },
                    { field: "docMembershipForm", label: "Signed Membership Form", desc: "Completed and signed form", key: "doc_membership_form" },
                    { field: "docKraPinCertificate", label: "KRA PIN Certificate", desc: "Kenya Revenue Authority PIN cert", key: "doc_kra_pin_certificate" },
                  ] as { field: keyof typeof docRefs; label: string; desc: string; key: string }[]).map(({ field, label, desc, key }) => {
                    const existing = (member as any)[key] as string | null;
                    const isImg = existing?.startsWith("data:image");
                    const isPending = uploadingDoc[field];
                    return (
                      <div key={field} className="rounded-lg border p-4 space-y-3">
                        <div>
                          <p className="font-medium text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        {existing ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="default" className="gap-1">
                              <ShieldCheck className="h-3 w-3" /> Uploaded
                            </Badge>
                            {isImg ? (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openDataUrl(existing)}>
                                <Eye className="h-3 w-3" /> View
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openDataUrl(existing)}>
                                <Download className="h-3 w-3" /> Download
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <ShieldX className="h-3 w-3" /> Not uploaded
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          disabled={isPending}
                          onClick={() => docRefs[field].current?.click()}
                        >
                          {isPending ? (
                            <><Sparkles className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                          ) : (
                            <><Upload className="h-3.5 w-3.5" /> {existing ? "Replace" : "Upload"}</>
                          )}
                        </Button>
                        <input
                          ref={docRefs[field]}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          aria-label={`Upload ${label}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleDocumentUpload(field, file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* Guarantor Requests */}
        <TabsContent value="guarantors">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Guarantor Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(guarantorRequests as any[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Shield className="h-10 w-10 opacity-40" />
                  <p className="text-sm">No guarantor requests yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(guarantorRequests as any[]).map((req) => (
                    <Card key={req.id} className="border">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{req.applicant_name}</p>
                            <p className="text-xs text-muted-foreground">{req.applicant_member_id}</p>
                          </div>
                          {req.consent_status === 'pending' && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              <Clock className="mr-1 h-3 w-3" />Pending
                            </Badge>
                          )}
                          {req.consent_status === 'accepted' && (
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                              <ShieldCheck className="mr-1 h-3 w-3" />Accepted
                            </Badge>
                          )}
                          {req.consent_status === 'rejected' && (
                            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                              <ShieldX className="mr-1 h-3 w-3" />Declined
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Loan #</span><p className="font-medium">{req.loan_number}</p></div>
                          <div><span className="text-muted-foreground">Principal</span><p className="font-medium">KES {req.principal?.toLocaleString()}</p></div>
                          <div><span className="text-muted-foreground">Interest</span><p className="font-medium">{req.interest_rate}% p.a.</p></div>
                          <div><span className="text-muted-foreground">Term</span><p className="font-medium">{req.term_months} months</p></div>
                          <div><span className="text-muted-foreground">Monthly</span><p className="font-medium">KES {req.monthly_installment?.toLocaleString()}</p></div>
                          <div><span className="text-muted-foreground">Guarantee Amount</span><p className="font-medium">KES {req.guarantee_amount?.toLocaleString()}</p></div>
                        </div>
                        {req.consent_status === 'pending' && (
                          <div className="space-y-2 pt-1">
                            <Input
                              placeholder="Decline reason (optional)"
                              value={declineNote[req.id] ?? ""}
                              onChange={(e) => setDeclineNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="text-sm h-8"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled={respondToGuarantor.isPending}
                                onClick={() => respondToGuarantor.mutate({ loanId: req.loan_id, decision: 'accepted' })}
                              >
                                <ShieldCheck className="mr-1 h-3.5 w-3.5" />Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={respondToGuarantor.isPending}
                                onClick={() => respondToGuarantor.mutate({ loanId: req.loan_id, decision: 'rejected', note: declineNote[req.id] })}
                              >
                                <ShieldX className="mr-1 h-3.5 w-3.5" />Decline
                              </Button>
                            </div>
                          </div>
                        )}
                        {req.consent_status !== 'pending' && req.responded_at && (
                          <p className="text-xs text-muted-foreground">Responded on {format(new Date(req.responded_at), 'PPP')}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>

      {/* Financial Growth Intelligence Pop-up */}
      <GrowthInsightsPopup member={member} loans={loans} savingsHistory={savingsHistory} />

      {/* M-Pesa Deposit Dialog */}
      <DepositSavingsDialog
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        memberId={member.id}
        memberPhone={member.phone}
        paymentType={depositType}
        cycleNumber={(unifiedAccount as any)?.cycles?.active?.cycleNumber}
      />

      {/* M-Pesa Loan Repayment Dialog */}
      {repayLoan && (
        <LoanRepaymentDialog
          open={!!repayLoan}
          onClose={() => setRepayLoan(null)}
          loan={{
            id: repayLoan.id,
            loan_number: repayLoan.loan_number,
            balance: Number(repayLoan.balance),
            monthly_installment: Number(repayLoan.monthly_installment),
          }}
          memberPhone={member.phone}
        />
      )}

      {/* Share Subscription Dialog */}
      <ShareSubscriptionDialog
        open={shareSubscribeOpen}
        onClose={() => setShareSubscribeOpen(false)}
        memberId={member.id}
        memberPhone={member.phone}
        currentShares={Number(member.shares)}
      />

      {/* Share Transfer Dialog */}
      <ShareTransferDialog
        open={shareTransferOpen}
        onClose={() => setShareTransferOpen(false)}
        currentShares={Number(member.shares)}
        memberId={member.id}
      />
    </div>
  );
}
