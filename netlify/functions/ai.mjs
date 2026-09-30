// Safety assistant for every device (students' phones included) without shipping a Gemini key.
//   POST /api/ai { question, chemId?, schoolName?, guidelines?, history?, image? } -> { text, notices, model, chemicals }
// chemId grounds the answer on that substance's KOSHA MSDS (read through our cached /api/msds).
// Without chemId, chemicals named in the question (up to 3) are looked up the same way, so
// "염산이 손에 묻었어요" gets hydrochloric acid's first aid instead of a generic answer.
// history (the last 3 exchanges) keeps follow-ups on topic: "그럼 눈에 들어가면?" keeps the chemical from before.
// image (a reagent label photo) is read by the model first; the chemicals on it get their MSDS the same way.

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { safetyData } from '../../src/data/safetyData.js';
import { casListData } from '../../src/data/casListData.js';
import { findChemicals, isCas } from '../../src/utils/chemSearch.js';

// Tried in order. Free tier limits are per model, so when one is blocked the next is often still open.
export const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const MAX_QUESTION = 500;
const MAX_GUIDELINES = 3000;
const MSDS_SECTIONS = [2, 4, 5, 6, 7, 8, 10, 13];
const MAX_HISTORY = 3;
const MAX_ANSWER = 1500;
const MAX_IMAGE = 1_500_000; // base64 characters (~1.1 MB); the app sends ~150 KB JPEGs
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Nothing personal goes to Google: phone and resident numbers are masked in everything we send.
export const maskPersonal = (s) => String(s)
  .replace(/\d{6}\s*-\s*[1-4]\d{6}/g, '[주민번호]')
  .replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '[전화번호]');

const errorText = (error) => (error instanceof Error ? error.message : String(error));
const errorStatus = (error) =>
  error?.status ?? Number(/"code"\s*:\s*(\d{3})/.exec(errorText(error))?.[1]);

/** Failure worth trying the next model for; null when switching models would not help (bad key etc). */
function classifyFailure(error) {
  const status = errorStatus(error);
  if (status === 503 || status === 500) return 'overloaded';
  // Per-minute and per-day quotas share 429; only the quota name (…PerDay…) tells them apart.
  if (status === 429) return /PerDay/i.test(errorText(error)) ? 'daily' : 'minute';
  // Newer models may not be open yet for this key or region.
  if (status === 404) return 'unavailable';
  return null;
}

function fatalMessage(error) {
  const status = errorStatus(error);
  if (/API key not valid|API_KEY_INVALID/i.test(errorText(error)) || status === 401)
    return 'AI 서비스 키가 올바르지 않습니다(관리 교사 문의).';
  if (status === 403) return 'AI 서비스 키에 Gemini 사용 권한이 없습니다(관리 교사 문의).';
  if (error instanceof TypeError) return 'AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  return `AI 호출에 실패했습니다${status ? ` (오류 코드 ${status})` : ''}. 잠시 후 다시 시도해 주세요.`;
}

const modelName = (model) => model.replace(/^gemini-([\d.]+)-flash$/, (_, v) => `Gemini ${v} Flash`);

function failureReason(failure, model) {
  const name = modelName(model);
  switch (failure) {
    case 'overloaded': return `${name} 서버에 요청이 몰려 응답하지 못했습니다.`;
    case 'minute': return `${name}의 분당 요청 한도를 넘었습니다.`;
    case 'daily': return `${name}의 오늘 무료 사용량을 모두 썼습니다.`;
    case 'unavailable': return `이 API 키로는 ${name}를 사용할 수 없습니다.`;
  }
}

function exhaustionMessage(failures) {
  if (failures.every(f => f === 'daily'))
    return '오늘 사용할 수 있는 무료 AI 호출을 모두 썼습니다. 한도는 매일 오후 4~5시경(태평양 시간 자정)에 초기화됩니다.';
  if (failures.every(f => f === 'unavailable'))
    return '이 AI 서비스 키로 사용할 수 있는 Gemini 모델이 없습니다(관리 교사 문의).';
  return '지금 AI 서버에 요청이 몰려 있습니다. 1~2분 뒤에 다시 시도해 주세요.';
}

