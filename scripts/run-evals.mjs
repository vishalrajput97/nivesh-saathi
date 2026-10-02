// Runs every test question against the real AI and scores the answers.
// Setup: put your Groq key in a file called .env in the project folder:
//   GROQ_API_KEY=gsk_...
// Run: npm run evals              (all questions)
//      npm run evals -- Jargon     (one category)
//      npm run evals -- from:19    (resume from question 19)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { runAgent } from '../src/agent/agent.js';
import { providersFromEnv, BusyError } from '../src/agent/llm.js';
import { systemPrompt } from '../src/agent/prompt.js';
import { buildPlan } from '../src/engine/plan.js';
import { runChecks } from '../src/evals/checks.js';
import { CASES, PLAN_ANSWERS } from '../evals/cases.js';

const providers = providersFromEnv(process.env);
if (!providers.length) {
  console.error('No GROQ_API_KEY found. Create a file named .env in the project folder containing:\n  GROQ_API_KEY=gsk_your_key_here');
  process.exit(1);
}

const data = JSON.parse(await readFile(new URL('../data/returns-data.json', import.meta.url), 'utf8'));
const plan = buildPlan(PLAN_ANSWERS, data);
const planText = systemPrompt(plan);
const only = process.argv[2];
const fromMatch = only && only.match(/^from:(\d+)$/);
const cases = fromMatch
  ? CASES.slice(Number(fromMatch[1]) - 1)
  : only ? CASES.filter((c) => c.category.toLowerCase() === only.toLowerCase() || c.id === only) : CASES;
const offset = fromMatch ? Number(fromMatch[1]) - 1 : 0;
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS || 12000); // stays under free-tier per-minute limits
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Running ${cases.length} questions (about ${Math.ceil((cases.length * (PAUSE_MS + 4000)) / 60000)} minutes)…\n`);
const results = [];
let stoppedAt = null;
for (const [i, tc] of cases.entries()) {
  let result = null, error = null;
  for (let attempt = 1; attempt <= 2 && !result; attempt++) {
    try {
      result = await runAgent({ messages: [{ role: 'user', content: tc.q }], answers: tc.plan ? PLAN_ANSWERS : null, data, providers });
    } catch (err) {
      error = err;
      if (err instanceof BusyError && attempt < 2) { console.log('   …free-tier limit reached, waiting 60 seconds'); await sleep(60000); }
      else break;
    }
  }
  if (!result && error instanceof BusyError) {
    // Still busy after waiting: almost certainly the daily free limit. Stop instead of failing every remaining question.
    stoppedAt = offset + i + 1;
    console.log(`\nStopped at question ${stoppedAt}: the free daily limit looks used up.`);
    console.log(`Resume later with:  npm run evals -- from:${stoppedAt}\n`);
    break;
  }
  const scored = result ? runChecks(tc, result, tc.plan ? planText : '') : { pass: false, checks: [{ name: 'got an answer', pass: false, detail: error?.message?.slice(0, 120) }] };
  results.push({ ...tc, reply: result?.reply || '', provider: result?.provider || null, tools: result?.tools.map((t) => t.name) || [], ...scored });
  const failed = scored.checks.filter((c) => !c.pass);
  console.log(`${scored.pass ? 'PASS' : 'FAIL'}  [${offset + i + 1}/${CASES.length}] ${tc.category} · ${tc.q}`);
  for (const f of failed) console.log(`        ✗ ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  if (i < cases.length - 1) await sleep(PAUSE_MS);
}

// Scorecard
const byCat = {};
for (const r of results) {
  byCat[r.category] ??= { pass: 0, total: 0 };
  byCat[r.category].total++;
  if (r.pass) byCat[r.category].pass++;
}
if (!results.length) { console.log('No questions were answered, so no report was saved.'); process.exit(0); }
const passed = results.filter((r) => r.pass).length;
const checkTotals = {};
for (const r of results) for (const c of r.checks) {
  const key = c.name.startsWith('says:') ? 'says the required thing' : c.name.startsWith('avoids:') ? 'avoids the forbidden thing' : c.name.replace(/under \d+ words/, 'stays short').replace(/replies in \w+/, 'right language');
  checkTotals[key] ??= { pass: 0, total: 0 };
  checkTotals[key].total++;
  if (c.pass) checkTotals[key].pass++;
}

console.log(`\nScore: ${passed}/${results.length} questions passed (${Math.round((passed / results.length) * 100)}%)\n`);
for (const [cat, s] of Object.entries(byCat)) console.log(`  ${cat.padEnd(16)} ${s.pass}/${s.total}`);
console.log('\nBy check:');
for (const [name, s] of Object.entries(checkTotals)) console.log(`  ${name.padEnd(30)} ${s.pass}/${s.total}`);

const date = new Date().toISOString().slice(0, 10) + (offset ? `-from${offset + 1}` : '') + (stoppedAt ? '-partial' : '');
await mkdir(new URL('../evals/results/', import.meta.url), { recursive: true });
const md = [
  `# Eval results · ${date}`,
  '',
  `**${passed}/${results.length} questions passed (${Math.round((passed / results.length) * 100)}%)**`,
  ...(stoppedAt ? ['', `Stopped early at question ${stoppedAt} (free daily limit). Resume with \`npm run evals -- from:${stoppedAt}\`.`] : []),
  '',
  '| Category | Passed |', '| --- | --- |',
  ...Object.entries(byCat).map(([c, s]) => `| ${c} | ${s.pass}/${s.total} |`),
  '',
  '| Check | Passed |', '| --- | --- |',
  ...Object.entries(checkTotals).map(([c, s]) => `| ${c} | ${s.pass}/${s.total} |`),
  '',
  '## Every question',
  ...results.map((r) => [
    '',
    `### ${r.pass ? '✅' : '❌'} ${r.category} · ${r.q}`,
    `Tools: ${r.tools.join(', ') || 'none'} · Model: ${r.provider || '-'}`,
    ...r.checks.filter((c) => !c.pass).map((c) => `- ✗ ${c.name}${c.detail ? ` (${c.detail})` : ''}`),
    '',
    '> ' + (r.reply || '(no answer)').replace(/\n/g, '\n> ')
  ].join('\n'))
].join('\n');
await writeFile(new URL(`../evals/results/${date}.md`, import.meta.url), md);
await writeFile(new URL(`../evals/results/${date}.json`, import.meta.url), JSON.stringify(results, null, 2));
console.log(`\nFull report saved to evals/results/${date}.md`);
