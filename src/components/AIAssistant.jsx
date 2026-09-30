import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SendHorizonal, Bot, Loader2, FileText } from 'lucide-react';
import { safetyData } from '../data/safetyData';
import { casListData } from '../data/casListData';
import { askAI } from '../utils/ai';
import { findChemicals } from '../utils/chemSearch';
import { useAppConfig } from '../context/AppConfigContext';

const SAFETY_QUESTIONS = ['사고 시 대응 절차', '염산이 눈에 들어갔어요', '화상 응급처치', '비상 연락처'];
const CHEM_QUESTIONS = ['피부에 묻으면?', '다른 약품과 섞어도 되나요?', '어떻게 보관하나요?', '폐기는 어떻게 하나요?'];

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
function AnswerText({ text }) {
  return text.split('\n').map((raw, i) => {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*[*-]\s+/, '• ');
    if (/^\s*#{1,6}\s/.test(line)) return <p key={i} className="font-black mt-2 first:mt-0">{line.replace(/^\s*#+\s*/, '')}</p>;
    return <p key={i} className={line.trim() ? '' : 'h-2'}>{line}</p>;
  });
}

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

/** chem: { chemId, name } grounds answers on that substance's KOSHA MSDS. */
export default function AIAssistant({ chem }) {
  const { config } = useAppConfig();
  const schoolName = config.schoolName?.trim() || '과학실';
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: chem
      ? `${chem.name}에 대해 궁금한 점을 물어보세요. 안전보건공단 MSDS 자료를 근거로 답합니다.`
      : `안녕하세요! ${schoolName} 안전 비서입니다. 시약 이름을 넣어 물어보면 그 물질의 MSDS를 근거로 답합니다. (예: 수산화나트륨이 손에 묻었어요)`,
  }]);
  const [inputText, setInputText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    // Scroll only the message list; scrolling the page would yank the MSDS view away.
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const add = (...items) => setMessages(prev => [...prev, ...items]);

  const handleSendMessage = async (text) => {
    const userText = (text || inputText).trim();
    if (!userText || isLoading) return;
    setInputText('');
    add({ role: 'user', text: userText });
    setIsLoading(true);
    try {
      const result = await askAI({
        question: userText,
        chemId: chem?.chemId,
        schoolName,
        guidelines: config.schoolGuidelines,
      });
      add(
        ...result.notices.map(n => ({ role: 'assistant', text: `⚠️ ${n}` })),
        { role: 'assistant', text: result.text, chemicals: result.chemicals, chemicalsLabel: '참조한 MSDS' },
      );
    } catch (error) {
      const notices = (error.notices || []).map(n => ({ role: 'assistant', text: `⚠️ ${n}` }));
      const fallback = chem
        ? `⚠️ ${error.message}\n\n위의 '사고가 났을 때'와 전체 원문을 확인하거나 선생님께 문의하세요.`
        : `⚠️ ${error.message} 로컬 지침에서 찾은 답변입니다.\n\n${localAnswer(userText)}`;
      // Without AI, still point to the named chemicals' own safety cards.
      const named = chem ? [] : findChemicals(userText, casListData);
      add(...notices, { role: 'assistant', text: fallback, chemicals: named, chemicalsLabel: '이 물질의 MSDS 바로 보기' });
    } finally {
      setIsLoading(false);
    }
  };

  const quick = chem ? CHEM_QUESTIONS : SAFETY_QUESTIONS;

  return (
    <div className={`bg-white rounded-[2rem] shadow-xl border border-brand-50 overflow-hidden flex flex-col border-b-8 border-b-brand-600 w-full ${chem ? 'h-[520px]' : 'h-[650px] max-w-md mx-auto lg:max-w-none'}`}>
      <div className="px-6 py-4 bg-brand-600 flex items-center gap-3 shrink-0">
        <Bot className="w-6 h-6 text-white" aria-hidden="true" />
        <div>
          <h3 className="text-white font-black text-sm">{chem ? `${chem.name} AI 질문` : 'Safety AI Assistant'}</h3>
          <p className="text-white/80 text-xs font-bold">{chem ? 'KOSHA MSDS 기반 답변' : `${schoolName} 과학실 안전 비서`}</p>
        </div>
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
              {msg.role === 'assistant' ? <AnswerText text={msg.text} /> : msg.text}
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
        <div className="relative">
          <input
            type="text"
            enterKeyHint="send"
            maxLength={500}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSendMessage()}
            disabled={isLoading}
            aria-label="AI에게 질문"
            placeholder={isLoading ? '답변을 생성 중입니다...' : '질문을 입력하세요...'}
            className="w-full pl-4 pr-12 h-12 rounded-xl bg-gray-50 border-2 border-transparent focus:border-brand-200 focus:outline-none font-bold text-base transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputText.trim()}
            aria-label="질문 보내기"
            className="absolute right-1.5 top-1.5 bottom-1.5 w-10 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 transition-all disabled:bg-gray-300"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">이름·학번·전화번호는 입력하지 마세요. 질문은 Google Gemini로 전송됩니다.</p>
      </div>
    </div>
  );
}