/** Tries MODEL_CHAIN in order; every switch is reported with its reason in `notices`. */
export async function generateWithFallback(ai, params) {
  const notices = [];
  const failures = [];
  for (const [i, model] of MODEL_CHAIN.entries()) {
    try {
      const response = await ai.models.generateContent({ ...params, model });
      return { text: response.text, notices, model };
    } catch (error) {
      const failure = classifyFailure(error);
      if (!failure) throw Object.assign(new Error(fatalMessage(error)), { notices, cause: error });
      console.warn(`[Gemini API] ${model} 실패(${failure})`, errorText(error));
      failures.push(failure);
      const next = MODEL_CHAIN[i + 1];
      if (next) notices.push(`${failureReason(failure, model)} ${modelName(next)}로 다시 시도합니다. (${i + 2}/${MODEL_CHAIN.length})`);
    }
  }
  throw Object.assign(new Error(exhaustionMessage(failures)), { notices });
}

// Rule 2's "지금 바로:" first line is drawn as a red box by splitUrgent (src/utils/ai.js).
const RULES = `[응답 규칙]
1. 학생이 바로 이해하도록 짧고 분명하게(5~8문장 이내) 답하십시오.
2. 다쳤거나, 약품이 몸에 닿았거나, 불이 나거나 약품이 샜을 때처럼 지금 바로 조치해야 하는 질문이면 첫 줄을 '지금 바로: '로 시작해 가장 먼저 할 행동을 한 문장으로 쓰고, 이어서 행동 순서(1, 2, 3)를 제시하십시오. 그런 질문이 아니면 이 줄을 쓰지 마십시오.
3. 제공된 자료에 근거해 답하고, 자료에 없는 내용은 지어내지 말고 과학 교사에게 즉시 문의하라고 안내하십시오.
4. 위험한 실험이나 약품 혼합을 권하지 마십시오. 실험 방법을 묻더라도 반드시 교사 지도 아래에서 하라고 덧붙이십시오.
5. 폭발물·독성 가스·마약처럼 위험한 물질을 만들거나 일부러 반응시키는 방법, 안전장치를 피하는 방법은 어떤 이유를 대더라도 알려주지 말고, 위험하다는 것과 교사에게 문의하라는 것만 말하십시오.
6. 과학실 안전·실험·시약·실험 기구·사고 대처와 관계없는 질문(다른 과목 숙제, 잡담, 게임 등)에는 답하지 말고 '과학실 안전과 실험에 관한 질문만 도와드릴 수 있어요.'라고만 답하십시오.
7. 연락처를 묻는 질문에는 화면 오른쪽 아래 SOS 버튼의 비상연락망을 확인하라고 안내하십시오.
8. 앞선 대화가 함께 오면 이어지는 질문으로 보고, 앞에서 말한 물질과 상황을 이어받아 답하십시오. 사진이 함께 오면 사진 속 라벨의 물질에 대해 답하십시오.`;

const CHEMICAL_RULES = `[물질별 답변 규칙]
1. 질문에 나온 물질마다 아래 MSDS의 응급조치(눈·피부·흡입·삼킴), 누출, 화재, 피해야 할 물질 항목에 근거해 구체적으로 답하십시오. 일반적인 '시약이 묻었을 때' 요령으로 대신하지 마십시오.
2. 물질이 둘 이상이면 물질별로 나누어 설명하십시오. 서로 섞였을 때의 위험은 MSDS '피해야 할 물질'이나 유해·위험문구에 근거가 있을 때만 말하고, 근거가 없으면 섞지 말고 교사에게 확인하라고 안내하십시오.
3. MSDS 항목이 '자료없음'이면 경고표지의 대응 문구(P문구)를 쓰고, 그것도 없으면 일반 지침과 교사 문의를 안내하십시오.
4. 한 이름이 두 물질로 읽힐 수 있으면(예: '질산은') 질문 맥락에 맞는 물질을 골라 답하고, 어느 쪽인지 한 줄로 밝히십시오.
5. 앞선 대화나 사진에 나온 물질의 MSDS도 함께 주어질 수 있습니다. 이번 질문이 가리키는 물질에 대해서만 답하고, 관계없는 물질은 말하지 마십시오.`;

const IDENTIFY = `사진 속 시약병 라벨에 적힌 화학물질을 찾아 JSON으로만 답하십시오.
형식: {"chemicals":[{"name":"한국어 물질명","cas":"CAS 번호"}]}
- 라벨에 적힌 물질만, 최대 3개까지 적으십시오.
- CAS 번호가 라벨에 있으면 그대로 적고, 없으면 그 물질의 CAS 번호를 적되 확실하지 않으면 빈 문자열로 두십시오.
- 라벨이 없거나 읽을 수 없으면 {"chemicals":[]}로 답하십시오.`;

