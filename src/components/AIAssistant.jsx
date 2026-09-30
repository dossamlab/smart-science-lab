import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SendHorizonal, Bot, Loader2, FileText, Camera, X, Volume2, Square, RotateCcw, AlertTriangle } from 'lucide-react';
import { safetyData } from '../data/safetyData';
import { casListData } from '../data/casListData';
import { askAI, splitUrgent } from '../utils/ai';
import { findChemicals } from '../utils/chemSearch';
import { useAppConfig } from '../context/AppConfigContext';

const SAFETY_QUESTIONS = ['사고 시 대응 절차', '염산이 눈에 들어갔어요', '화상 응급처치', '비상 연락처'];
const CHEM_QUESTIONS = ['피부에 묻으면?', '다른 약품과 섞어도 되나요?', '어떻게 보관하나요?', '폐기는 어떻게 하나요?'];
const PHOTO_QUESTION = '사진 속 시약을 다룰 때 주의할 점과 사고가 났을 때 대처법을 알려주세요.';
// The home chat survives a trip to an MSDS page and back (this browser tab only; photos are not kept).
const STORE = 'lab-on-ai-chat';
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Local keyword answer when AI is unavailable (safety mode only).
function localAnswer(userInput) {
  const input = userInput.toLowerCase();
  const scored = safetyData.map(item => {
    let score = 0;
    (item.keywords || []).forEach(kw => { if (input.includes(kw.toLowerCase())) score += 3; });
    if (item.title.toLowerCase().includes(input) || input.includes(item.title.toLowerCase())) score += 5;
    input.split(' ').filter(w => w.length > 1).forEach(w => { if (item.content.toLowerCase().includes(w)) score += 1; });
    return { ...item, score };
  });
  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best?.score > 0
    ? `[${best.title}]\n\n${best.content}`
    : "지침을 찾지 못했습니다. '화상', '누출' 등 키워드로 질문하거나 선생님께 문의하세요.";
}

// Gemini answers in markdown; show headings/bullets as plain readable lines instead of raw ### and **.
// An emergency answer's "지금 바로: …" first line goes in a red box on top.
function AnswerText({ text }) {
  const { urgent, rest } = splitUrgent(text);
  return (
    <>
      {urgent && (
        <p className="mb-2 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-black text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>지금 바로: {urgent}</span>
        </p>
      )}
      {rest && rest.split('\n').map((raw, i) => {
        const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*[*-]\s+/, '• ');
        if (/^\s*#{1,6}\s/.test(line)) return <p key={i} className="font-black mt-2 first:mt-0">{line.replace(/^\s*#+\s*/, '')}</p>;
        return <p key={i} className={line.trim() ? '' : 'h-2'}>{line}</p>;
      })}
    </>
  );
}

