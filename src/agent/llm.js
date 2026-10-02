// Talks to Groq, falling back to Gemini when Groq is busy or out of free quota.
// Both use the OpenAI-style chat format.

// Removes spaces, line breaks and quote marks that often sneak in when pasting keys.
export function cleanKey(value) {
  return String(value || '').trim().replace(/^['"`]+|['"`]+$/g, '').replace(/^Bearer\s+/i, '').trim();
}

export function providersFromEnv(rawEnv) {
  const env = { ...rawEnv, GROQ_API_KEY: cleanKey(rawEnv.GROQ_API_KEY), GEMINI_API_KEY: cleanKey(rawEnv.GEMINI_API_KEY) };
  const list = [];
  if (env.GROQ_API_KEY) {
    list.push({
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || 'openai/gpt-oss-120b'
    });
  }
  if (env.GEMINI_API_KEY) {
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

async function callOnce(p, body, fetchImpl) {
  const res = await fetchImpl(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ ...body, model: p.model })
  });
  if (res.status === 429 || res.status >= 500) throw new BusyError(`${p.name} returned ${res.status}`);
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`${p.name} returned ${res.status}: ${text.slice(0, 300)}`);
    // The model produced a malformed tool call. These are random, so one retry usually fixes it.
    err.retryable = res.status === 400 && text.includes('tool_use_failed');
    throw err;
  }
  return res.json();
}

async function callProvider(p, body, fetchImpl) {
  try {
    return await callOnce(p, body, fetchImpl);
  } catch (err) {
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
      if (!(err instanceof BusyError)) console.error(err.message);
    }
  }
  throw new BusyError(lastErr ? lastErr.message : 'No AI provider configured');
}
