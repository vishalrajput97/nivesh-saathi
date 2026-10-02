// Prints a sample plan using the real data. Run after `npm run data`: npm run demo
import { readFile } from 'node:fs/promises';
import { buildPlan } from '../src/engine/plan.js';

const data = JSON.parse(await readFile(new URL('../data/returns-data.json', import.meta.url), 'utf8'));
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const pct = (r) => (r * 100).toFixed(1) + '%';

const plan = buildPlan({
  goal: "Child's education",
  years: 10,
  monthly: 5000,
  reaction: 'wait',
  hasEmergencyFund: true,
  hasCostlyDebt: false
}, data);

console.log(`\n${plan.goal} · ${plan.years} years · ${inr(plan.monthly)}/month`);
console.log(`Investor type: ${plan.risk.profile.label} — ${plan.risk.profile.plain}`);
console.log(`Split: Growth ${plan.split.growth}% · Stability ${plan.split.stability}%`);
for (const f of plan.funds) console.log(`  ${f.label.padEnd(26)} ${inr(f.monthly)}`);
for (const n of plan.notes) console.log(`  Note: ${n.text}`);

const p = plan.projection;
if (!p.ok) { console.log(p.reason); process.exit(0); }
console.log(`\nYou invest ${inr(p.invested)}`);
for (const k of ['weak', 'typical', 'strong']) {
  console.log(`  ${k.padEnd(8)} ${inr(p.outcomes[k].value).padEnd(14)} (${pct(p.outcomes[k].annualRate)} a year)`);
}
console.log(`Based on ${p.basis.windowsCounted} past ${p.basis.windowYears}-year periods, ${p.basis.from} to ${p.basis.to}${p.basis.extrapolated ? ' (extended to your full goal)' : ''}.`);
console.log(p.disclaimer);
