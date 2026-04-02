import { useQuery } from "@tanstack/react-query";
import { api, normalizeLoan } from "@/lib/api";

export function useMyGuaranteedLoans(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-guaranteed-loans", memberId],
    queryFn: async () => {
      // The backend returns loans; filter those where member is a guarantor
      const res = await api.get(`/loans?guarantorMemberId=${memberId}`);
      const loans = (Array.isArray(res) ? res : (res as any).data ?? []).map(normalizeLoan);

      // Shape the return to match what MyAccount expects:
      // { ...guarantorRecord, loans: { loan_number, principal, balance, status, ... } }
      return loans.flatMap((loan: any) =>
        (loan.loan_guarantors ?? []).filter((g: any) => g.member_id === memberId).map((g: any) => ({
          ...g,
          loans: {
            loan_number: loan.loan_number,
            principal: loan.principal,
            balance: loan.balance,
            status: loan.status,
            interest_rate: loan.interest_rate,
            term_months: loan.term_months,
            member_id: loan.member_id,
            members: loan.members,
          },
        }))
      );
    },
    enabled: !!memberId,
  });
}