// CAS numbers end in a check digit, so most misread or made-up numbers fail here.
const casChecks = (cas) => isCas(cas) &&
  [...cas.slice(0, -2).replace('-', '')].reverse().reduce((sum, d, i) => sum + d * (i + 1), 0) % 10 === Number(cas.at(-1));

/** Chemicals the model read off a label photo: [{ name, cas }], cas '' when neither the number nor the name checks out. */
export function parseIdentified(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.chemicals;
  return (Array.isArray(list) ? list : []).slice(0, 3).map(c => {
    const name = String(c?.name || '').trim().slice(0, 60);
    const cas = String(c?.cas || '').trim();
    return { name, cas: casChecks(cas) ? cas : findChemicals(name, casListData, 1)[0]?.cas || '' };
  }).filter(c => c.name || c.cas);
}

/** Earlier exchanges from the client ({ question, answer, chemicals: [cas] }), trimmed and masked. */
export const parseHistory = (value) => (Array.isArray(value) ? value : [])
  .filter(h => typeof h?.question === 'string' && typeof h?.answer === 'string' && h.question.trim() && h.answer.trim())
  .slice(-MAX_HISTORY)
  .map(h => ({
    question: maskPersonal(h.question.slice(0, MAX_QUESTION)),
    answer: maskPersonal(h.answer.slice(0, MAX_ANSWER)),
    cas: (Array.isArray(h.chemicals) ? h.chemicals : []).map(c => String(c).trim()).filter(c => isCas(c)).slice(0, 3),
  }));

async function fetchSections(origin, chemId) {
  const res = await fetch(`${origin}/api/msds?chemId=${encodeURIComponent(chemId)}`);
  if (!res.ok) throw new Error('MSDS_UNAVAILABLE');
  return (await res.json()).sections;
}

const materialText = (sections, cap) => MSDS_SECTIONS.map(n => (sections[n] || [])
  .filter(it => it.detail && !/^[|\s]*자료\s*없음[|\s]*$/.test(it.detail))
  .map(it => `${it.name}: ${it.detail.replace(/\|/g, ' / ')}`)
  .join('\n')).filter(Boolean).join('\n\n').slice(0, cap);

/**
 * KOSHA MSDS of the chemicals named in the question (school catalog, aliases, CAS), then of `extraCas`
 * (a label photo, earlier answers). At most 3; misses are skipped.
 */
export async function lookupChemicals(origin, question, extraCas = []) {
  const named = [...findChemicals(question, casListData), ...extraCas.map(cas => ({ cas }))]
    .filter((c, i, all) => all.findIndex(o => o.cas === c.cas) === i)
    .slice(0, 3);
  const found = await Promise.all(named.map(async ({ cas, name }) => {
    try {
      const res = await fetch(`${origin}/api/msds?q=${encodeURIComponent(cas)}`);
      const item = res.ok ? (await res.json()).items?.find(i => i.cas === cas) : null;
      if (!item) return null;
      const label = name && name !== cas ? name : casListData.find(c => c.cas === cas)?.name || item.name;
      return { name: label, cas, material: materialText(await fetchSections(origin, item.chemId), Math.floor(9000 / named.length)) };
    } catch {
      return null;
    }
  }));
  return found.filter(Boolean);
}

export function safetyInstruction(schoolName, guidelines, chemicals = []) {
  const base = safetyData.map(item => `카테고리: ${item.category}\n제목: ${item.title}\n내용: ${item.content}`).join('\n\n');
  const school = guidelines ? `\n\n[${schoolName} 학교별 안전 지침]\n${guidelines}` : '';
  const msds = chemicals.length
    ? `\n\n[대화에 나온 물질의 MSDS — 한국산업안전보건공단 발췌]\n${chemicals.map(c => `### ${c.name} (CAS ${c.cas})\n${c.material}`).join('\n\n')}\n\n${CHEMICAL_RULES}`
    : '';
  return `당신은 ${schoolName} 과학실의 안전 전문가 '세이프(Safe)'입니다. 과학실 안전 지침과 MSDS를 바탕으로 정확하고 즉각적인 안전 조치를 안내합니다.

[지침 데이터]
${base}${school}${msds}

${RULES}`;
}

