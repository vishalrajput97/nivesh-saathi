// One call that turns onboarding answers into a full plan.
import { scoreRisk } from './risk.js';
import { buildAllocation } from './allocation.js';
import { projectSip } from './returns.js';

// answers: { goal, years, monthly, reaction, hasEmergencyFund, hasCostlyDebt }
// data: the parsed data/returns-data.json
export function buildPlan(answers, data) {
  const { goal, years, monthly, reaction, hasEmergencyFund, hasCostlyDebt } = answers;
  const risk = scoreRisk({ reaction, years });
  const allocation = buildAllocation({
    profileId: risk.profile.id,
    years,
    monthly,
    safety: { hasEmergencyFund, hasCostlyDebt }
  });

  const catalog = Object.fromEntries((data.categories || []).map((c) => [c.id, c]));
  const funds = Object.entries(allocation.amounts).map(([id, amount]) => ({
    id,
    label: catalog[id]?.label ?? id,
    plain: catalog[id]?.plain ?? '',
    assetClass: catalog[id]?.assetClass ?? null,
    monthly: amount
  }));

  const seriesById = Object.fromEntries((data.categories || []).map((c) => [c.id, c.monthly]));
  const projection = projectSip({ seriesById, weights: allocation.weights, monthly, years });

  return { goal, years, monthly, risk, split: allocation.split, funds, notes: allocation.notes, projection };
}
