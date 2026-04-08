import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, normalizeMember, normalizeLoan, normalizeTransaction } from "@/lib/api";
import { useAuth } from "./useAuth";

/** Member profile linked to current user */
export function useMyMember() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-member", user?.id],
    queryFn: async () => {
      const res = await api.get("/members/me");
      return normalizeMember(res);
    },
    enabled: !!user?.id,
  });
}

export function useMyLoans(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-loans", memberId],
    queryFn: async () => {
      const res = await api.get(`/loans?memberId=${memberId}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeLoan);
    },
    enabled: !!memberId,
  });
}

export function useMyRepayments(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-repayments", memberId],
    queryFn: async () => {
      const res = await api.get(`/repayments?memberId=${memberId}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map((r: any) => ({
        ...r,
        id: String(r._id ?? r.id),
        loan_id: r.loanId ? String(r.loanId) : (r.loan_id ?? null),
        member_id: r.memberId ? String(r.memberId) : (r.member_id ?? null),
        due_date: r.dueDate ?? r.due_date,
        paid_on: r.paidOn ?? r.paid_on ?? null,
        created_at: r.createdAt ?? r.created_at,
        loans: r.loan ? { loan_number: r.loan.loanNumber ?? r.loan.loan_number } : (r.loans ?? null),
      }));
    },
    enabled: !!memberId,
  });
}

export function useMyTransactions(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-transactions", memberId],
    queryFn: async () => {
      const res = await api.get(`/transactions?memberId=${memberId}&limit=20`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeTransaction);
    },
    enabled: !!memberId,
  });
}

interface MyShareSummary {
  unitPrice: number;
  unitsHeld: number;
  currentShareCapital: number;
  estimatedWorth: number;
  purchasedTotal: number;
  transferredIn: number;
  transferredOut: number;
  netTransfers: number;
}

export function useMyShareSummary(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-share-summary", memberId],
    queryFn: async (): Promise<MyShareSummary> => {
      const res = await api.get<MyShareSummary>("/shares/me/summary");
      return (res as any)?.data ?? res;
    },
    enabled: !!memberId,
  });
}

export function useMySavingsHistory(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-savings-history", memberId],
    queryFn: async () => {
      const res = await api.get(`/savings-history?memberId=${memberId}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map((s: any) => ({
        ...s,
        id: String(s._id ?? s.id),
        member_id: s.memberId ? String(s.memberId) : (s.member_id ?? null),
        created_at: s.createdAt ?? s.created_at,
      }));
    },
    enabled: !!memberId,
  });
}

/** All guarantor consent requests for the logged-in member (pending + historical) */
export function useMyGuarantorRequests() {
  return useQuery({
    queryKey: ["my-guarantor-requests"],
    queryFn: async () => {
      const res = await api.get("/loans/guarantor-requests/me");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map((r: any) => {
        const loan = r.loanId ?? {};
        const applicant = loan.memberId ?? {};
        return {
          id: String(r._id ?? r.id),
          loan_id: String(loan._id ?? loan.id ?? ""),
          loan_number: loan.loanNumber ?? loan.loan_number ?? "—",
          principal: Number(loan.principal ?? 0),
          interest_rate: Number(loan.interestRate ?? loan.interest_rate ?? 0),
          term_months: Number(loan.termMonths ?? loan.term_months ?? 0),
          monthly_installment: Number(loan.monthlyInstallment ?? loan.monthly_installment ?? 0),
          loan_status: loan.status ?? "unknown",
          applicant_name: applicant.name ?? "Unknown",
          applicant_member_id: applicant.memberId ?? applicant.member_id ?? "—",
          guarantee_amount: Number(r.guaranteeAmount ?? r.guarantee_amount ?? 0),
          consent_status: (r.consentStatus ?? r.consent_status ?? "pending") as "pending" | "accepted" | "rejected",
          response_note: r.responseNote ?? r.response_note ?? null,
          responded_at: r.respondedAt ?? r.responded_at ?? null,
          created_at: r.createdAt ?? r.created_at,
        };
      });
    },
  });
}

/** Respond to a guarantor consent request */
export function useRespondToGuarantorRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, decision, note }: { loanId: string; decision: "accepted" | "rejected"; note?: string }) => {
      return api.put(`/loans/${loanId}/guarantors/respond`, { decision, note });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-guarantor-requests"] });
    },
  });
}
