// Nivesh Saathi: the app. Onboarding and the plan run in the browser using the
// same engine as the server. Only "Ask anything" talks to the AI.
import { buildPlan } from './engine/plan.js';
import { sipFutureValue } from './engine/returns.js';

const STORE = 'nivesh-saathi:answers:v1';
const app = document.getElementById('app');
const restartBtn = document.getElementById('restartBtn');

const state = {
  data: null,
  answers: loadAnswers(),
  chat: [],
  busy: false,
  glossaryOpen: false
};

/* ---------- helpers ---------- */
function loadAnswers() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function saveAnswers() {
  try { localStorage.setItem(STORE, JSON.stringify(state.answers)); } catch { /* storage may be blocked */ }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
function inrShort(n) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} crore`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} lakh`;
  return inr(n);
}
const pct = (r) => `${(r * 100).toFixed(1)}%`;
function monthName(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}
const has = (k) => state.answers[k] !== undefined && state.answers[k] !== null && state.answers[k] !== '';
const onboardingDone = () => ['goal', 'years', 'monthly', 'reaction', 'hasEmergencyFund', 'hasCostlyDebt'].every(has);

const ICON = {
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  target: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B6E5D" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>',
  chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B6E5D" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z"/></svg>',
  bars: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B6E5D" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4v5c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V7z"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
  send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

function steps(n) {
  return `<div class="steps" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div>`;
}
function backBtn(to) {
  return `<button type="button" class="back" data-go="${to}">${ICON.back} Back</button>`;
}

/* ---------- screens ---------- */
const GOALS = ["Child's education", 'Buy a house', 'Retirement', 'Grow my savings'];
const YEARS = [2, 3, 5, 10, 15, 20];
const AMOUNTS = [1000, 2500, 5000, 10000];

const screens = {
  welcome() {
    const done = onboardingDone();
    return `
      <section class="hero fade">
        <h1>Start investing, without the jargon.</h1>
        <p class="lede">Answer a few simple questions and get a mutual fund and SIP plan, explained in plain words.</p>
        <div class="stack">
          <div class="feature"><div class="ic">${ICON.target}</div><div><b>Built around your goal</b><span>A child's education, a house, retirement or just growing savings.</span></div></div>
          <div class="feature"><div class="ic">${ICON.chat}</div><div><b>Every term explained</b><span>Ask "what is NAV?" any time and get a simple answer.</span></div></div>
          <div class="feature"><div class="ic">${ICON.bars}</div><div><b>Honest return ranges</b><span>See weak, typical and strong outcomes from real past data, never a promise.</span></div></div>
          <div class="callout warm">${ICON.info}<div>An education tool, not investment advice. It suggests fund types, not specific funds, and never guarantees returns.</div></div>
        </div>
        <div class="actions">
          ${done ? `<button class="btn primary" type="button" data-go="plan">See my plan</button><button class="btn secondary" type="button" data-action="restart">Start a new plan</button>`
                 : `<button class="btn primary" type="button" data-go="goal">Let's start</button><p class="fine" style="text-align:center">Takes about 2 minutes · No sign-up needed</p>`}
        </div>
      </section>`;
  },

  goal() {
    const a = state.answers;
    const customGoal = has('goal') && !GOALS.includes(a.goal);
    let html = `<section class="fade">${steps(1)}<p class="step-label">Step 1 of 4 · Your goal</p>
      <h1 class="screen-title">What are you saving for?</h1><p class="sub">This helps pick the right plan. You can change answers any time.</p>
      <div class="thread">
        <div class="bubble bot">What are you saving for?</div>
        <div class="chips">${GOALS.map((g) => `<button type="button" class="chip" data-set="goal" data-value="${esc(g)}" aria-pressed="${a.goal === g}">${esc(g)}</button>`).join('')}</div>
        <form class="inline-form" data-form="goal"><label for="goalOther">Something else:</label><input class="field" id="goalOther" name="v" maxlength="60" placeholder="e.g. A trip abroad" value="${customGoal ? esc(a.goal) : ''}"><button class="small-btn" type="submit">Set</button></form>`;
    if (has('goal')) {
      html += `<div class="bubble me">${esc(a.goal)}</div>
        <div class="bubble bot">When will you need this money?</div>
        <div class="chips">${YEARS.map((y) => `<button type="button" class="chip" data-set="years" data-value="${y}" aria-pressed="${a.years === y}">${y} years</button>`).join('')}</div>
        <form class="inline-form" data-form="years"><label for="yearsOther">Other:</label><input class="field" id="yearsOther" name="v" type="number" inputmode="numeric" min="1" max="40" placeholder="Years, 1 to 40" value="${has('years') && !YEARS.includes(a.years) ? a.years : ''}"><button class="small-btn" type="submit">Set</button></form>`;
    }
    if (has('years')) {
      html += `<div class="bubble me">In ${a.years} year${a.years === 1 ? '' : 's'}</div>
        <div class="bubble bot">How much could you invest every month through a <button type="button" class="term" data-explain="sip">SIP</button>?</div>
        ${state.glossaryOpen ? `<div class="callout cool">${ICON.info}<div><b>SIP (Systematic Investment Plan):</b> investing a fixed amount in a mutual fund every month, automatically.</div></div>` : ''}
        <div class="chips">${AMOUNTS.map((m) => `<button type="button" class="chip" data-set="monthly" data-value="${m}" aria-pressed="${a.monthly === m}">${inr(m)}</button>`).join('')}</div>
        <form class="inline-form" data-form="monthly"><label for="amtOther">Other amount:</label><input class="field" id="amtOther" name="v" type="number" inputmode="numeric" min="500" max="1000000" step="100" placeholder="₹ per month" value="${has('monthly') && !AMOUNTS.includes(a.monthly) ? a.monthly : ''}"><button class="small-btn" type="submit">Set</button></form>`;
    }
    if (has('monthly')) html += `<div class="bubble me">${inr(a.monthly)} a month</div>`;
    html += `</div><div class="actions"><button class="btn primary" type="button" data-go="risk" ${['goal', 'years', 'monthly'].every(has) ? '' : 'disabled'}>Continue</button></div></section>`;
    return html;
  },

  risk() {
    const r = state.answers.reaction;
    const opt = (v, label) => `<button type="button" class="option" data-set="reaction" data-value="${v}" aria-pressed="${r === v}"><span class="dot"></span>${label}</button>`;
    return `<section class="fade">${backBtn('goal')}${steps(2)}<p class="step-label">Step 2 of 4 · Comfort with ups and downs</p>
      <h1 class="screen-title">How would you react to a fall?</h1>
      <p class="sub">Markets go up and down. This decides how much risk your plan takes.</p>
      <div class="card stack">
        <p class="q">Say you invest ₹1,00,000. In a bad year it drops to ₹80,000. What would you do?</p>
        ${opt('sell', 'Sell everything to stop the loss')}
        ${opt('wait', 'Wait for it to recover')}
        ${opt('buy_more', 'Invest more while prices are low')}
      </div>
      <p class="fine" style="margin-top:12px">There's no wrong answer. Being honest gives you a plan you'll actually stick with.</p>
      <div class="actions"><button class="btn primary" type="button" data-go="safety" ${r ? '' : 'disabled'}>Continue</button></div></section>`;
  },

  safety() {
    const a = state.answers;
    const yn = (key, yesLabel, noLabel, yesVal) => `<div class="yesno">
        <button type="button" class="chip" data-set="${key}" data-value="${yesVal}" aria-pressed="${a[key] === yesVal}">${yesLabel}</button>
        <button type="button" class="chip" data-set="${key}" data-value="${!yesVal}" aria-pressed="${a[key] === !yesVal}">${noLabel}</button></div>`;
    return `<section class="fade">${backBtn('risk')}${steps(3)}<p class="step-label">Step 3 of 4 · Safety check</p>
      <h1 class="screen-title">Two quick safety checks</h1>
      <p class="sub">These matter more than picking any fund.</p>
      <div class="card stack">
        <p class="q">Do you have savings to cover 3–6 months of expenses?</p>
        ${yn('hasEmergencyFund', 'Yes', 'Not yet', true)}
        <div class="divider"></div>
        <p class="q">Any high-interest loans, like credit card dues?</p>
        ${yn('hasCostlyDebt', 'Yes', 'No', true)}
      </div>
      <div class="stack" style="margin-top:14px">
        ${a.hasEmergencyFund === false ? `<div class="callout warm">${ICON.shield}<div><b>Build a safety cushion first.</b> Your plan will put part of each month into a liquid fund until you have about 3 months of expenses saved.</div></div>` : ''}
        ${a.hasCostlyDebt === true ? `<div class="callout warm">${ICON.info}<div><b>Consider clearing costly loans first.</b> Credit card interest is usually far higher than what investments return.</div></div>` : ''}
      </div>
      <div class="actions"><button class="btn primary" type="button" data-go="plan" ${has('hasEmergencyFund') && has('hasCostlyDebt') ? '' : 'disabled'}>See my plan</button></div></section>`;
  },

  plan() {
    const p = buildPlan(state.answers, state.data);
    const g = p.funds.filter((f) => f.assetClass === 'growth');
    const s = p.funds.filter((f) => f.assetClass !== 'growth');
    const fundCard = (f) => `<div class="card fund"><div class="top"><span>${esc(f.label)}</span><span class="amt ${f.assetClass === 'growth' ? '' : 'stab'}">${inr(f.monthly)}<span class="sr"> a month</span></span></div><p>${esc(f.plain)}</p></div>`;
    return `<section class="fade">${backBtn('safety')}${steps(4)}<p class="step-label">Step 4 of 4 · Your plan</p>
      <div class="stack">
        <div class="profile">
          <span class="eyebrow">Your investor type</span>
          <span class="name">${esc(p.risk.profile.label)}</span>
          <p>${esc(p.risk.profile.plain)}</p>
          ${p.risk.reason ? `<p><b>Note:</b> ${esc(p.risk.reason)}</p>` : ''}
          <div class="tags"><span class="tag">${esc(p.goal)}</span><span class="tag">${p.years} years</span><span class="tag">${inr(p.monthly)} a month</span></div>
        </div>
        <div class="card stack">
          <h2>How your money is split</h2>
          <div class="split" role="img" aria-label="${p.split.growth}% growth, ${p.split.stability}% stability">
            ${p.split.growth ? `<div class="g" style="width:${p.split.growth}%"></div>` : ''}${p.split.stability ? `<div class="s" style="width:${p.split.stability}%"></div>` : ''}
          </div>
          ${p.split.growth ? `<div class="legend"><span class="sw" style="background:var(--brand)"></span><div><b>Growth · ${p.split.growth}%</b> <span>Owns shares in companies. Grows more over long periods but moves up and down.</span></div></div>` : ''}
          ${p.split.stability ? `<div class="legend"><span class="sw" style="background:var(--saffron)"></span><div><b>Stability · ${p.split.stability}%</b> <span>Lends money to the government and companies. Steadier, grows slower.</span></div></div>` : ''}
        </div>
        ${p.notes.map((n) => `<div class="callout warm">${ICON.shield}<div>${esc(n.text)}</div></div>`).join('')}
        <h2 style="margin-top:6px">Fund types for your plan</h2>
        ${[...g, ...s].map(fundCard).join('')}
        <p class="fine">These are fund types, not specific funds. Compare funds of each type on your investment app (look for low expense ratio and a direct plan), or ask a SEBI-registered adviser for a personal pick.</p>
      </div>
      <div class="actions"><button class="btn primary" type="button" data-go="growth">See what it could grow to</button><button class="btn secondary" type="button" data-go="ask">Ask a question about my plan</button></div></section>`;
  },

  growth() {
    const a = state.answers;
    return `<section class="fade">${backBtn('plan')}
      <h1 class="screen-title">Possible growth</h1>
      <p class="sub">Based on how a similar mix of funds has done in the past.</p>
      <div class="card stack" id="growthResult">${growthResult()}</div>
      <div class="card stack" style="margin-top:14px">
        <h2>Try different numbers</h2>
        <label class="slider"><span class="row-between"><span>Monthly amount</span><span id="mVal">${inr(a.monthly)}</span></span>
          <input type="range" id="mRange" min="500" max="100000" step="500" value="${Math.min(100000, a.monthly)}" aria-valuetext="${inr(a.monthly)} a month"></label>
        <label class="slider"><span class="row-between"><span>Years</span><span id="yVal">${a.years}</span></span>
          <input type="range" id="yRange" min="1" max="30" step="1" value="${Math.min(30, a.years)}" aria-valuetext="${a.years} years"></label>
        <p class="fine">Changing the years can change your plan's mix, since shorter goals need steadier funds.</p>
      </div>
      <div class="actions"><button class="btn secondary" type="button" data-go="ask">Ask a question about my plan</button></div></section>`;
  },

  ask() {
    const done = onboardingDone();
    const suggestions = done
      ? ['Why this split for me?', 'What is an expense ratio?', 'What if I invest ₹2,000 more a month?', 'Direct vs regular plan?']
      : ['What is a SIP?', 'What is NAV?', 'Is 20% a year realistic?', 'SIP kya hota hai?'];
    return `<section class="fade">${backBtn(done ? 'plan' : 'welcome')}
      <h1 class="screen-title">Ask anything</h1>
      <p class="sub">Simple answers, no jargon.${done ? ' Your plan is shared with the guide so answers fit you.' : ''}</p>
      <div class="chat" id="chat" aria-live="polite">${chatHtml()}</div>
      <div class="chips" id="suggest" style="margin-top:14px">${suggestions.map((q) => `<button type="button" class="chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <form class="composer" data-form="ask">
        <label for="askInput" class="sr">Your question</label>
        <input class="field" id="askInput" name="q" maxlength="500" autocomplete="off" placeholder="Ask about any word or number">
        <button class="send" type="submit" aria-label="Send" ${state.busy ? 'disabled' : ''}>${ICON.send}</button>
      </form></section>`;
  }
};

/* ---------- growth ---------- */
function growthResult() {
  const p = buildPlan(state.answers, state.data);
  const pr = p.projection;
  if (!pr.ok) return `<p>${esc(pr.reason)}</p>`;
  const o = pr.outcomes;
  return `
    <p class="big-q">What ${inr(p.monthly)} a month could become in ${p.years} year${p.years === 1 ? '' : 's'}</p>
    <div class="row-between"><span style="color:var(--muted)">You invest</span><b>${inr(pr.invested)}</b></div>
    ${chartSvg(p.monthly, p.years, o)}
    <div class="outcomes">
      <div class="outcome"><span class="l">Weak markets</span><span class="v">${inrShort(o.weak.value)}</span><span class="r">${pct(o.weak.annualRate)} a year</span></div>
      <div class="outcome mid"><span class="l">Typical</span><span class="v">${inrShort(o.typical.value)}</span><span class="r">${pct(o.typical.annualRate)} a year</span></div>
      <div class="outcome"><span class="l">Strong markets</span><span class="v">${inrShort(o.strong.value)}</span><span class="r">${pct(o.strong.annualRate)} a year</span></div>
    </div>
    <p class="fine">Based on ${pr.basis.windowsCounted} past ${pr.basis.windowYears}-year periods of a similar mix, ${monthName(pr.basis.from)} to ${monthName(pr.basis.to)}.${pr.basis.extrapolated ? ` For longer goals we use ${pr.basis.windowYears}-year periods and extend them to your ${p.years} years, so the range covers many different market starting points.` : ''} Weak and strong are the 10th and 90th percentile. Past returns don't guarantee future results.</p>`;
}

function chartSvg(monthly, years, o) {
  const W = 320, H = 160, padL = 6, padR = 6, padT = 10, padB = 22;
  const months = years * 12;
  const rate = (annual) => Math.pow(1 + annual, 1 / 12) - 1;
  const steps = 24;
  const pts = (fn) => Array.from({ length: steps + 1 }, (_, i) => { const m = Math.round((months * i) / steps); return [m, fn(m)]; });
  const curve = (annual) => pts((m) => (m === 0 ? 0 : sipFutureValue(monthly, m, rate(annual))));
  const weak = curve(o.weak.annualRate), typ = curve(o.typical.annualRate), strong = curve(o.strong.annualRate);
  const inv = pts((m) => monthly * m);
  const max = Math.max(...strong.map((p) => p[1]), 1);
  const x = (m) => padL + ((W - padL - padR) * m) / months;
  const y = (v) => H - padB - ((H - padT - padB) * v) / max;
  const line = (arr) => arr.map(([m, v], i) => `${i ? 'L' : 'M'}${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const band = `${line(strong)} ${[...weak].reverse().map(([m, v]) => `L${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')} Z`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Range of outcomes widening over ${years} years, from ${inrShort(o.weak.value)} to ${inrShort(o.strong.value)}, compared with ${inrShort(monthly * months)} invested">
    <path d="${band}" fill="#DDEFEA"></path>
    <path d="${line(typ)}" fill="none" stroke="#0B6E5D" stroke-width="3" stroke-linecap="round"></path>
    <path d="${line(inv)}" fill="none" stroke="#8A9893" stroke-width="2" stroke-dasharray="5 5"></path>
    <text x="${padL}" y="${H - 6}" font-size="10" fill="#4A5A54" font-family="Manrope, sans-serif">Today</text>
    <text x="${W - padR}" y="${H - 6}" font-size="10" fill="#4A5A54" font-family="Manrope, sans-serif" text-anchor="end">${years} yr${years === 1 ? '' : 's'}</text>
  </svg>
  <p class="fine">Shaded area: weak to strong. Green line: typical. Dashed line: what you put in.</p>`;
}

/* ---------- chat ---------- */
function renderMarkdown(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>');
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let html = '', list = null, para = [];
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
  const flushList = () => { if (list) { html += `<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\|?\s*-{3,}/.test(line)) continue;            // table divider lines
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (!line) { flushPara(); flushList(); continue; }
    if (bullet || num) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((bullet || num)[1]);
      continue;
    }
    flushList();
    para.push(line.replace(/^\|\s*|\s*\|$/g, '').replace(/\s*\|\s*/g, ' · '));
  }
  flushPara(); flushList();
  return html;
}

function chatHtml() {
  if (!state.chat.length) {
    return `<div class="answer">Hi! Ask me about any investing word or number. I'll keep it simple${onboardingDone() ? ', and use your plan where it helps' : ''}.</div>`;
  }
  return state.chat.map((m) => {
    if (m.role === 'user') return `<div class="bubble me">${esc(m.content)}</div>`;
    if (m.error) return `<div class="answer error">${esc(m.content)}</div>`;
    return `<div class="answer">${renderMarkdown(m.content)}</div>`;
  }).join('') + (state.busy ? '<div class="typing">Thinking…</div>' : '');
}

function refreshChat() {
  const box = document.getElementById('chat');
  if (!box) return;
  box.innerHTML = chatHtml();
  const send = app.querySelector('.send');
  if (send) send.disabled = state.busy;
  box.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function ask(text) {
  const q = String(text || '').trim();
  if (!q || state.busy) return;
  state.chat.push({ role: 'user', content: q });
  state.busy = true;
  refreshChat();
  try {
    const history = state.chat.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history, answers: onboardingDone() ? state.answers : null })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
    state.chat.push({ role: 'assistant', content: body.reply || 'Sorry, I could not answer that.' });
  } catch (err) {
    state.chat.push({ role: 'assistant', content: err.message || 'Could not reach the guide. Check your connection and try again.', error: true });
  } finally {
    state.busy = false;
    refreshChat();
  }
}

/* ---------- routing ---------- */
function route() {
  const name = location.hash.replace('#', '') || 'welcome';
  return screens[name] ? name : 'welcome';
}
function allowed(name) {
  const a = state.answers;
  if (name === 'risk') return ['goal', 'years', 'monthly'].every(has);
  if (name === 'safety') return ['goal', 'years', 'monthly', 'reaction'].every(has);
  if (name === 'plan' || name === 'growth') return onboardingDone();
  return true;
}
function go(name) {
  if (location.hash === `#${name}`) render(); else location.hash = name;
}
function render({ keepFocus = false } = {}) {
  if (!state.data) return;
  let name = route();
  if (!allowed(name)) { name = 'welcome'; history.replaceState(null, '', '#welcome'); }
  app.innerHTML = screens[name]();
  if (keepFocus) app.querySelectorAll('.fade').forEach((el) => el.classList.remove('fade'));
  restartBtn.hidden = !Object.keys(state.answers).length;
  document.title = `${{ welcome: 'Nivesh Saathi', goal: 'Your goal', risk: 'Ups and downs', safety: 'Safety check', plan: 'Your plan', growth: 'Possible growth', ask: 'Ask anything' }[name]} · Nivesh Saathi`;
  if (!keepFocus) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
  if (name === 'growth') bindSliders();
  if (name === 'ask') refreshChat();
}

function bindSliders() {
  const m = document.getElementById('mRange'), y = document.getElementById('yRange');
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      state.answers.monthly = Number(m.value);
      state.answers.years = Number(y.value);
      saveAnswers();
      document.getElementById('mVal').textContent = inr(state.answers.monthly);
      document.getElementById('yVal').textContent = state.answers.years;
      m.setAttribute('aria-valuetext', `${inr(state.answers.monthly)} a month`);
      y.setAttribute('aria-valuetext', `${state.answers.years} years`);
      document.getElementById('growthResult').innerHTML = growthResult();
    });
  };
  m.addEventListener('input', update);
  y.addEventListener('input', update);
}

