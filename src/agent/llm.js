// Talks to Groq, falling back to Gemini when Groq is busy or out of free quota.
// Both use the OpenAI-style chat format.

export function providersFromEnv(env) {
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

async function callProvider(p, body, fetchImpl) {
  const res = await fetchImpl(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ ...body, model: p.model })
  });
  if (res.status === 429 || res.status >= 500) throw new BusyError(`${p.name} returned ${res.status}`);
  if (!res.ok) throw new Error(`${p.name} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
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
