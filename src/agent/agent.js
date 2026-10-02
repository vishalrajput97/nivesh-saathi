// The chat loop: send the conversation, run any tools the model asks for,
// and repeat until it gives a final answer.
import { systemPrompt } from './prompt.js';
import { TOOL_DEFINITIONS, makeToolRunner } from './tools.js';
import { chatCompletion } from './llm.js';
import { buildPlan } from '../engine/plan.js';

const MAX_TURNS = 6;       // past messages kept (keeps requests small for free-tier limits)
const MAX_USER_CHARS = 600;
const MAX_ASSISTANT_CHARS = 500; // older answers are shortened before being sent again
const MAX_TOOL_ROUNDS = 4;

export function cleanMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({
      role: m.role,
      content: m.role === 'user'
        ? m.content.slice(0, MAX_USER_CHARS)
        : (m.content.length > MAX_ASSISTANT_CHARS ? m.content.slice(0, MAX_ASSISTANT_CHARS) + ' …' : m.content)
    }));
}

export function safePlan(answers, data) {
  try {
    if (answers && answers.years > 0 && answers.monthly > 0 && answers.reaction) return buildPlan(answers, data);
  } catch { /* ignore bad answers */ }
  return null;
}

export async function runAgent({ messages, answers, data, providers, fetchImpl }) {
  const convo = cleanMessages(messages);
  if (!convo.length || convo.at(-1).role !== 'user') throw new Error('The last message must be from the user.');

  const plan = safePlan(answers, data);
  const runTool = makeToolRunner({ data, answers: plan ? answers : null });
  const history = [{ role: 'system', content: systemPrompt(plan) }, ...convo];
  const toolResults = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const { provider, message } = await chatCompletion(providers, {
      messages: history,
      tools: TOOL_DEFINITIONS,
      tool_choice: round === MAX_TOOL_ROUNDS ? 'none' : 'auto',
      temperature: 0.3,
      max_tokens: 600
    }, fetchImpl);

    const calls = message?.tool_calls || [];
    if (!calls.length) {
      return { reply: (message?.content || '').trim(), provider, tools: toolResults };
    }

    history.push({ role: 'assistant', content: message.content || '', tool_calls: calls });
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* keep empty */ }
      const result = runTool(call.function?.name, args);
      toolResults.push({ name: call.function?.name, args, result });
      history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 3000) });
    }
  }
  return { reply: "Sorry, I couldn't finish that answer. Could you ask again in a simpler way?", provider: null, tools: toolResults };
}
