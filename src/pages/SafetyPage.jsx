import { useState } from 'react';
import { Search, Info, AlertTriangle, ShieldAlert, Flame, Beaker, Scissors, GraduationCap, Phone, Sparkles } from 'lucide-react';
import { safetyData } from '../data/safetyData';
import { useAppConfig } from '../context/AppConfigContext';

const categories = [
  { name: '대응 체계', icon: ShieldAlert, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { name: '비상연락망', icon: Phone, color: 'bg-green-50 text-green-600 border-green-100' },
  { name: '화학물질/약품', icon: Beaker, color: 'bg-purple-50 text-purple-600 border-purple-100' },
  { name: '실험기구/물리', icon: Scissors, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  { name: '화재/화상', icon: Flame, color: 'bg-red-50 text-red-600 border-red-100' },
  { name: '법규/지침', icon: GraduationCap, color: 'bg-gray-50 text-gray-600 border-gray-100' },
];

const QUICK_QUESTIONS = [
  '사고 시 대응 절차',
  '화학약품 눈 사고',
  '화상 응급처치',
  '비상 연락처',
];

export default function SafetyPage() {
  const { config } = useAppConfig();
  const schoolName = config.schoolName?.trim() || '우리 학교';
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const filteredResults = safetyData.filter(item => {
    if (selectedCategory && item.category !== selectedCategory) return false;
    if (!query.trim()) return selectedCategory ? true : false;
    const searchLower = query.toLowerCase();
    return item.keywords.some(k => k.includes(searchLower)) ||
           item.title.toLowerCase().includes(searchLower) ||
           item.content.toLowerCase().includes(searchLower);
  });

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl mb-3">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Safety Guidelines</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">안전 지침 및 대응 매뉴얼</h1>
          <p className="text-gray-500 font-medium mt-2">공식 지침을 조회하거나 AI 비서에게 질문하세요.</p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm font-bold text-gray-400">
          <Info className="w-5 h-5" />
          마지막 업데이트: 2024.03
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* 📋 중앙: 메인 매뉴얼 열람 (전체 너비로 확장) */}
        <div className="lg:col-span-12 space-y-8">
          {/* 카테고리 필터 */}
          <section className="bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-100/50 border border-gray-50">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-brand-600" />
              분야별 안전 지침
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => { setSelectedCategory(cat.name === selectedCategory ? null : cat.name); setHasSearched(true); }}
                  className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all group ${
                    selectedCategory === cat.name 
                       ? `${cat.color} border-current scale-105 shadow-md` 
                       : 'bg-gray-50 border-transparent text-gray-400 hover:border-brand-200 hover:text-brand-600'
                  }`}
                >
                  <cat.icon className="w-7 h-7 mb-2 transition-transform group-hover:scale-110" />
                  <span className="text-[10px] font-black">{cat.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 검색 바 */}
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-6 h-6 group-focus-within:text-brand-600 transition-colors" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHasSearched(true); }}
              placeholder="상황이나 키워드를 입력하세요 (예: 화상, 누출, 119)"
              className="w-full pl-16 pr-6 py-6 rounded-3xl bg-white border-none shadow-2xl shadow-gray-200/50 focus:ring-4 focus:ring-brand-500/10 font-black text-lg transition-all"
            />
          </div>

          {/* 검색 결과 목록 */}
          <div className="space-y-6">
            {hasSearched ? (
              <>
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">
                    {selectedCategory ? `${selectedCategory} 지침` : '검색된 안전 정보'}
                    <span className="ml-2 text-brand-600">{filteredResults.length}</span>
                  </h3>
                  {(selectedCategory || query) && (
                    <button onClick={() => { setSelectedCategory(null); setQuery(''); setHasSearched(false); }} className="text-xs font-black text-gray-400 hover:text-gray-600">
                      초기화
                    </button>
                  )}
                </div>

                {filteredResults.length > 0 ? (
                  <div className="grid gap-6">
                    {filteredResults.map(item => (
                      <div key={item.id} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-2 rounded-lg ${categories.find(c => c.name === item.category)?.color || 'bg-gray-100'}`}>
                            {(() => {
                              const CatIcon = categories.find(c => c.name === item.category)?.icon || Info;
                              return <CatIcon className="w-5 h-5" />;
                            })()}
                          </div>
                          <h4 className="text-xl font-black text-gray-900">{item.title}</h4>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700 font-medium whitespace-pre-wrap leading-relaxed bg-gray-50/50 p-6 rounded-2xl border border-gray-50">
                          {item.content}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-gray-100">
                    <AlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-black text-lg">해당 조건에 맞는 지침이 없습니다.</p>
                    <p className="text-gray-400 text-sm font-medium mt-1">우측 AI 비서에게 질문하거나 선생님께 문의하세요.</p>
                  </div>
                )}
              </>
            ) : (
              /* 기본 화면: 도움말 카드 */
              <div className="bg-gradient-to-br from-brand-600 to-indigo-700 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-brand-100">
                <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-brand-200" />
                  실험실 안전 수칙 안내
                </h3>
                <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-brand-200 font-black uppercase text-xs tracking-widest">핵심 지침</h4>
                    <ul className="space-y-3 font-bold text-sm">
                      <li className="flex items-start gap-2"><span>•</span> 모든 실험 전 MSDS와 안전 지침을 숙지합니다.</li>
                      <li className="flex items-start gap-2"><span>•</span> 실험실 내에서는 반드시 보호 장구를 착용합니다.</li>
                      <li className="flex items-start gap-2"><span>•</span> 사고 발생 시 즉시 교사에게 보고하고 전파합니다.</li>
                    </ul>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <p className="text-sm font-medium leading-relaxed">
                      이 플랫폼은 {schoolName} 안전 계획을 기반으로 제작되었습니다. 상단의 검색창이나 카테고리를 이용해 필요한 정보를 빠르게 찾아보세요.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
