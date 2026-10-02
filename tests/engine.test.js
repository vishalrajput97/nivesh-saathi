import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRisk } from '../src/engine/risk.js';
import { buildAllocation, splitAmount } from '../src/engine/allocation.js';
import { sipFutureValue, sipMonthlyRate, projectSip } from '../src/engine/returns.js';

// A fake fund growing at a steady annual rate, monthly from 2010.
function steadySeries(annual, months = 180) {
  const g = Math.pow(1 + annual, 1 / 12);
  const out = [];
  for (let i = 0; i < months; i++) {
    const y = 2010 + Math.floor(i / 12), m = (i % 12) + 1;
    out.push([`${y}-${String(m).padStart(2, '0')}`, 10 * Math.pow(g, i)]);
  }
  return out;
}

test('reaction sets the profile when there is enough time', () => {
  assert.equal(scoreRisk({ reaction: 'sell', years: 10 }).profile.id, 'conservative');
  assert.equal(scoreRisk({ reaction: 'wait', years: 10 }).profile.id, 'balanced');
  assert.equal(scoreRisk({ reaction: 'buy_more', years: 10 }).profile.id, 'growth');
});

test('short goals cap the risk level and explain why', () => {
  const r = scoreRisk({ reaction: 'buy_more', years: 2 });
  assert.equal(r.profile.id, 'conservative');
  assert.equal(r.limitedByTime, true);
  assert.ok(r.reason);
  assert.equal(scoreRisk({ reaction: 'buy_more', years: 4 }).profile.id, 'balanced');
});

test('amounts are round and always add up to the monthly total', () => {
  for (const total of [1000, 2500, 5000, 7300, 12345]) {
    const out = splitAmount(total, { a: 0.49, b: 0.21, c: 0.3 });
    assert.equal(Object.values(out).reduce((x, y) => x + y, 0), total);
  }
});

test('balanced 10-year plan matches the design: 70/30, ₹2,500 / ₹1,000 / ₹1,500', () => {
  const a = buildAllocation({ profileId: 'balanced', years: 10, monthly: 5000, safety: { hasEmergencyFund: true } });
  assert.deepEqual(a.split, { growth: 70, stability: 30 });
  assert.deepEqual(a.amounts, { largecap_index: 2500, flexicap: 1000, short_debt: 1500 });
});

test('no emergency fund: caps growth at 70% and uses a liquid fund', () => {
  const a = buildAllocation({ profileId: 'growth', years: 15, monthly: 10000, safety: { hasEmergencyFund: false } });
  assert.equal(a.split.growth, 70);
  assert.ok(a.amounts.liquid > 0);
  assert.ok(a.notes.some((n) => n.kind === 'emergency_fund'));
});

test('costly debt adds a warning', () => {
  const a = buildAllocation({ profileId: 'balanced', years: 8, monthly: 3000, safety: { hasCostlyDebt: true } });
  assert.ok(a.notes.some((n) => n.kind === 'costly_debt'));
});

test('goals under 3 years go fully to stability', () => {
  const a = buildAllocation({ profileId: 'conservative', years: 2, monthly: 4000 });
  assert.deepEqual(a.split, { growth: 0, stability: 100 });
});

test('SIP maths round-trips', () => {
  const fv = sipFutureValue(1, 120, 0.01);
  assert.ok(Math.abs(sipMonthlyRate(120, fv) - 0.01) < 1e-9);
});

test('a fund growing 12% a year gives ~12% in every window', () => {
  const data = { a: steadySeries(0.12) };
  const p = projectSip({ seriesById: data, weights: { a: 1 }, monthly: 5000, years: 10 });
  assert.equal(p.ok, true);
  for (const k of ['weak', 'typical', 'strong']) {
    assert.ok(Math.abs(p.outcomes[k].annualRate - 0.12) < 1e-6, `${k} was ${p.outcomes[k].annualRate}`);
  }
  assert.equal(p.invested, 600000);
  assert.equal(p.basis.extrapolated, false);
});

test('goal longer than history is flagged as extended', () => {
  const data = { a: steadySeries(0.1, 120) };
  const p = projectSip({ seriesById: data, weights: { a: 1 }, monthly: 2000, years: 20 });
  assert.equal(p.ok, true);
  assert.equal(p.basis.extrapolated, true);
  assert.ok(p.basis.windowYears < 20);
});

test('weak ≤ typical ≤ strong for a bumpy mix', () => {
  const bumpy = steadySeries(0.12).map(([m, v], i) => [m, v * (1 + 0.15 * Math.sin(i / 7))]);
  const steady = steadySeries(0.06);
  const p = projectSip({ seriesById: { eq: bumpy, debt: steady }, weights: { eq: 0.7, debt: 0.3 }, monthly: 5000, years: 7 });
  assert.ok(p.outcomes.weak.value <= p.outcomes.typical.value);
  assert.ok(p.outcomes.typical.value <= p.outcomes.strong.value);
});
