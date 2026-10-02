// Allocation rules: profile + time horizon -> growth/stability split and fund types.

// Share of the monthly amount that goes to growth (equity) funds.
export function growthShare(profileId, years) {
  if (years < 3) return 0;
  if (profileId === 'conservative') return 0.3;
  if (profileId === 'balanced') return years < 5 ? 0.5 : 0.7;
  if (profileId === 'growth') return years < 7 ? 0.75 : 0.85;
  throw new Error(`Unknown profile: ${profileId}`);
}

// How the growth part is split across fund types.
const GROWTH_MIX = {
  conservative: { largecap_index: 1 },
  balanced: { largecap_index: 0.7, flexicap: 0.3 },
  growth: { largecap_index: 0.5, flexicap: 0.3, midcap: 0.2 }
};

// Which fund holds the stability part.
function stabilityFund(years) {
  return years < 1 ? 'liquid' : 'short_debt';
}

// Splits `total` across weights in steps of `step`, keeping the exact total.
export function splitAmount(total, weights, step = 100) {
  const ids = Object.keys(weights).filter((id) => weights[id] > 0);
  const raw = ids.map((id) => ({ id, exact: total * weights[id] }));
  const out = {};
  let used = 0;
  for (const r of raw) {
    out[r.id] = Math.floor(r.exact / step) * step;
    used += out[r.id];
  }
  // Give what's left to the largest bucket so amounts stay round and add up.
  const leftover = total - used;
  if (leftover !== 0 && raw.length) {
    const largest = raw.reduce((a, b) => (b.exact > a.exact ? b : a));
    out[largest.id] += leftover;
  }
  return out;
}

// safety: { hasEmergencyFund: boolean, hasCostlyDebt: boolean }
export function buildAllocation({ profileId, years, monthly, safety = {} }) {
  if (!(monthly > 0)) throw new Error('monthly must be a positive number');

  let growth = growthShare(profileId, years);
  const notes = [];

  // No emergency fund: keep at least 30% steady until one is built.
  const cushion = safety.hasEmergencyFund === false;
  if (cushion && growth > 0.7) growth = 0.7;
  if (cushion) {
    notes.push({
      kind: 'emergency_fund',
      text: 'Build a safety cushion first. Part of each month goes to a liquid fund until you have about 3 months of expenses saved.'
    });
  }
  if (safety.hasCostlyDebt) {
    notes.push({
      kind: 'costly_debt',
      text: 'Paying off high-interest loans, like credit card dues, usually beats any investment return. Consider clearing those first.'
    });
  }

  const weights = {};
  for (const [id, w] of Object.entries(GROWTH_MIX[profileId] || {})) {
    if (growth > 0) weights[id] = (weights[id] || 0) + growth * w;
  }
  const stability = 1 - growth;
  if (stability > 0) {
    const fund = cushion ? 'liquid' : stabilityFund(years);
    weights[fund] = (weights[fund] || 0) + stability;
  }

  const amounts = splitAmount(monthly, weights);
  return {
    split: { growth: Math.round(growth * 100), stability: Math.round(stability * 100) },
    weights,
    amounts,
    notes
  };
}
