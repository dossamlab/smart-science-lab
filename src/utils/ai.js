// Client for /api/ai (netlify/functions/ai.mjs). The Gemini key lives only on the server.

export async function askAI({ question, chemId, schoolName, guidelines, history, image }) {
  let res;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, chemId, schoolName, guidelines, history, image }),
    });
  } catch {
    throw Object.assign(new Error('인터넷 연결을 확인해 주세요.'), { notices: [] });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw Object.assign(new Error(body.message || 'AI 서버에 연결하지 못했습니다.'), { notices: body.notices || [] });
  }
  return body; // { text, notices, model, chemicals }
}

// Emergency answers start with "지금 바로: …" (RULES in netlify/functions/ai.mjs), often wrapped in markdown.
const URGENT = /^(?:🚨\s*)?지금\s*바로\s*\**\s*[:：]\s*\**\s*/;

/** Splits off that first line so it can be shown on its own: { urgent, rest }; urgent is '' when absent. */
export function splitUrgent(text) {
  const lines = String(text).split('\n');
  const i = lines.findIndex(line => line.trim());
  const first = i === -1 ? '' : lines[i].replace(/^[\s*#>]+/, '');
  if (!URGENT.test(first)) return { urgent: '', rest: String(text) };
  return {
    urgent: first.replace(URGENT, '').replace(/\*\*/g, '').trim(),
    rest: lines.slice(i + 1).join('\n').replace(/^\n+/, ''),
  };
}
