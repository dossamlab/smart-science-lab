import { test } from 'node:test';
import assert from 'node:assert/strict';

const { default: handler, generateWithFallback, maskPersonal, MODEL_CHAIN, lookupChemicals, safetyInstruction } = await import('../netlify/functions/ai.mjs');

const err = (status, message = 'x') => Object.assign(new Error(message), { status });
const fakeAi = (plan) => {
  const called = [];
  return {
    called,
    models: {
      generateContent: async ({ model }) => {
        called.push(model);
        if (plan[model] instanceof Error) throw plan[model];
        return { text: `ok:${model}` };
      },
    },
  };
};

test('model chain order is 3.8 -> 3.5 Flash', () => {
  assert.deepEqual(MODEL_CHAIN, ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
});

test('falls back with a reason for every switch', async () => {
  const ai = fakeAi({ 'gemini-3.8-flash': err(503), 'gemini-3.7-flash': err(429, 'GenerateRequestsPerDayPerProjectPerModel') });
  const r = await generateWithFallback(ai, {});
  assert.equal(r.text, 'ok:gemini-3.6-flash');
  assert.equal(r.model, 'gemini-3.6-flash');
  assert.match(r.notices[0], /Gemini 3\.8 Flash 서버에 요청이 몰려.*Gemini 3\.7 Flash로 다시 시도합니다\. \(2\/4\)/);
  assert.match(r.notices[1], /Gemini 3\.7 Flash의 오늘 무료 사용량.*Gemini 3\.6 Flash로 다시 시도합니다\. \(3\/4\)/);
});

test('a bad key stops immediately', async () => {
  const ai = fakeAi({ 'gemini-3.8-flash': err(400, 'API key not valid') });
  await assert.rejects(generateWithFallback(ai, {}), /AI 서비스 키가 올바르지 않습니다/);
  assert.deepEqual(ai.called, ['gemini-3.8-flash']);
});

test('all models out of daily quota -> daily message with 3 notices', async () => {
  const d = err(429, 'PerDay');
  const ai = fakeAi(Object.fromEntries(MODEL_CHAIN.map(m => [m, d])));
  await assert.rejects(generateWithFallback(ai, {}), (e) => /오늘 사용할 수 있는 무료 AI 호출/.test(e.message) && e.notices.length === 3);
});

test('phone and resident numbers never reach Google', () => {
  assert.equal(maskPersonal('담임 010-0000-0000, 행정실 031 000 0000'), '담임 [전화번호], 행정실 [전화번호]');
  assert.equal(maskPersonal('주민번호 000000-3000000'), '주민번호 [주민번호]');
  assert.equal(maskPersonal('CAS 7440-23-5, 15분, 25000 ppm'), 'CAS 7440-23-5, 15분, 25000 ppm');
});

test('chemicals named in a question are looked up in KOSHA and put into the prompt', async () => {
  const requested = [];
  const sections = (label) => ({
    2: [{ name: '유해·위험문구', detail: `${label} 위험문구`, level: 2 }],
    4: [{ name: '피부에 접촉했을 때', detail: `${label} 피부 조치`, level: 1 }, { name: '먹었을 때', detail: '자료없음', level: 1 }],
    10: [{ name: '피해야 할 물질', detail: `${label} 혼합 금지`, level: 1 }],
  });
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    requested.push(u.pathname + u.search);
    const q = u.searchParams.get('q');
    const id = u.searchParams.get('chemId');
    if (q === '7647-01-0') return Response.json({ items: [{ chemId: '001173', cas: '7647-01-0', name: '염화수소' }] });
    if (q === '1310-73-2') return Response.json({ items: [{ chemId: '001100', cas: '1310-73-2', name: '수산화나트륨' }] });
    if (id === '001173') return Response.json({ sections: sections('염산') });
    if (id === '001100') return Response.json({ sections: sections('수산화나트륨') });
    return new Response('{}', { status: 404 });
  };

  const chems = await lookupChemicals('https://lab.example', '수산화나트륨이랑 염산이 손에 묻었어요');
  assert.deepEqual(chems.map(c => c.cas), ['1310-73-2', '7647-01-0']);
  assert.match(chems[1].material, /염산 피부 조치/);
  assert.match(chems[1].material, /염산 혼합 금지/);
  assert.ok(!chems[1].material.includes('자료없음'));
  assert.ok(requested.every(p => p.startsWith('/api/msds?')), 'goes through the cached /api/msds');

  const prompt = safetyInstruction('청학고', '', chems);
  assert.match(prompt, /### 수산화 나트륨 \(CAS 1310-73-2\)/);
  assert.match(prompt, /### 염화 수소\(염산\) \(CAS 7647-01-0\)/);
  assert.match(prompt, /일반적인 '시약이 묻었을 때' 요령으로 대신하지 마십시오/);
  assert.ok(!safetyInstruction('청학고', '', []).includes('물질별 답변 규칙'));

  assert.deepEqual(await lookupChemicals('https://lab.example', '실험실에서 넘어졌어요'), []);
});

const post = (body, headers = {}) => handler(new Request('https://lab.example/api/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));

test('request guards run before any Gemini call', async () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal((await post({ question: 'x' })).status, 503);

  process.env.GEMINI_API_KEY = 'test';
  assert.equal((await handler(new Request('https://lab.example/api/ai'))).status, 405);
  assert.equal((await post({ question: 'x' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('{bad')).status, 400);
  assert.equal((await post({ question: '' })).status, 400);
  assert.equal((await post({ question: 'a'.repeat(501) })).status, 400);
  assert.equal((await post({ question: 'x', chemId: '1;drop' })).status, 400);
});
