import { useState, useRef, useEffect } from 'react';
import { SendHorizonal, Bot, Loader2 } from 'lucide-react';
import { safetyData } from '../data/safetyData';
import { getChatResponse } from '../utils/gemini';
import { useAppConfig } from '../context/AppConfigContext';

const QUICK_QUESTIONS = [
  '사고 시 대응 절차',
  '화학약품 눈 사고',
  '화상 응급처치',
  '비상 연락처',
];

export default function AIAssistant() {
  const { config } = useAppConfig();
  const schoolName = config.schoolName?.trim() || '과학실';
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `안녕하세요! ${schoolName} 안전 비서입니다. 궁금한 점을 편하게 물어보세요.`,
    }
  ]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 로컬 지능형 답변 로직 (폴백용)
  const getLocalResponse = (userInput) => {
    const input = userInput.toLowerCase();
    const scoredData = safetyData.map(item => {
      let score = 0;
      const title = item.title.toLowerCase();
      const content = item.content.toLowerCase();
      const keywords = item.keywords || [];
      keywords.forEach(kw => { if (input.includes(kw.toLowerCase())) score += 3; });
      if (title.includes(input) || input.includes(title)) score += 5;
      const inputWords = input.split(' ').filter(w => w.length > 1);
      inputWords.forEach(word => { if (content.includes(word)) score += 1; });
      return { ...item, score };
    });
    const bestMatch = scoredData.sort((a, b) => b.score - a.score)[0];
    if (bestMatch && bestMatch.score > 0) {
      return `[${bestMatch.title}]\n\n${bestMatch.content}`;
    } else {
      return "지침을 찾지 못했습니다. '화상', '누출' 등 키워드로 질문하거나 선생님께 문의하세요.";
    }
  };

  const handleSendMessage = async (text) => {
    const userText = (text || inputText).trim();
    if (!userText || isLoading) return;

    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      // 1. Gemini API 시도
      const aiResponse = await getChatResponse(userText);
      setMessages(prev => [...prev, { role: 'assistant', text: aiResponse }]);
    } catch (error) {
      console.warn("Gemini API 활용 불가, 로컬 엔진으로 전환:", error.message);

      let fallbackMsg = "";
      if (error.message === "API_KEY_NOT_SET") {
        fallbackMsg = "⚠️ API 키가 설정되지 않아 로컬 엔진으로 답변합니다.\n\n";
      }

      // 2. 실패 시 로컬 엔진 폴백
      setTimeout(() => {
        const response = getLocalResponse(userText);
        setMessages(prev => [...prev, { role: 'assistant', text: fallbackMsg + response }]);
      }, 300);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 border border-brand-50 overflow-hidden flex flex-col h-[650px] border-b-8 border-b-brand-600 w-full max-w-md mx-auto lg:max-w-none">
      {/* 챗 헤더 */}
      <div className="px-6 py-5 bg-brand-600 flex items-center gap-3 shrink-0">
        <Bot className="w-6 h-6 text-white" />
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-wider">Safety AI Assistant</h3>
          <p className="text-white/60 text-[10px] font-bold">{schoolName} 과학실 안전 비서</p>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-grow overflow-y-auto p-5 space-y-4 bg-gray-50/30">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black ${msg.role === 'assistant' ? 'bg-white text-brand-600 shadow-sm' : 'bg-brand-600 text-white'
              }`}>
              {msg.role === 'assistant' ? 'AI' : 'ME'}
            </div>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] font-bold leading-relaxed shadow-sm ${msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-tr-none'
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg bg-white text-brand-600 shadow-sm flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="p-5 bg-white border-t border-gray-100">
        <div className="flex flex-wrap gap-1 mb-3">
          {QUICK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(q)}
              disabled={isLoading}
              className="text-[9px] font-black px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isLoading}
            placeholder={isLoading ? "답변을 생성 중입니다..." : "질문을 입력하세요..."}
            className="w-full pl-4 pr-12 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-brand-200 focus:outline-none font-bold text-[13px] transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputText.trim()}
            className="absolute right-2 top-1.5 bottom-1.5 w-10 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 transition-all disabled:bg-gray-300"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
