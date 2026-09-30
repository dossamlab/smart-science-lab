import { useState } from 'react';
import { Search, Loader2, AlertCircle, List, ExternalLink, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { casListData } from '../data/casListData';
import MsdsSummary from '../components/MsdsSummary';

const SECTION_TITLES = [
  '화학제품과 회사에 관한 정보', '유해성·위험성', '구성성분의 명칭 및 함유량', '응급조치 요령',
  '폭발·화재시 대처방법', '누출 사고 시 대처방법', '취급 및 저장방법', '노출방지 및 개인보호구',
  '물리화학적 특성', '안정성 및 반응성', '독성에 관한 정보', '환경에 미치는 영향',
  '폐기시 주의사항', '운송에 필요한 정보', '법적 규제현황', '그 밖의 참고사항',
];

const koshaSearchUrl = (keyword) =>
  `https://msds.kosha.or.kr/MSDSInfo/kcic/msdssearchAll.do?searchKeyword=${encodeURIComponent(keyword)}&listType=all`;
const koshaDetailUrl = (chemId) =>
  `https://msds.kosha.or.kr/MSDSInfo/kcic/msdsdetail.do?chem_id=${encodeURIComponent(chemId)}&viewType=msds`;

const ERROR_TEXT = {
  NO_KEY: 'MSDS 조회 서비스가 아직 설정되지 않았습니다(관리 교사 문의).',
  UPSTREAM: '안전보건공단 서버에서 자료를 받지 못했습니다. 잠시 후 다시 시도하세요.',
  NETWORK: '인터넷 연결을 확인해 주세요.',
};

async function api(params) {
  let res;
  try {
    res = await fetch(`/api/msds?${new URLSearchParams(params)}`);
  } catch {
    throw new Error('NETWORK');
  }
  const body = await res.json().catch(() => ({ error: 'UPSTREAM' }));
  if (!res.ok || body.error) throw new Error(body.error || 'UPSTREAM');
  return body;
}

export default function MsdsPage() {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | searching | list | loading | detail | error
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null); // { chemId, name, cas, lastDate }
  const [sections, setSections] = useState(null);
  const [error, setError] = useState('');
  const [lastKeyword, setLastKeyword] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);

  const openDetail = async (chem) => {
    setSelected(chem);
    setPhase('loading');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const { sections } = await api({ chemId: chem.chemId });
      setSections(sections);
      setPhase('detail');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  const runSearch = async (keyword) => {
    const q = keyword.trim();
    if (!q) return;
    setLastKeyword(q);
    setShowCatalog(false);
    setPhase('searching');
    try {
      const { items } = await api({ q });
      setResults(items);
      if (items.length === 1) return openDetail(items[0]);
      setPhase('list');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  const pickFromCatalog = (item) => {
    setQuery(item.name);
    runSearch(item.cas);
  };

  // KOSHA sometimes names a substance in English (e.g. "Sodium"); prefer the school catalog's Korean name.
  const local = (cas) => casListData.find(c => c.cas === cas);

  return (
    <div className="max-w-6xl mx-auto pb-20 sm:px-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 text-white shrink-0">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
          </span>
          MSDS 조회
        </h1>
        <p className="text-gray-500 text-sm sm:text-base font-medium mt-2">
          한국산업안전보건공단 화학물질정보에서 물질안전보건자료(16개 항목)를 불러옵니다.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); runSearch(query); }} className="flex gap-2 mb-3">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="물질명 또는 CAS 번호 (예: 염산, 7647-01-0)"
            className="w-full pl-12 pr-4 h-14 text-base border border-gray-200 bg-white rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 font-semibold"
          />
        </div>
        <button type="submit" disabled={phase === 'searching'} className="h-14 px-5 sm:px-8 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-60 shrink-0">
          {phase === 'searching' ? <Loader2 className="w-5 h-5 animate-spin" /> : '조회'}
        </button>
      </form>

      <button
        onClick={() => setShowCatalog(v => !v)}
        className="flex items-center gap-2 h-11 px-4 mb-6 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700"
      >
        <List className="w-4 h-4" /> 학교 주요 시약 {showCatalog ? '닫기' : '보기'} ({casListData.length})
      </button>

      {showCatalog && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-8">
          {casListData.map(item => (
            <button key={item.id} onClick={() => pickFromCatalog(item)}
              className="min-h-14 p-3 rounded-xl border border-gray-100 bg-white text-left active:bg-indigo-50">
              <div className="text-gray-900 font-bold text-sm truncate">{item.name}</div>
              <div className="text-xs text-indigo-500 font-mono mt-0.5">{item.cas}</div>
            </button>
          ))}
        </div>
      )}

      {phase === 'list' && (
        results.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-black text-gray-900">'{lastKeyword}' 검색 결과가 없습니다.</p>
            <p className="text-gray-500 text-sm mt-1">물질명 대신 CAS 번호로 검색해 보세요.</p>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {results.map(item => (
              <li key={item.chemId}>
                <button onClick={() => openDetail(item)} className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-indigo-50">
                  <div className="min-w-0 flex-grow">
                    <div className="font-bold text-gray-900">{local(item.cas)?.name || item.name}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">CAS {item.cas || '-'} · 갱신 {item.lastDate || '-'}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {phase === 'loading' && (
        <div className="py-16 text-center text-gray-500 font-bold">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
          {selected?.name} 자료를 불러오는 중...
        </div>
      )}

      {phase === 'error' && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
          <p className="font-black text-red-800 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {ERROR_TEXT[error] || ERROR_TEXT.UPSTREAM}</p>
          <a href={koshaSearchUrl(selected?.cas || lastKeyword)} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-white border border-red-200 text-red-700 font-bold text-sm">
            <ExternalLink className="w-4 h-4" /> 안전보건공단 사이트에서 직접 검색
          </a>
        </div>
      )}

      {phase === 'detail' && selected && sections && (
        <div className="space-y-4">
          {results.length > 1 && (
            <button onClick={() => setPhase('list')} className="inline-flex items-center gap-1 h-11 text-sm font-bold text-indigo-600">
              <ArrowLeft className="w-4 h-4" /> 검색 결과로
            </button>
          )}

          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{local(selected.cas)?.name || selected.name}</h2>
              <p className="text-slate-300 text-sm font-mono mt-1">
                CAS {selected.cas || '-'}{local(selected.cas)?.formula ? ` · ${local(selected.cas).formula}` : ''}
              </p>
              <p className="text-slate-400 text-xs mt-1">최종 갱신일 {selected.lastDate || '-'} · 출처: 한국산업안전보건공단</p>
            </div>
            <a href={koshaDetailUrl(selected.chemId)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-white text-slate-900 font-black text-sm shrink-0">
              <ExternalLink className="w-4 h-4" /> KOSHA 원문 보기
            </a>
          </div>

          <MsdsSummary sections={sections} />

          <h3 className="font-black text-gray-900 pt-4">전체 원문 (16개 항목)</h3>
          <div className="space-y-2">
            {SECTION_TITLES.map((title, i) => {
              const n = i + 1;
              const items = sections[n] || [];
              return (
                <details key={n} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <summary className="flex items-center justify-between gap-3 px-4 sm:px-6 min-h-14 cursor-pointer font-black text-gray-900 list-none">
                    <span>{n}. {title}</span>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-4 sm:px-6 pb-5 space-y-3">
                    {items.length === 0 ? (
                      <p className="text-sm text-gray-400">자료 없음</p>
                    ) : items.map((it, j) => (
                      <div key={j} style={{ paddingLeft: `${(it.level - 1) * 12}px` }}>
                        <div className="text-sm font-bold text-gray-800">{it.name}</div>
                        {it.detail && <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mt-0.5">{it.detail.split('|').map(s => s.trim()).filter(Boolean).join('\n')}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed px-1">
            안전보건공단 화학물질정보는 참고용 자료입니다. 실제 사용하는 제품의 MSDS(공급사 제공)를 함께 확인하세요.
          </p>
        </div>
      )}

      {phase === 'idle' && !showCatalog && (
        <div className="bg-indigo-600 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-black mb-3">검색 안내</h3>
          <ul className="space-y-2 text-sm font-bold text-indigo-100">
            <li>• 물질의 한글 이름이나 CAS 번호로 검색하세요.</li>
            <li>• 같은 이름의 물질이 여럿이면 CAS 번호가 정확합니다.</li>
            <li>• '학교 주요 시약'에서 바로 고를 수도 있습니다.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
