import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface CustomPreset {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  description: string | null;
  amount: number;
  override_trust: number | null;
  guarantor_count: number;
  icon: string;
  sort_order: number;
}

function normalize(p: any): CustomPreset {
  return {
    ...p,
    id: String(p._id ?? p.id),
    user_id: p.userId ? String(p.userId) : (p.user_id ?? ""),
    created_at: p.createdAt ?? p.created_at ?? "",
    description: p.description ?? null,
    override_trust: p.overrideTrust ?? p.override_trust ?? null,
    guarantor_count: p.guarantorCount ?? p.guarantor_count ?? 1,
    sort_order: p.sortOrder ?? p.sort_order ?? 0,
  };
}

export function useSimulationPresets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["simulation_presets"],
    queryFn: async () => {
      const res = await api.get("/simulation/presets");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalize) as CustomPreset[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (preset: { name: string; description?: string; amount: number; override_trust?: number | null; guarantor_count: number; icon: string }) => {
      const existing = queryClient.getQueryData<CustomPreset[]>(["simulation_presets"]) ?? [];
      const maxOrder = existing.reduce((max, p) => Math.max(max, p.sort_order), -1);
      await api.post("/simulation/presets", {
        name: preset.name,
        description: preset.description ?? null,
        amount: preset.amount,
        overrideTrust: preset.override_trust ?? null,
        guarantorCount: preset.guarantor_count,
        icon: preset.icon,
        sortOrder: maxOrder + 1,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["simulation_presets"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (preset: { id: string; name: string; description?: string | null; amount: number; override_trust?: number | null; guarantor_count: number; icon: string }) => {
      await api.put(`/simulation/presets/${preset.id}`, {
        name: preset.name,
        description: preset.description ?? null,
        amount: preset.amount,
        overrideTrust: preset.override_trust ?? null,
        guarantorCount: preset.guarantor_count,
        icon: preset.icon,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["simulation_presets"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.del(`/simulation/presets/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["simulation_presets"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await api.put("/simulation/presets/reorder", { orderedIds });
    },
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["simulation_presets"] });
      const previous = queryClient.getQueryData<CustomPreset[]>(["simulation_presets"]);
      if (previous) {
        const reordered = orderedIds
          .map((id, index) => {
            const preset = previous.find((p) => p.id === id);
            return preset ? { ...preset, sort_order: index } : null;
          })
          .filter(Boolean) as CustomPreset[];
        queryClient.setQueryData(["simulation_presets"], reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["simulation_presets"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["simulation_presets"] }),
  });

  return {
    ...query,
    addPreset: addMutation.mutateAsync,
    updatePreset: updateMutation.mutateAsync,
    removePreset: deleteMutation.mutateAsync,
    reorderPresets: reorderMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

// Legacy Supabase version removed – all data now served from REST API above.
