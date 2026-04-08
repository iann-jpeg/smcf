import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface SimulationRecord {
  id: string;
  user_id: string;
  created_at: string;
  mode: string;
  scenario_a: any;
  scenario_b: any | null;
  result_a: any;
  result_b: any | null;
  notes: string | null;
}

function normalize(r: any): SimulationRecord {
  return {
    ...r,
    id: String(r._id ?? r.id),
    user_id: r.userId ? String(r.userId) : (r.user_id ?? ""),
    created_at: r.createdAt ?? r.created_at ?? "",
    scenario_b: r.scenarioB ?? r.scenario_b ?? null,
    result_a: r.resultA ?? r.result_a,
    result_b: r.resultB ?? r.result_b ?? null,
    scenario_a: r.scenarioA ?? r.scenario_a,
  };
}

export function useSimulationHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["simulation_history"],
    queryFn: async () => {
      const res = await api.get("/simulation/history");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalize) as SimulationRecord[];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (record: {
      mode: string;
      scenario_a: any;
      scenario_b?: any;
      result_a: any;
      result_b?: any;
      notes?: string;
    }) => {
      await api.post("/simulation/history", {
        mode: record.mode,
        scenarioA: record.scenario_a,
        scenarioB: record.scenario_b ?? null,
        resultA: record.result_a,
        resultB: record.result_b ?? null,
        notes: record.notes ?? null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["simulation_history"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.del(`/simulation/history/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["simulation_history"] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
