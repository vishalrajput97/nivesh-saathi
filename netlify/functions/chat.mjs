// POST /api/chat  { messages: [{role, content}], answers?: {...onboarding answers} }
// Keeps API keys on the server. Set GROQ_API_KEY (and optionally GEMINI_API_KEY) in Netlify.
import data from '../../data/returns-data.json' with { type: 'json' };
import { runAgent } from '../../src/agent/agent.js';
import { providersFromEnv, BusyError } from '../../src/agent/llm.js';

// Simple per-visitor limit. Resets when the function restarts, which is fine for a demo.
const DAILY_LIMIT = 30;
const counts = new Map();
function overLimit(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}:${ip}`;
  const n = (counts.get(key) || 0) + 1;
  counts.set(key, n);
  if (counts.size > 5000) counts.clear();
  return n > DAILY_LIMIT;
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' }
});

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const providers = providersFromEnv(process.env);
  if (!providers.length) return json(500, { error: 'The AI key is not set up yet.' });

  if (overLimit(context?.ip || 'unknown')) {
    return json(429, { error: "You've reached today's limit for this demo. Please come back tomorrow." });
  }

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid request.' }); }

  try {
    const result = await runAgent({ messages: body.messages, answers: body.answers, data, providers });
    return json(200, { reply: result.reply, tools: result.tools.map((t) => t.name), provider: result.provider });
  } catch (err) {
    if (err instanceof BusyError) {
      return json(503, { error: 'The guide is busy right now. Please try again in a minute.' });
    }
    console.error(err);
    return json(400, { error: err.message.slice(0, 200) });
  }
};

export const config = { path: '/api/chat' };
