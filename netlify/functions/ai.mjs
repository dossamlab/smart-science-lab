// Safety assistant for every device (students' phones included) without shipping a Gemini key.
//   POST /api/ai { question, chemId?, schoolName?, guidelines? } -> { text, notices, model }
// chemId grounds the answer on that substance's KOSHA MSDS (read through our cached /api/msds).

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { safetyData } from '../../src/data/safetyData.js';

// Tried in order. Free tier limits are per model, so when one is blocked the next is often still open.
export const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const MAX_QUESTION = 500;
const MAX_GUIDELINES = 3000;
const MSDS_SECTIONS = [2, 4, 5, 6, 7, 8, 10, 13];

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

const RULES = `[응답 규칙]
1. 학생이 바로 이해하도록 짧고 분명하게(5~8문장 이내) 답하십시오. 응급 상황이면 행동 순서(1, 2, 3)를 먼저 제시하십시오.
2. 제공된 자료에 근거해 답하고, 자료에 없는 내용은 지어내지 말고 과학 교사에게 즉시 문의하라고 안내하십시오.
3. 위험한 실험이나 약품 혼합을 권하지 마십시오. 실험 방법을 묻더라도 반드시 교사 지도 아래에서 하라고 덧붙이십시오.
4. 연락처를 묻는 질문에는 화면 오른쪽 아래 SOS 버튼의 비상연락망을 확인하라고 안내하십시오.`;

function safetyInstruction(schoolName, guidelines) {
  const base = safetyData.map(item => `카테고리: ${item.category}\n제목: ${item.title}\n내용: ${item.content}`).join('\n\n');
  const school = guidelines ? `\n\n[${schoolName} 학교별 안전 지침]\n${guidelines}` : '';
  return `당신은 ${schoolName} 과학실의 안전 전문가 '세이프(Safe)'입니다. 과학실 안전 지침과 MSDS를 바탕으로 정확하고 즉각적인 안전 조치를 안내합니다.

[지침 데이터]
${base}${school}

${RULES}`;
}

async function msdsInstruction(origin, chemId, schoolName) {
  const res = await fetch(`${origin}/api/msds?chemId=${encodeURIComponent(chemId)}`);
  if (!res.ok) throw new Error('MSDS_UNAVAILABLE');
  const { sections } = await res.json();
  const material = MSDS_SECTIONS.map(n => (sections[n] || [])
    .filter(it => it.detail && !/^[|\s]*자료\s*없음[|\s]*$/.test(it.detail))
    .map(it => `${it.name}: ${it.detail.replace(/\|/g, ' / ')}`)
    .join('\n')).filter(Boolean).join('\n\n').slice(0, 8000);
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

  let systemInstruction;
  try {
    systemInstruction = chemId ? await msdsInstruction(self, chemId, schoolName) : safetyInstruction(schoolName, guidelines);
  } catch {
    return json({ error: 'MSDS_UNAVAILABLE', message: '이 물질의 MSDS 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await generateWithFallback(ai, {
      contents: maskPersonal(question),
      config: { systemInstruction, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    return json(result);
  } catch (error) {
    return json({ error: 'AI_FAILED', message: error.message, notices: error.notices || [] }, 502);
  }
};

export const config = { path: '/api/ai' };
