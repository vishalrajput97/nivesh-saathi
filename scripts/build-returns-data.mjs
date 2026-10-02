// Pulls NAV history from MFapi.in for one stand-in fund per fund type,
// keeps one NAV per month, and writes data/returns-data.json.
// Run: npm run data
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.mfapi.in';
const MIN_MONTHS = 96; // need at least 8 years of history
const config = JSON.parse(await readFile(new URL('../data/categories.json', import.meta.url), 'utf8'));

async function getJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'nivesh-saathi-data-job' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw new Error(`${url} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

const normalise = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const NOT_GROWTH = /(idcw|dividend|bonus|payout|reinvest|segregated|weekly|daily|monthly|quarterly|half yearly|annual)/;

// plan: 'direct' or 'regular'. Older regular plans often don't say "regular"
// in their name, so for regular we just require that it isn't a direct plan.
function matchesPlan(name, plan) {
  const n = name.toLowerCase();
  if (!n.includes('growth') || NOT_GROWTH.test(n)) return false;
  const isDirect = n.includes('direct');
  return plan === 'direct' ? isDirect : !isDirect;
}

// MFapi's search only returns the first few results, so we download the full
// scheme list once and search it ourselves.
let allSchemes = null;
async function getAllSchemes() {
  if (allSchemes) return allSchemes;
  const first = await getJson(`${API}/mf`);
  if (Array.isArray(first) && first.length > 1000) {
    allSchemes = first;
  } else {
    allSchemes = [];
    for (let offset = 0; offset < 200000; offset += 1000) {
      const page = await getJson(`${API}/mf?limit=1000&offset=${offset}`);
      const rows = Array.isArray(page) ? page : (page?.data || []);
      if (!rows.length) break;
      allSchemes.push(...rows);
      if (rows.length < 1000) break;
    }
  }
  console.log(`Loaded ${allSchemes.length} schemes from MFapi.in\n`);
  return allSchemes;
}

async function findCandidates(cat) {
  if (cat.schemeCode) return [{ schemeCode: cat.schemeCode, schemeName: '(set manually)' }];
  const schemes = await getAllSchemes();
  const plan = cat.plan || 'regular';
  const excluded = (cat.exclude || []).map((w) => w.toLowerCase());
  const out = [];
  const seen = new Set();
  for (const q of cat.proxyQueries) {
    const want = normalise(q);
    for (const r of schemes) {
      if (seen.has(r.schemeCode)) continue;
      const name = normalise(r.schemeName || '');
      if (name.includes(want) && matchesPlan(r.schemeName, plan) && !excluded.some((w) => name.includes(w))) {
        seen.add(r.schemeCode);
        out.push(r);
      }
    }
  }
  return out;
}

// MFapi dates are dd-mm-yyyy, newest first. Keep the last NAV of each month,
// fill any missing month with the previous month's NAV, and drop the
// current, unfinished month.
function nextMonth(key) {
  let [y, m] = key.split('-').map(Number);
  m++; if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
function toMonthly(data, thisMonth) {
  const byMonth = new Map();
  for (const { date, nav } of data) {
    const [d, m, y] = date.split('-');
    const key = `${y}-${m}`;
    const value = Number(nav);
    if (!Number.isFinite(value) || value <= 0) continue;
    const prev = byMonth.get(key);
    if (!prev || Number(d) > prev.day) byMonth.set(key, { day: Number(d), nav: value });
  }
  const keys = [...byMonth.keys()].filter((k) => k < thisMonth).sort();
  if (!keys.length) return [];
  const out = [];
  let last = null;
  for (let k = keys[0]; k <= keys.at(-1); k = nextMonth(k)) {
    if (byMonth.has(k)) last = byMonth.get(k).nav;
    out.push([k, Number(last.toFixed(4))]);
  }
  return out;
}

function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

const today = new Date();
const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const out = { generatedAt: today.toISOString(), source: 'MFapi.in (AMFI NAV data)', categories: [] };

for (const cat of config.categories) {
  const candidates = await findCandidates(cat);
  const usable = [];
  for (const scheme of candidates.slice(0, 15)) {
    const full = await getJson(`${API}/mf/${scheme.schemeCode}`);
    const monthly = toMonthly(full.data || [], thisMonth);
    const name = full.meta?.scheme_name || scheme.schemeName;
    if (!monthly.length) continue;
    const last = monthly.at(-1)[0];
    if (monthsBetween(last, thisMonth) > 3) {
      console.log(`  skipped ${scheme.schemeCode} ${name}: data stopped in ${last}`);
      continue;
    }
    if (monthly.length < MIN_MONTHS) {
      console.log(`  skipped ${scheme.schemeCode} ${name}: only ${monthly.length} months of data`);
      continue;
    }
    usable.push({ scheme, monthly, name });
  }

  if (!usable.length) {
    console.log(`\nNo usable fund for ${cat.id}. Matching schemes found: ${candidates.length}`);
    for (const r of candidates.slice(0, 25)) console.log(`  ${String(r.schemeCode).padEnd(8)} ${r.schemeName}`);
    throw new Error(`No usable fund for ${cat.id}. Add another name to proxyQueries or set schemeCode in data/categories.json.`);
  }

  // Pick the fund with the longest history.
  usable.sort((a, b) => b.monthly.length - a.monthly.length);
  const { scheme, monthly, name } = usable[0];
  console.log(`${cat.id.padEnd(16)} ${String(scheme.schemeCode).padEnd(8)} ${monthly[0][0]} → ${monthly.at(-1)[0]}  ${name}`);
  out.categories.push({
    id: cat.id,
    label: cat.label,
    plain: cat.plain,
    assetClass: cat.assetClass,
    proxy: { schemeCode: Number(scheme.schemeCode), name, plan: cat.plan || 'regular' },
    monthly
  });
}

const start = out.categories.map((c) => c.monthly[0][0]).sort().at(-1);
console.log(`\nAll fund types share data from ${start}.`);
await writeFile(new URL('../data/returns-data.json', import.meta.url), JSON.stringify(out));
console.log('Saved data/returns-data.json');
