import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, normalizeMember } from "@/lib/api";
import { useRealtimeSubscription } from "./useRealtimeQuery";

export function useMembers() {
  const queryKey = ["members"];
  useRealtimeSubscription("members", queryKey);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get("/members");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeMember);
    },
    refetchInterval: () => (document.hidden ? false : 15000),
    refetchOnWindowFocus: true,
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      const res = await api.get(`/members/${id}`);
      return normalizeMember(res);
    },
    enabled: !!id,
    refetchInterval: () => (document.hidden ? false : 15000),
    refetchOnWindowFocus: true,
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      memberId: string;
      name: string;
      email?: string;
      phone?: string;
      shares?: number;
      savings?: number;
      status?: string;
    }) => api.post("/members", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      name?: string;
      email?: string;
      phone?: string;
      shares?: number;
      savings?: number;
      status?: string;
    }) => api.put(`/members/${id}`, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useLinkMemberAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string | null }) =>
      api.put(`/members/${id}/link-account`, { userId }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members", vars.id] });
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
