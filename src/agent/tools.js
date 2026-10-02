// Tools the AI can call. Every number the user sees comes from here, never from the model.
import { lookupTerm } from './glossary.js';
import { buildPlan } from '../engine/plan.js';
import { buildAllocation } from '../engine/allocation.js';
import { scoreRisk } from '../engine/risk.js';
import { projectSip } from '../engine/returns.js';
import { tipsFor, COMMON_TIPS, WHERE_TO_COMPARE } from '../engine/choose.js';

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'explain_term',
      description: 'Get the plain-language meaning of an investing term (SIP, NAV, expense ratio, direct vs regular, exit load, index fund, debt fund, liquid fund, ELSS, compounding, etc.). Use this before explaining any term.',
      parameters: {
        type: 'object',
        properties: { term: { type: 'string', description: 'The term to explain' } },
        required: ['term']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'project_growth',
      description: "Calculate what a monthly SIP could grow to, as weak / typical / strong outcomes from past data. Uses the user's own plan mix if they have one. Use this for ANY question about future amounts or returns. Never calculate numbers yourself.",
      parameters: {
        type: 'object',
        properties: {
          monthly: { type: 'number', description: 'Monthly amount in rupees, 500 to 10,00,000' },
          years: { type: 'number', description: 'Number of years, 1 to 40' }
        },
        required: ['monthly', 'years']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fund_type_history',
      description: 'Get real past performance of each fund type from historical data: worst, typical and best 1-year returns, how often a year was negative, and the typical yearly return over 5 and 10 years. Use this for ANY question about how much a fund type returns, how risky it is, or whether a return like 20% is realistic.',
      parameters: {
        type: 'object',
        properties: {
          fund_type: {
            type: ['string', 'null'],
            enum: ['all', 'largecap_index', 'flexicap', 'midcap', 'short_debt', 'liquid', null],
            description: 'Use "all" to get every fund type at once, or one specific type.'
          },
          target_return: {
            type: ['number', 'null'],
            description: 'If the user mentions a return they hope for (for example 20 for 20%), pass it here to see how often each fund type reached it in a year. Otherwise null.'
          }
        },
        required: ['fund_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_fund_types',
      description: "Get the fund types in the user's plan (or all fund types if they have no plan), with plain descriptions, monthly amounts, and tips on how to choose a fund within each type. Use this when the user asks which fund to pick or to see options.",
      parameters: { type: 'object', properties: {} }
    }
  }
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pct = (r) => `${(r * 100).toFixed(1)}%`;

function percentile(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// Lump-sum returns over every rolling window of `months`, as annual rates.
function rollingReturns(monthly, months) {
  const out = [];
  for (let i = 0; i + months < monthly.length; i++) {
    const growth = monthly[i + months][1] / monthly[i][1];
    out.push(Math.pow(growth, 12 / months) - 1);
  }
  return out.sort((a, b) => a - b);
}

export function fundTypeHistory(category, targetReturn = null) {
  const one = rollingReturns(category.monthly, 12);
  if (!one.length) return { fundType: category.label, available: false };
  const summary = {
    fundType: category.label,
    dataFrom: category.monthly[0][0],
    dataTo: category.monthly.at(-1)[0],
    oneYear: {
      worst: pct(one[0]),
      typical: pct(percentile(one, 0.5)),
      best: pct(one.at(-1)),
      negativeYears: `${Math.round((one.filter((r) => r < 0).length / one.length) * 100)}% of 12-month periods lost money`
    }
  };
  const target = Number(targetReturn);
  if (Number.isFinite(target) && target > -100 && target < 1000 && targetReturn !== null) {
    const share = Math.round((one.filter((r) => r >= target / 100).length / one.length) * 100);
    summary.oneYear.reachedTarget = `${share}% of 12-month periods returned ${target}% or more`;
  }
  for (const years of [5, 10]) {
    const r = rollingReturns(category.monthly, years * 12);
    if (r.length >= 12) {
      summary[`over${years}Years`] = { worstPerYear: pct(r[0]), typicalPerYear: pct(percentile(r, 0.5)), bestPerYear: pct(r.at(-1)) };
    }
  }
  return summary;
}

export function makeToolRunner({ data, answers }) {
  const seriesById = Object.fromEntries(data.categories.map((c) => [c.id, c.monthly]));

  // The user's mix if they finished onboarding, else a balanced default.
  function weightsFor(years) {
    const reaction = answers?.reaction || 'wait';
    const profileId = scoreRisk({ reaction, years }).profile.id;
    return buildAllocation({
      profileId,
      years,
      monthly: 1000,
      safety: { hasEmergencyFund: answers?.hasEmergencyFund, hasCostlyDebt: answers?.hasCostlyDebt }
    }).weights;
  }

  return function runTool(name, args = {}) {
    if (name === 'explain_term') return lookupTerm(args.term);

    if (name === 'project_growth') {
      const monthly = Math.round(clamp(Number(args.monthly) || 0, 500, 1000000));
      const years = Math.round(clamp(Number(args.years) || 0, 1, 40));
      const p = projectSip({ seriesById, weights: weightsFor(years), monthly, years });
      if (!p.ok) return { ok: false, reason: p.reason };
      return {
        ok: true,
        monthly,
        years,
        invested: p.invested,
        weak: { value: p.outcomes.weak.value, rate: `${pct(p.outcomes.weak.annualRate)} a year` },
        typical: { value: p.outcomes.typical.value, rate: `${pct(p.outcomes.typical.annualRate)} a year` },
        strong: { value: p.outcomes.strong.value, rate: `${pct(p.outcomes.strong.annualRate)} a year` },
        basis: `Based on ${p.basis.windowsCounted} past ${p.basis.windowYears}-year periods since ${p.basis.from}${p.basis.extrapolated ? `, extended to the full ${years} years (longer goals use 10-year periods so the range covers many different market starting points)` : ''}.`,
        note: "Past returns don't guarantee future results."
      };
    }

    if (name === 'fund_type_history') {
      const want = String(args.fund_type || '').toLowerCase().replace(/[^a-z_]/g, '');
      const cats = want && want !== 'all' ? data.categories.filter((c) => c.id === want) : data.categories;
      if (!cats.length) return { error: `Unknown fund type. Use one of: ${data.categories.map((c) => c.id).join(', ')}` };
      return {
        types: cats.map((c) => fundTypeHistory(c, args.target_return ?? null)),
        note: 'Lump-sum returns from past data, before tax. Past returns don\'t guarantee future results.'
      };
    }

    if (name === 'get_fund_types') {
      if (answers && answers.years && answers.monthly && answers.reaction) {
        const plan = buildPlan(answers, data);
        return {
          inPlan: true,
          monthlyTotal: plan.monthly,
          split: { growthPercent: plan.split.growth, stabilityPercent: plan.split.stability },
          funds: plan.funds.map(({ id, label, plain, monthly, assetClass }) => ({
            label, plain, monthly,
            shareOfMonthly: `${Math.round((monthly / plan.monthly) * 100)}%`,
            part: assetClass === 'growth' ? 'growth' : 'stability',
            howToChoose: tipsFor(id).specific
          })),
          howToChooseAnyFund: COMMON_TIPS,
          whereToCompare: WHERE_TO_COMPARE
        };
      }
      return {
        inPlan: false,
        fundTypes: data.categories.map(({ id, label, plain }) => ({ label, plain, howToChoose: tipsFor(id).specific })),
        howToChooseAnyFund: COMMON_TIPS,
        whereToCompare: WHERE_TO_COMPARE
      };
    }

    return { error: `Unknown tool: ${name}` };
  };
}
