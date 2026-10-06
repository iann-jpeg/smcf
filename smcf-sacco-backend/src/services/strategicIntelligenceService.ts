import { StrategicMetric } from '../models/StrategicTarget';

export const strategicMetrics: StrategicMetric[] = ['membership', 'savings', 'loans', 'revenue', 'expenses'];

export function calculateScenario(
  base: Record<string, unknown>,
  monthlyGrowth: Record<string, unknown>,
  months: number,
) {
  return (['base', 'conservative', 'aggressive'] as const).map((scenario) => {
    const multiplier = scenario === 'conservative' ? 0.75 : scenario === 'aggressive' ? 1.25 : 1;
    const values = strategicMetrics.reduce<Record<string, number | null>>((out, metric) => {
      const start = Number(base[metric]);
      const growth = Number(monthlyGrowth[metric]);
      out[metric] = Number.isFinite(start) && Number.isFinite(growth)
        ? Math.max(0, start * Math.pow(1 + growth * multiplier, months))
        : null;
      return out;
    }, {});
    return { scenario, multiplier, values };
  });
}

export function calculateScorecard(cards: Array<{ metric: string; target: number | null; progress: number | null }>) {
  const configured = cards.filter((card) => card.target !== null);
  const weights = configured.reduce<Record<string, number>>((out, card) => {
    out[card.metric] = 1 / Math.max(1, configured.length);
    return out;
  }, {});
  const score = configured.length
    ? Math.round(configured.reduce((sum, card) => sum + Math.min(100, Math.max(0, card.progress || 0)), 0) / configured.length)
    : null;
  return { score, weights };
}
