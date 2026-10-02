// Talks to Groq, falling back to Gemini when Groq is busy or out of free quota.
// Both use the OpenAI-style chat format.

// Removes spaces, line breaks and quote marks that often sneak in when pasting keys.
export function cleanKey(value) {
  return String(value || '').trim().replace(/^['"`]+|['"`]+$/g, '').replace(/^Bearer\s+/i, '').trim();
}

export function providersFromEnv(rawEnv) {
  const env = { ...rawEnv, GROQ_API_KEY: cleanKey(rawEnv.GROQ_API_KEY), GEMINI_API_KEY: cleanKey(rawEnv.GEMINI_API_KEY) };
  // Skip keys that are clearly not valid, so one bad key doesn't cause errors on every request.
  if (env.GROQ_API_KEY && !env.GROQ_API_KEY.startsWith('gsk_')) {
    console.warn('GROQ_API_KEY does not start with "gsk_", so it is being ignored.');
    env.GROQ_API_KEY = '';
  }
  if (env.GEMINI_API_KEY && !env.GEMINI_API_KEY.startsWith('AIza')) {
    console.warn('GEMINI_API_KEY does not start with "AIza", so it is being ignored.');
    env.GEMINI_API_KEY = '';
  }
  const list = [];
  if (env.GROQ_API_KEY) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    list.push({ name: 'groq', url, key: env.GROQ_API_KEY, model: env.GROQ_MODEL || 'openai/gpt-oss-120b' });
    // Groq's free limits are per model, so a second model roughly doubles free capacity.
    const backup = env.GROQ_BACKUP_MODEL === 'none' ? null : (env.GROQ_BACKUP_MODEL || 'openai/gpt-oss-20b');
    if (backup) list.push({ name: 'groq-backup', url, key: env.GROQ_API_KEY, model: backup });
  }
  // Only use a Gemini key that looks real (Google AI Studio keys start with "AIza").
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.startsWith('AIza')) {
    list.push({
      name: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || 'gemini-2.5-flash'
    });
  }
  return list;
}

export class BusyError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOnce(p, body, fetchImpl) {
  const res = await fetchImpl(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ ...body, model: p.model })
  });
  if (res.status === 429 || res.status >= 500) {
    const err = new BusyError(`${p.name} returned ${res.status}`);
    const wait = Number(res.headers?.get?.('retry-after'));
    if (res.status === 429 && Number.isFinite(wait) && wait > 0 && wait <= 6) err.retryAfterMs = wait * 1000;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`${p.name} returned ${res.status}: ${text.slice(0, 300)}`);
    // The model produced a malformed tool call or unparseable output. These are random, so one retry usually fixes it.
    err.retryable = res.status === 400 && (text.includes('tool_use_failed') || text.includes('output_parse_failed'));
    throw err;
  }
  return res.json();
}

async function callProvider(p, body, fetchImpl) {
  try {
    return await callOnce(p, body, fetchImpl);
  } catch (err) {
    if (err.retryAfterMs) {
      // Asked to wait a few seconds (per-minute limit): wait once, then try again.
      console.warn(`${p.name}: rate limited, retrying in ${err.retryAfterMs} ms`);
      await sleep(err.retryAfterMs);
      return callOnce(p, body, fetchImpl);
    }
    if (!err.retryable) throw err;
    console.warn(`${p.name}: retrying after a malformed tool call`);
    return callOnce(p, { ...body, temperature: 0 }, fetchImpl);
  }
}

// Tries each provider in order; moves on if one is busy or rate-limited.
export async function chatCompletion(providers, body, fetchImpl = fetch) {
  let lastErr = null;
  for (const p of providers) {
    try {
      const json = await callProvider(p, body, fetchImpl);
      return { provider: p.name, message: json.choices?.[0]?.message };
    } catch (err) {
      lastErr = err;
      console.error(err.message);
    }
  }
  throw new BusyError(lastErr ? lastErr.message : 'No AI provider configured');
}
