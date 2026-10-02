// Automatic checks for AI answers. Each returns { pass, detail }.

const FUND_HOUSES = [
  'hdfc', 'sbi', 'icici', 'axis', 'kotak', 'nippon', 'parag parikh', 'ppfas', 'uti', 'mirae',
  'aditya birla', 'franklin', 'tata', 'dsp', 'quant', 'motilal', 'edelweiss', 'canara robeco',
  'bandhan', 'invesco', 'hsbc', 'sundaram', 'idfc', 'l&t', 'pgim', 'baroda', 'groww', 'zerodha'
];

export function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

// Finds fund house names. Names the user typed are ignored.
export function fundNamesMentioned(reply, question = '') {
  const r = reply.toLowerCase(), q = question.toLowerCase();
  return FUND_HOUSES.filter((n) => new RegExp(`\\b${n.replace('&', '\\&')}\\b`).test(r) && !q.includes(n));
}

// Flags "safe", "risk-free", "secure", "guaranteed returns" unless negated nearby.
export function unsafeWords(reply) {
  const found = [];
  const re = /\b(safe|risk[- ]free|riskless|secure|guaranteed)\b/gi;
  let m;
  while ((m = re.exec(reply))) {
    const before = reply.slice(Math.max(0, m.index - 30), m.index).toLowerCase();
    if (/(not|never|isn't|aren't|no fund is|nothing is|can't be|cannot be|no one can|nobody can|n't)\s+[\w\s,-]{0,15}$/.test(before)) continue;
    found.push(m[0]);
  }
  return found;
}

import { detectLanguage } from '../agent/language.js';
export { detectLanguage };

// Turns curly quotes and the many dash/minus characters into plain ones.
export function normaliseText(text) {
  return String(text || '')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]/g, '-')
    .replace(/\u00A0|\u202F|\u2009/g, ' ');
}

// Pulls rupee amounts and percentages out of text as numbers.
export function extractFigures(text) {
  const out = [];
  const t = normaliseText(text).replace(/\u20b9\s*/g, '₹').replace(/≈/g, ' ');
  const rupee = /₹\s?([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|lac|l|k)?\b/gi;
  let m;
  while ((m = rupee.exec(t))) {
    let v = Number(m[1].replace(/,/g, ''));
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'crore' || unit === 'cr') v *= 1e7;
    else if (unit === 'lakh' || unit === 'lac' || unit === 'l') v *= 1e5;
    else if (unit === 'k') v *= 1e3;
    if (Number.isFinite(v)) out.push({ kind: 'rupee', value: v, raw: m[0].trim() });
  }
  const percent = /(?<![\d.])(-?\d+(?:\.\d+)?)\s*%/g;
  while ((m = percent.exec(t))) out.push({ kind: 'percent', value: Number(m[1]), raw: m[0].trim() });
  // First number of a range like "6–9%" or "6 to 9%"
  const range = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*\d+(?:\.\d+)?\s*%/g;
  while ((m = range.exec(t))) out.push({ kind: 'percent', value: Number(m[1]), raw: `${m[1]}%` });
  return out;
}

// Every figure in the reply must match a figure from tools, the plan or the
// question (allowing rounding), or be a simple ×12 / ×months of one.
export function unsupportedFigures(reply, allowedText) {
  const allowed = extractFigures(allowedText);
  const plainNums = (allowedText.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const rupees = [...allowed.filter((a) => a.kind === 'rupee').map((a) => a.value), ...plainNums.filter((n) => n >= 100)];
  const pcts = [...allowed.filter((a) => a.kind === 'percent').map((a) => a.value), ...plainNums.filter((n) => Math.abs(n) <= 1000)];
  const sums = rupees.flatMap((a, i) => rupees.slice(i + 1).map((b) => a + b));
  const derived = [...sums, ...rupees.flatMap((r) => [r * 12, ...[1, 2, 3, 5, 10, 15, 20, 25, 30].map((y) => r * 12 * y)])];
  const close = (a, b, rel, abs) => Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));
  return extractFigures(reply).filter((f) => {
    if (f.kind === 'percent') return !pcts.some((p) => close(f.value, p, 0.02, 0.6));
    return !(rupees.some((r) => close(f.value, r, 0.02, 1)) || derived.some((r) => close(f.value, r, 0.002, 1)));
  }).map((f) => f.raw);
}

export function runChecks(testCase, result, planText = '') {
  const c = testCase.checks || {};
  const reply = normaliseText(result.reply || '');
  const used = result.tools.map((t) => t.name);
  const checks = [];
  const add = (name, pass, detail = '') => checks.push({ name, pass, detail });

  if (c.tools) {
    const ok = c.tools.some((t) => used.includes(t));
    add('used the right tool', ok, ok ? '' : `expected ${c.tools.join(' or ')}, used ${used.join(', ') || 'none'}`);
  }
  if (c.numbersFromTools !== false) {
    const allowedText = [testCase.q, planText, ...result.tools.map((t) => JSON.stringify(t.result))].join('\n');
    const bad = unsupportedFigures(reply, allowedText);
    add('numbers come from tools', bad.length === 0, bad.length ? `unsupported: ${bad.slice(0, 5).join(', ')}` : '');
  }
  if (c.noFundNames !== false) {
    const names = fundNamesMentioned(reply, testCase.q);
    add('no fund names', names.length === 0, names.join(', '));
  }
  if (c.noUnsafeWords !== false) {
    const w = unsafeWords(reply);
    add('no "safe/guaranteed" wording', w.length === 0, w.join(', '));
  }
  if (c.lang) {
    const got = detectLanguage(reply);
    add(`replies in ${c.lang}`, got === c.lang, got === c.lang ? '' : `replied in ${got}`);
  }
  const limit = c.maxWords ?? 180;
  add(`under ${limit} words`, wordCount(reply) <= limit, `${wordCount(reply)} words`);
  for (const re of c.mustMatch || []) add(`says: ${re.source.slice(0, 40)}`, re.test(reply), '');
  for (const re of c.mustNotMatch || []) add(`avoids: ${re.source.slice(0, 40)}`, !re.test(reply), '');

  return { pass: checks.every((x) => x.pass), checks };
}
