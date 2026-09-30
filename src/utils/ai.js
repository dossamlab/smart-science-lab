// Client for /api/ai (netlify/functions/ai.mjs). The Gemini key lives only on the server.

export async function askAI({ question, chemId, schoolName, guidelines }) {
  let res;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, chemId, schoolName, guidelines }),
    });
  } catch {
    throw Object.assign(new Error('인터넷 연결을 확인해 주세요.'), { notices: [] });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw Object.assign(new Error(body.message || 'AI 서버에 연결하지 못했습니다.'), { notices: body.notices || [] });
  }
  return body; // { text, notices, model }
}
