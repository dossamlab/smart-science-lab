import { GoogleGenAI } from "@google/genai";
import { safetyData } from "../data/safetyData";

const STORAGE_KEY = 'lab_on_config_v2';

// Tried in order. Free tier limits are per model, so when one is blocked the next is often still open.
const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];

function getConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

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
    return 'API 키가 올바르지 않습니다. 관리자 설정에서 키를 다시 확인해주세요.';
  if (status === 403) return '이 API 키로는 Gemini를 사용할 수 없습니다. 키의 권한(Generative Language API)을 확인해주세요.';
  if (error instanceof TypeError) return '인터넷 연결을 확인해주세요. AI 서버에 연결하지 못했습니다.';
  return `AI 호출에 실패했습니다${status ? ` (오류 코드 ${status})` : ''}. 잠시 후 다시 시도해주세요.`;
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
    return '이 API 키로 사용할 수 있는 Gemini 모델이 없습니다. 관리자 설정에서 키를 다시 확인해주세요.';
  return '지금 AI 서버에 요청이 몰려 있습니다. 1~2분 뒤에 다시 시도해주세요.';
}

/** Tries MODEL_CHAIN in order and reports each switch with its reason via onNotice. */
export async function generateWithFallback(ai, params, onNotice = () => {}) {
  const failures = [];
  for (const [i, model] of MODEL_CHAIN.entries()) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (error) {
      const failure = classifyFailure(error);
      if (!failure) throw new Error(fatalMessage(error), { cause: error });
      console.warn(`[Gemini API] ${model} 실패(${failure})`, error);
      failures.push(failure);
      const next = MODEL_CHAIN[i + 1];
      if (next) onNotice(`${failureReason(failure, model)} ${modelName(next)}로 다시 시도합니다. (${i + 2}/${MODEL_CHAIN.length})`);
    }
  }
  throw new Error(exhaustionMessage(failures));
}

export async function getChatResponse(userInput, agentType = 'safety', onNotice) {
  const config = getConfig();
  const apiKey = config.geminiApiKey?.trim();
  const schoolName = config.schoolName?.trim() || '우리 학교';
  const schoolGuidelines = config.schoolGuidelines?.trim() || '';

  if (!apiKey) {
    throw new Error("API_KEY_NOT_SET");
  }

  const ai = new GoogleGenAI({ apiKey });

  const baseData = safetyData
    .map(item => `카테고리: ${item.category}\n제목: ${item.title}\n내용: ${item.content}`)
    .join('\n\n');

  const schoolSection = schoolGuidelines
    ? `\n\n[${schoolName} 학교별 안전 지침]\n${schoolGuidelines}`
    : '';

  const AGENT_SYSTEM_INSTRUCTIONS = {
    safety: `당신은 ${schoolName} 과학실의 [안전 전문가 '세이프(Safe)']입니다.
당신의 임무는 오직 제공된 '과학실 안전 지침' 및 MSDS 안전 데이터를 바탕으로 사용자에게 정확하고 즉각적인 안전 조치와 대처 방안을 제공하는 것입니다.

[지침 데이터]
${baseData}${schoolSection}

[응답 규칙]
1. 반드시 안전 지침과 과학실 안전 규칙에 근거하여 답변하십시오.
2. 응급 상황(화상, 누출, 화재 등)에 대해 즉각적이고 명확한 행동 요령(행동 순서 1, 2, 3)을 최우선으로 제시하십시오.
3. 친절하고 신뢰감 주는 목소리로 답변하십시오.
4. 모르는 정보나 지침에 없는 내용은 거짓으로 지어내지 말고, 과학 교사나 관리자에게 즉시 문의하라고 안내하십시오.`,

    experiment: `당신은 ${schoolName} 과학실의 [실험 조교 '사이언(Scie)']입니다.
당신의 임무는 과학 실험 절차, 과학적 원리, 실험 기구 및 MBL 센서의 올바른 사용법을 안내하는 것입니다.

[응답 규칙]
1. 실험의 단계별 프로토콜을 학생 수준에 맞춰 명확하고 안전하게 설명하십시오.
2. 실험에 담긴 과학적 원리(화학 반응식, 물리 법칙 등)를 직관적이고 알기 쉽게 풀어 설명하십시오.
3. 실험 도구(피펫, 뷰렛, MBL 센서 등)의 조작법 및 유의사항을 명시하십시오.
4. 질문이 실험이나 과학 이론과 관련이 없다면, 실험 조교의 영역이 아님을 밝히고 정중히 거절하십시오.`,

    admin: `당신은 ${schoolName} 과학실의 [행정 전문가 '오피스(Office)']입니다.
당신의 임무는 과학실 기자재 구매 품의서 작성, 예산 책정 조언, 실험 계획서 양식 등 교사의 과학실 행정 업무를 지원하는 것입니다.

[응답 규칙]
1. 공식적이고 전문적인 비즈니스 톤앤매너(공문서 서식 스타일)를 사용하십시오.
2. 예산 기획 및 소요 비품 목록 작성 요청 시, 예시 표(품목, 수량, 예상 단가, 합계)를 작성하여 가독성을 극대화하십시오.
3. 필요한 서류 양식(기안서, 품의서 등)의 기본 프레임을 깔끔하게 작성해 주십시오.
4. 학교 공문 서식 및 기안 작성 템플릿의 전문성을 유지하십시오.`,

    team: `당신은 ${schoolName} 과학실의 [협업 에이전트 팀]입니다.
당신은 내부적으로 세 명의 분야별 전문가(안전 전문가 '세이프', 실험 조교 '사이언', 행정 전문가 '오피스')와 이들을 총괄하는 '팀장 디렉터'로 구성되어 있습니다.
사용자가 질문하면, 세 전문가가 각자의 전문 분야에서 검토를 수행하고, 팀장 디렉터가 최종 조율 및 요약을 수행하여 하나의 종합 협업 보고서 형태로 답변합니다.

[지침 데이터 (안전 관련)]
${baseData}${schoolSection}

[출력 포맷 규칙]
반드시 다음 마크다운 형식을 엄격하게 준수하여 응답해 주십시오. 다른 불필요한 서론/결론 문구 없이 바로 아래 4가지 구분자로 나누어 출력하십시오:

### 🛡️ [안전 전문가 '세이프'의 분석]
*안전 주의사항, 사고 방지 대책 및 응급 상황 대처 방안*

---

### 🧪 [실험 조교 '사이언'의 가이드]
*실험 단계별 절차, 조작 유의사항 및 과학적 원리*

---

### 📋 [행정 전문가 '오피스'의 지원]
*소요 품목, 예산 견적, 행정 문서 작성 프레임 및 행정 처리 사항*

---

### 🤝 [팀장 디렉터의 종합 솔루션]
*협업 의견을 조율한 최종 요약 및 실행 권장안*`
  };

  const systemInstruction = AGENT_SYSTEM_INSTRUCTIONS[agentType] || AGENT_SYSTEM_INSTRUCTIONS.safety;

  const response = await generateWithFallback(ai, {
    contents: userInput,
    config: { systemInstruction },
  }, onNotice);
  return response.text;
}
