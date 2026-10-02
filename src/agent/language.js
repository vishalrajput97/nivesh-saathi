// Detects the language of a message so the server can tell the AI exactly
// which language to reply in (the AI alone kept switching languages).

export function detectLanguage(text) {
  const raw = String(text || '');
  if (/[\u0900-\u097F]/.test(raw)) return 'hindi';
  const words = raw.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const hinglish = new Set(['hai', 'hain', 'hota', 'hoti', 'kya', 'kaise', 'kitna', 'kitne', 'aap', 'mujhe', 'mera', 'meri', 'mein', 'karna', 'karte', 'kar', 'ka', 'ki', 'ke', 'se', 'ko', 'paisa', 'paise', 'mahine', 'saal', 'banega', 'milega', 'chahiye', 'nahi', 'kyun', 'acha', 'accha', 'batao', 'samjhao']);
  const hits = words.filter((w) => hinglish.has(w)).length;
  return hits >= 2 && hits / Math.max(words.length, 1) >= 0.2 ? 'hinglish' : 'english';
}

export const LANGUAGE_INSTRUCTION = {
  english: 'Reply in English only.',
  hinglish: 'Reply in Hinglish only: Hindi words written in Roman (English) letters, like "SIP ek tarika hai". Do NOT use Devanagari script.',
  hindi: 'Reply in Hindi only, written in Devanagari script.'
};
