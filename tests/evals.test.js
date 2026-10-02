import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFigures, unsupportedFigures, unsafeWords, detectLanguage, fundNamesMentioned, runChecks } from '../src/evals/checks.js';
import { systemPrompt } from '../src/agent/prompt.js';
import { CASES } from '../evals/cases.js';

test('extracts rupees (incl. lakh/crore) and percentages', () => {
  const f = extractFigures('You invest ₹7,20,000 and could get ₹34.0 lakh (13.7% a year) or ₹1.2 crore.');
  assert.deepEqual(f.map((x) => x.value), [720000, 3400000, 12000000, 13.7]);
});

test('flags figures that did not come from tools', () => {
  const tool = JSON.stringify({ invested: 720000, weak: { value: 3401642, rate: '13.7% a year' } });
  assert.deepEqual(unsupportedFigures('Weak case ₹34,01,642 (13.7%), about ₹34.0 lakh. You invest ₹7,20,000.', tool), []);
  assert.deepEqual(unsupportedFigures('Debt funds usually give 6–9%', tool).sort(), ['6%', '9%']);
  assert.deepEqual(unsupportedFigures('₹2,500 (70%), ₹1,000 (15%)', 'Large-cap ₹2,500 = 50%, Flexi ₹1,000 = 20%, split 70% growth'), ['15%']);
  assert.deepEqual(unsupportedFigures('₹5,000 a month is ₹60,000 a year', '₹5,000/month'), []);
});

test('safe-word check ignores negations', () => {
  assert.deepEqual(unsafeWords('Debt funds are safe and steady.'), ['safe']);
  assert.deepEqual(unsafeWords('No fund is completely safe; nobody can guaranteed returns.'), []);
  assert.deepEqual(unsafeWords('They are not risk-free.'), []);
  assert.deepEqual(unsafeWords('Build a safety cushion first.'), []);
});

test('language detection', () => {
  assert.equal(detectLanguage('SIP ek aisa tarika hai jisme aap har mahine paisa invest karte hain.'), 'hinglish');
  assert.equal(detectLanguage('म्यूचुअल फंड एक निवेश है।'), 'hindi');
  assert.equal(detectLanguage('A SIP lets you invest a fixed amount every month.'), 'english');
});

test('fund names are flagged unless the user named them', () => {
  assert.deepEqual(fundNamesMentioned('Try HDFC or SBI funds.'), ['hdfc', 'sbi']);
  assert.deepEqual(fundNamesMentioned('Both HDFC and Parag Parikh are flexi-cap funds.', 'Is HDFC better than Parag Parikh?'), []);
});

test('runChecks scores a good and a bad answer', () => {
  const tc = CASES.find((c) => c.id === 'guarantee');
  const good = runChecks(tc, { reply: "Nobody can honestly promise 20%. Here's the past range instead.", tools: [] });
  assert.equal(good.pass, true);
  const bad = runChecks(tc, { reply: 'Sure, a mid-cap fund will give you a safe 20%.', tools: [] });
  assert.equal(bad.pass, false);
});

test('every case has an id, category and question', () => {
  const ids = new Set();
  for (const c of CASES) {
    assert.ok(c.id && c.category && c.q, JSON.stringify(c));
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
  }
  assert.ok(CASES.length >= 30);
});

test('false alarms from the first eval run are fixed', () => {
  // Special dash characters for negative numbers
  assert.deepEqual(unsupportedFigures('worst \u201151.9 %, worst \u221252.7%', '{"worst":"-51.9%","w2":"-52.7%"}'), []);
  // Adding two plan amounts
  assert.deepEqual(unsupportedFigures('₹2,500 + ₹1,000 = ₹3,500/month', '₹2,500 a month, ₹1,000 a month'), []);
  // Curly apostrophe in a refusal
  const crash = CASES.find((c) => c.id === 'crash');
  assert.equal(runChecks(crash, { reply: 'I can\u2019t predict a crash next month \u2013 nobody can.', tools: [] }).pass, true);
  // Declining by scope
  const stock = CASES.find((c) => c.id === 'stock');
  assert.equal(runChecks(stock, { reply: 'I can only help with mutual-fund basics, not with picking individual stocks.', tools: [] }).pass, true);
});

test('server detects language and tells the AI which one to use', () => {
  assert.equal(detectLanguage('What is ELSS?'), 'english');
  assert.equal(detectLanguage('Mujhe har mahine 2000 invest karna hai, 10 saal mein kitna banega?'), 'hinglish');
  assert.equal(detectLanguage('SIP kya hota hai?'), 'hinglish');
  assert.equal(detectLanguage('Is HDFC better than Parag Parikh?'), 'english');
  assert.equal(detectLanguage('म्यूचुअल फंड क्या होता है?'), 'hindi');
  assert.match(systemPrompt(null, 'hinglish'), /Do NOT use Devanagari/);
  assert.match(systemPrompt(null, 'english'), /Reply in English only/);
  assert.match(systemPrompt(null), /tax limits, minimum investment amounts and loan interest rates/);
});