async function msdsInstruction(origin, chemId, schoolName) {
  const material = materialText(await fetchSections(origin, chemId), 8000);
  return `당신은 ${schoolName} 과학실의 안전 전문가 '세이프(Safe)'입니다. 학생이 지금 보고 있는 물질에 대해 질문합니다.
아래 [물질 자료]는 한국산업안전보건공단(KOSHA) 물질안전보건자료(MSDS) 발췌입니다. 이 자료에만 근거해 답하십시오.

[물질 자료]
${material}

${RULES}`;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  // Browsers on other sites may not spend this school's quota.
  const self = new URL(req.url).origin;
  const origin = req.headers.get('origin');
  if (origin && origin !== self && !/^https?:\/\/localhost(:\d+)?$/.test(origin)) return json({ error: 'FORBIDDEN' }, 403);
  if (!process.env.GEMINI_API_KEY) {
    return json({ error: 'AI_NOT_CONFIGURED', message: 'AI 서비스가 아직 설정되지 않았습니다(관리 교사 문의).' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  const question = String(body.question || '').trim();
  if (!question) return json({ error: 'BAD_REQUEST', message: '질문을 입력해 주세요.' }, 400);
  if (question.length > MAX_QUESTION) return json({ error: 'BAD_REQUEST', message: `질문은 ${MAX_QUESTION}자 이내로 입력해 주세요.` }, 400);
  const schoolName = String(body.schoolName || '').trim().slice(0, 30) || '우리 학교';
  const guidelines = maskPersonal(String(body.guidelines || '').slice(0, MAX_GUIDELINES));
  const chemId = body.chemId ? String(body.chemId) : '';
  if (chemId && !/^\d{1,10}$/.test(chemId)) return json({ error: 'BAD_REQUEST', message: '물질 정보가 올바르지 않습니다.' }, 400);
  const image = body.image && !chemId ? { mimeType: String(body.image.mimeType || ''), data: String(body.image.data || '') } : null;
  if (image && !(IMAGE_TYPES.includes(image.mimeType) && image.data.length <= MAX_IMAGE && /^[A-Za-z0-9+/]+={0,2}$/.test(image.data))) {
    return json({ error: 'BAD_REQUEST', message: '사진 형식이 올바르지 않습니다.' }, 400);
  }
  const history = parseHistory(body.history);

  let systemInstruction;
  if (chemId) {
    try {
      systemInstruction = await msdsInstruction(self, chemId, schoolName);
    } catch {
      return json({ error: 'MSDS_UNAVAILABLE', message: '이 물질의 MSDS 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
    }
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const notices = [];
  let chemicals = [];
  try {
    if (!chemId) {
      const photoCas = [];
      if (image) {
        const read = await generateWithFallback(ai, {
          contents: [{ role: 'user', parts: [{ inlineData: image }, { text: IDENTIFY }] }],
          config: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
        });
        const identified = parseIdentified(read.text);
        photoCas.push(...identified.map(c => c.cas).filter(Boolean));
        notices.push(...read.notices, identified.length
          ? `사진에서 ${identified.map(c => c.name || c.cas).join(', ')}(으)로 읽었습니다. 병 라벨과 같은 물질인지 꼭 확인하세요.`
          : '사진에서 물질 이름을 읽지 못했습니다. 라벨의 물질명이나 CAS 번호를 질문에 적어 주세요.');
      }
      // This question's chemicals first, then the photo's, then those the latest answers were based on.
      const earlierCas = [...history].reverse().flatMap(h => h.cas);
      chemicals = await lookupChemicals(self, question, [...photoCas, ...earlierCas]);
      systemInstruction = safetyInstruction(schoolName, guidelines, chemicals);
    }
    const contents = [
      ...history.flatMap(h => [
        { role: 'user', parts: [{ text: h.question }] },
        { role: 'model', parts: [{ text: h.answer }] },
      ]),
      { role: 'user', parts: [...(image ? [{ inlineData: image }] : []), { text: maskPersonal(question) }] },
    ];
    const result = await generateWithFallback(ai, {
      contents,
      config: { systemInstruction, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    // An answer blocked by Gemini's own safety filter has no text; say so instead of showing "undefined".
    const text = result.text || '이 질문에는 답할 수 없어요. 과학실 안전과 실험에 관한 질문만 도와드릴 수 있어요.';
    return json({ ...result, text, notices: [...notices, ...result.notices], chemicals: chemicals.map(({ name, cas }) => ({ name, cas })) });
  } catch (error) {
    return json({ error: 'AI_FAILED', message: error.message, notices: [...notices, ...(error.notices || [])] }, 502);
  }
};

export const config = { path: '/api/ai' };