const speechText = (text) => text.replace(/\*\*/g, '').replace(/^\s*#+\s*/gm, '').replace(/^\s*[*-]\s+/gm, '');

function MsdsLinks({ chemicals, label }) {
  return (
    <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-gray-500">{label}</span>
      {chemicals.map(c => (
        <Link key={c.cas} to={`/msds/${c.cas}`}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />{c.name}
        </Link>
      ))}
    </div>
  );
}

// The last 3 answered questions go along with a new one, so "그럼 눈에 들어가면?" keeps its chemical.
function historyOf(messages) {
  const history = [];
  let question = null;
  for (const m of messages) {
    if (m.role === 'user') question = m.photo ? `(시약병 사진과 함께) ${m.text}` : m.text;
    else if (m.ai && question !== null) {
      history.push({ question, answer: m.text, chemicals: (m.chemicals || []).map(c => c.cas) });
      question = null;
    }
  }
  return history.slice(-3);
}

// Phone photos are several MB; a 1024px JPEG (~150 KB) is plenty to read a label.
async function shrinkPhoto(file) {
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file); // a data: URL, since the CSP allows data: images but not blob:
  });
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
  const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { url, mimeType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

/** chem: { chemId, name } grounds answers on that substance's KOSHA MSDS. */
export default function AIAssistant({ chem }) {
  const { config } = useAppConfig();
  const schoolName = config.schoolName?.trim() || '과학실';
  const greeting = {
    role: 'assistant',
    text: chem
      ? `${chem.name}에 대해 궁금한 점을 물어보세요. 안전보건공단 MSDS 자료를 근거로 답합니다.`
      : `안녕하세요! ${schoolName} 안전 비서입니다. 시약 이름을 넣어 묻거나 시약병 라벨을 사진으로 찍어 물어보면 그 물질의 MSDS를 근거로 답합니다. (예: 수산화나트륨이 손에 묻었어요)`,
  };
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState(() => {
    if (!chem) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(STORE));
        if (Array.isArray(saved) && saved.length) return saved;
      } catch { /* storage blocked: start fresh */ }
    }
    return [greeting];
  });
  const [inputText, setInputText] = useState('');
  const [photo, setPhoto] = useState(null); // { url, mimeType, data } waiting to be sent
  const [speaking, setSpeaking] = useState(null); // index of the message being read aloud
  const listRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    // Scroll only the message list; scrolling the page would yank the MSDS view away.
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (chem) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.map(m => ({ ...m, image: undefined }))));
    } catch { /* storage blocked: the chat just won't survive navigation */ }
  }, [messages, chem]);

  useEffect(() => () => { if (canSpeak) speechSynthesis.cancel(); }, []);

  const add = (...items) => setMessages(prev => [...prev, ...items]);

  const handleSendMessage = async (text) => {
    const typed = (text || inputText).trim();
    if ((!typed && !photo) || isLoading) return;
    const question = typed || PHOTO_QUESTION;
    const sent = photo;
    const history = historyOf(messages);
    setInputText('');
    setPhoto(null);
    add({ role: 'user', text: question, image: sent?.url, photo: Boolean(sent) });
    setIsLoading(true);
    try {
      const result = await askAI({
        question,
        chemId: chem?.chemId,
        schoolName,
        guidelines: config.schoolGuidelines,
        history,
        image: sent ? { mimeType: sent.mimeType, data: sent.data } : undefined,
      });
      add(
        ...result.notices.map(n => ({ role: 'assistant', text: `⚠️ ${n}` })),
        { role: 'assistant', text: result.text, chemicals: result.chemicals, chemicalsLabel: '참조한 MSDS', ai: true },
      );
    } catch (error) {
      const notices = (error.notices || []).map(n => ({ role: 'assistant', text: `⚠️ ${n}` }));
      const fallback = chem
        ? `⚠️ ${error.message}\n\n위의 '사고가 났을 때'와 전체 원문을 확인하거나 선생님께 문의하세요.`
        : `⚠️ ${error.message} 로컬 지침에서 찾은 답변입니다.\n\n${localAnswer(question)}`;
      // Without AI, still point to the named chemicals' own safety cards.
      const named = chem ? [] : findChemicals(question, casListData);
      add(...notices, { role: 'assistant', text: fallback, chemicals: named, chemicalsLabel: '이 물질의 MSDS 바로 보기', local: true });
    } finally {
      setIsLoading(false);
    }
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same photo again must still fire onChange
    if (!file) return;
    try {
      setPhoto(await shrinkPhoto(file));
    } catch {
      add({ role: 'assistant', text: '⚠️ 사진을 읽지 못했습니다. 다른 사진으로 다시 시도해 주세요.' });
    }
  };

  // Read an answer aloud with the device's own voice (nothing leaves the device), e.g. while rinsing.
  const toggleSpeak = (i, text) => {
    speechSynthesis.cancel();
    if (speaking === i) {
      setSpeaking(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speechText(text));
    utterance.lang = 'ko-KR';
    utterance.onend = utterance.onerror = () => setSpeaking(s => (s === i ? null : s));
    setSpeaking(i);
    speechSynthesis.speak(utterance);
  };

  // A shared lab tablet: the next student starts clean.
  const resetChat = () => {
    if (canSpeak) speechSynthesis.cancel();
    setSpeaking(null);
    setPhoto(null);
    setMessages([greeting]);
  };

  const quick = chem ? CHEM_QUESTIONS : SAFETY_QUESTIONS;

  return (
    <div className={`bg-white rounded-[2rem] shadow-xl border border-brand-50 overflow-hidden flex flex-col border-b-8 border-b-brand-600 w-full ${chem ? 'h-[520px]' : 'h-[650px] max-w-md mx-auto lg:max-w-none'}`}>
      <div className="px-6 py-4 bg-brand-600 flex items-center gap-3 shrink-0">
        <Bot className="w-6 h-6 text-white" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-black text-sm">{chem ? `${chem.name} AI 질문` : 'Safety AI Assistant'}</h3>
          <p className="text-white/80 text-xs font-bold">{chem ? 'KOSHA MSDS 기반 답변' : `${schoolName} 과학실 안전 비서`}</p>
        </div>
        {messages.length > 1 && (
          <button type="button" onClick={resetChat} disabled={isLoading}
            className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-white/15 text-white text-xs font-black hover:bg-white/25 transition-colors disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> 새 대화
          </button>
        )}
      </div>

      <div ref={listRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50/30" aria-live="polite">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${msg.role === 'assistant' ? 'bg-white text-brand-600 shadow-sm' : 'bg-brand-600 text-white'}`}>
              {msg.role === 'assistant' ? 'AI' : '나'}
            </div>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user'
              ? 'bg-brand-600 text-white rounded-tr-none'
              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}>
              {msg.image && <img src={msg.image} alt="보낸 사진" className="mb-2 max-h-40 rounded-lg" />}
              {msg.role === 'assistant' ? <AnswerText text={msg.text} /> : msg.text}
              {canSpeak && (msg.ai || msg.local) && (
                <button type="button" onClick={() => toggleSpeak(i, msg.text)} aria-pressed={speaking === i}
                  className="mt-2 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors">
                  {speaking === i
                    ? <><Square className="w-3.5 h-3.5" aria-hidden="true" /> 그만 읽기</>
                    : <><Volume2 className="w-3.5 h-3.5" aria-hidden="true" /> 읽어주기</>}
                </button>
              )}
              {msg.chemicals?.length > 0 && <MsdsLinks chemicals={msg.chemicals} label={msg.chemicalsLabel} />}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" aria-hidden="true" /> 답변을 만들고 있습니다...
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex flex-wrap gap-2 mb-3">
          {quick.map(q => (
            <button
              key={q}
              onClick={() => handleSendMessage(q)}
              disabled={isLoading}
              className="text-xs font-black px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        {photo && (
          <div className="mb-3 flex items-center gap-3">
            <img src={photo.url} alt="보낼 사진" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            <p className="flex-1 text-xs text-gray-600">라벨만 나오게 찍어 주세요. 사람 얼굴이나 이름표가 찍혔다면 빼고 다시 찍으세요.</p>
            <button type="button" onClick={() => setPhoto(null)} aria-label="사진 빼기"
              className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          {!chem && (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={isLoading} aria-label="시약병 사진으로 질문"
                className="w-12 h-12 shrink-0 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-50">
                <Camera className="w-5 h-5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
            </>
          )}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              enterKeyHint="send"
              maxLength={500}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSendMessage()}
              disabled={isLoading}
              aria-label="AI에게 질문"
              placeholder={isLoading ? '답변을 생성 중입니다...' : photo ? '사진에 대해 물어보세요(비워도 됨)' : '질문을 입력하세요...'}
              className="w-full pl-4 pr-12 h-12 rounded-xl bg-gray-50 border-2 border-transparent focus:border-brand-200 focus:outline-none font-bold text-base transition-all disabled:opacity-50"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputText.trim() && !photo)}
              aria-label="질문 보내기"
              className="absolute right-1.5 top-1.5 bottom-1.5 w-10 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 transition-all disabled:bg-gray-300"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">이름·학번·전화번호는 입력하지 마세요. {chem ? '질문은' : '질문과 사진은'} Google Gemini로 전송됩니다.</p>
      </div>
    </div>
  );
}