/* ---------- events ---------- */
app.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el || el.disabled) return;
  if (el.dataset.go) return go(el.dataset.go);
  if (el.dataset.set) {
    const key = el.dataset.set; let v = el.dataset.value;
    if (key === 'years' || key === 'monthly') v = Number(v);
    if (key === 'hasEmergencyFund' || key === 'hasCostlyDebt') v = v === 'true';
    state.answers[key] = v;
    saveAnswers();
    return render({ keepFocus: true });
  }
  if (el.dataset.explain) { state.glossaryOpen = !state.glossaryOpen; return render({ keepFocus: true }); }
  if (el.dataset.ask) return ask(el.dataset.ask);
  if (el.dataset.action === 'restart') return restart();
});

app.addEventListener('submit', (e) => {
  const form = e.target.closest('form');
  if (!form) return;
  e.preventDefault();
  const key = form.dataset.form;
  const raw = (form.elements.v || form.elements.q).value.trim();
  if (key === 'ask') { form.elements.q.value = ''; return ask(raw); }
  if (!raw) return;
  if (key === 'goal') state.answers.goal = raw.slice(0, 60);
  if (key === 'years') { const n = Math.round(Number(raw)); if (!(n >= 1 && n <= 40)) return alert('Please enter between 1 and 40 years.'); state.answers.years = n; }
  if (key === 'monthly') { const n = Math.round(Number(raw) / 100) * 100; if (!(n >= 500 && n <= 1000000)) return alert('Please enter between ₹500 and ₹10,00,000 a month.'); state.answers.monthly = n; }
  saveAnswers();
  render({ keepFocus: true });
});

restartBtn.addEventListener('click', restart);
function restart() {
  state.answers = {}; state.chat = []; state.glossaryOpen = false;
  saveAnswers();
  go('welcome');
}

window.addEventListener('hashchange', () => render());

/* ---------- start ---------- */
(async function start() {
  try {
    const res = await fetch('data/returns-data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
    render();
  } catch (err) {
    app.innerHTML = `<div class="callout warm" style="margin-top:24px">${ICON.info}<div>Couldn't load the fund data. Please refresh the page. (${esc(err.message)})</div></div>`;
  }
})();
