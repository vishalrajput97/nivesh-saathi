// Tools the AI can call. Every number the user sees comes from here, never from the model.
import { lookupTerm } from './glossary.js';
import { buildPlan } from '../engine/plan.js';
import { buildAllocation } from '../engine/allocation.js';
import { scoreRisk } from '../engine/risk.js';
import { projectSip } from '../engine/returns.js';

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
      name: 'get_fund_types',
      description: "Get the fund types in the user's plan (or the app's fund types if they have no plan), with plain descriptions and monthly amounts.",
      parameters: { type: 'object', properties: {} }
    }
  }
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

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
      const pct = (r) => `${(r * 100).toFixed(1)}% a year`;
      return {
        ok: true,
        monthly,
        years,
        invested: p.invested,
        weak: { value: p.outcomes.weak.value, rate: pct(p.outcomes.weak.annualRate) },
        typical: { value: p.outcomes.typical.value, rate: pct(p.outcomes.typical.annualRate) },
        strong: { value: p.outcomes.strong.value, rate: pct(p.outcomes.strong.annualRate) },
        basis: `Based on ${p.basis.windowsCounted} past ${p.basis.windowYears}-year periods since ${p.basis.from}${p.basis.extrapolated ? ', extended to the full period' : ''}.`,
        note: "Past returns don't guarantee future results."
      };
    }

    if (name === 'get_fund_types') {
      if (answers && answers.years && answers.monthly && answers.reaction) {
        const plan = buildPlan(answers, data);
        return { inPlan: true, split: plan.split, funds: plan.funds.map(({ label, plain, monthly }) => ({ label, plain, monthly })) };
      }
      return { inPlan: false, fundTypes: data.categories.map(({ label, plain }) => ({ label, plain })) };
    }

    return { error: `Unknown tool: ${name}` };
  };
}
