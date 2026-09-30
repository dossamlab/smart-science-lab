import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Loader2, AlertCircle, List, ExternalLink, FileText, ChevronRight, ArrowLeft, MapPin } from 'lucide-react';
import MsdsSummary from '../components/MsdsSummary';
import AIAssistant from '../components/AIAssistant';
import { resolveCas, catalogMatches, isCas } from '../utils/chemSearch';
import { useCatalog } from '../utils/useCatalog';

const SECTION_TITLES = [
  '화학제품과 회사에 관한 정보', '유해성·위험성', '구성성분의 명칭 및 함유량', '응급조치 요령',
  '폭발·화재시 대처방법', '누출 사고 시 대처방법', '취급 및 저장방법', '노출방지 및 개인보호구',
  '물리화학적 특성', '안정성 및 반응성', '독성에 관한 정보', '환경에 미치는 영향',
  '폐기시 주의사항', '운송에 필요한 정보', '법적 규제현황', '그 밖의 참고사항',
];
const CATEGORY_ORDER = ['산(Acid)', '염기(Base)', '산화제/금수성', '금속', '염/무기화합물', '유기화합물', '지시약', '기타'];

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

/** /msds/:cas (bottle QR codes) remounts the page per CAS so it opens straight on that substance. */
export function MsdsRoute() {
  const { cas } = useParams();
  const initialCas = cas && isCas(cas) ? cas : null;
  return <MsdsPage key={initialCas || 'search'} initialCas={initialCas} />;
}

export default function MsdsPage({ initialCas = null }) {
  const [query, setQuery] = useState(initialCas || '');
  const [phase, setPhase] = useState(initialCas ? 'searching' : 'idle'); // idle | searching | list | loading | detail | error
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null); // { chemId, name, cas, lastDate }
  const [sections, setSections] = useState(null);
  const [error, setError] = useState('');
  const [lastKeyword, setLastKeyword] = useState(initialCas || '');
  const [showCatalog, setShowCatalog] = useState(false);
  // Teachers can add reagents (and a 보관위치) in the spreadsheet; built-in list is the base.
  const catalog = useCatalog();
  // KOSHA sometimes names a substance in English (e.g. "Sodium"); prefer the school catalog's Korean name.
  const local = (cas) => catalog.find(c => c.cas === cas);

  // Fetches first and only then touches state, so it can also run from the QR deep-link effect.
  const loadDetail = async (chem) => {
    try {
      const { sections } = await api({ chemId: chem.chemId });
      setSections(sections);
      setPhase('detail');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  const search = async (q) => {
    try {
      const { items } = await api({ q });
      setResults(items);
      if (items.length === 1) {
        setSelected(items[0]);
        setPhase('loading');
        return loadDetail(items[0]);
      }
      setPhase('list');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- search() awaits the API before any setState
    if (initialCas) search(initialCas);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mounted CAS (MsdsRoute keys the page)
  }, []);

  const openDetail = (chem) => {
    setSelected(chem);
    setPhase('loading');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadDetail(chem);
  };

  const runSearch = (keyword) => {
    const q = keyword.trim();
    if (!q) return;
    // Textbook names (염산, 아이오딘, 암모니아수) miss in KOSHA's name index; search those by CAS.
    const cas = resolveCas(q, catalog);
    setSuggestions(cas ? [] : catalogMatches(q, catalog).slice(0, 12));
    setLastKeyword(q);
    setShowCatalog(false);
    setPhase('searching');
    search(cas || q);
  };

  const pickFromCatalog = (item) => {
    setQuery(item.name);
    setSuggestions([]);
    setLastKeyword(item.name);
    setShowCatalog(false);
    setPhase('searching');
    search(item.cas);
  };

  const grouped = CATEGORY_ORDER
    .map(cat => [cat, catalog.filter(c => (CATEGORY_ORDER.includes(c.category) ? c.category : '기타') === cat)])
    .filter(([, items]) => items.length);

  return (
    <div className="max-w-6xl mx-auto pb-20 sm:px-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 text-white shrink-0">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
          </span>
          MSDS 조회
        </h1>
        <p className="text-gray-500 text-sm sm:text-base font-medium mt-2">
          한국산업안전보건공단 화학물질정보에서 물질안전보건자료(16개 항목)를 불러옵니다.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); runSearch(query); }} className="flex gap-2 mb-3">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            enterKeyHint="search"
            aria-label="물질명 또는 CAS 번호"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="물질명 또는 CAS 번호 (예: 염산, 7647-01-0)"
            className="w-full pl-12 pr-4 h-14 text-base border border-gray-200 bg-white rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 font-semibold"
          />
        </div>
        <button type="submit" disabled={phase === 'searching'} className="h-14 px-5 sm:px-8 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-60 shrink-0">
          {phase === 'searching' ? <Loader2 className="w-5 h-5 animate-spin" aria-label="검색 중" /> : '조회'}
        </button>
      </form>

      <button
        onClick={() => setShowCatalog(v => !v)}
        aria-expanded={showCatalog}
        className="flex items-center gap-2 h-11 px-4 mb-6 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700"
      >
        <List className="w-4 h-4" aria-hidden="true" /> 학교 보유 시약 {showCatalog ? '닫기' : '보기'} ({catalog.length})
      </button>

      {showCatalog && (
        <div className="space-y-5 mb-8">
          {grouped.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="text-sm font-black text-gray-500 mb-2">{cat}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {items.map(item => (
                  <button key={item.cas} onClick={() => pickFromCatalog(item)}
                    className="min-h-14 p-3 rounded-xl border border-gray-100 bg-white text-left active:bg-indigo-50">
                    <div className="text-gray-900 font-bold text-sm truncate">{item.name}</div>
                    <div className="text-xs text-indigo-600 font-mono mt-0.5">{item.cas}{item.location ? ` · ${item.location}` : ''}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (phase === 'list' || phase === 'error') && (
        <div className="mb-4">
          <p className="text-sm font-black text-gray-700 mb-2">학교 보유 시약 중 '{lastKeyword}'이(가) 들어간 것</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(item => (
              <button key={item.cas} onClick={() => pickFromCatalog(item)}
                className="h-11 px-4 rounded-xl bg-indigo-50 text-indigo-800 text-sm font-bold">
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'list' && (
        results.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="font-black text-gray-900">'{lastKeyword}' 검색 결과가 없습니다.</p>
            <p className="text-gray-500 text-sm mt-1">물질명 대신 CAS 번호로 검색해 보세요.</p>
          </div>
        ) : (
          <>
            {results.length >= 30 && (
              <p className="text-sm text-gray-600 mb-2">검색 결과가 많아 30건까지만 보입니다. 더 정확한 이름이나 CAS 번호로 검색하세요.</p>
            )}
            <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {results.map(item => (
                <li key={item.chemId}>
                  <button onClick={() => openDetail(item)} className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-indigo-50">
                    <div className="min-w-0 flex-grow">
                      <div className="font-bold text-gray-900">{local(item.cas)?.name || item.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">CAS {item.cas || '-'} · 갱신 {item.lastDate || '-'}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      )}

      {(phase === 'loading' || (phase === 'searching' && initialCas)) && (
        <div className="py-16 text-center text-gray-500 font-bold">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" aria-hidden="true" />
          {selected ? `${local(selected.cas)?.name || selected.name} 자료를 불러오는 중...` : '자료를 찾는 중...'}
        </div>
      )}

      {phase === 'error' && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
          <p className="font-black text-red-800 flex items-center gap-2"><AlertCircle className="w-5 h-5" aria-hidden="true" /> {ERROR_TEXT[error] || ERROR_TEXT.UPSTREAM}</p>
          <a href={koshaSearchUrl(selected?.cas || lastKeyword)} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-white border border-red-200 text-red-700 font-bold text-sm">
            <ExternalLink className="w-4 h-4" aria-hidden="true" /> 안전보건공단 사이트에서 직접 검색
          </a>
        </div>
      )}

      {phase === 'detail' && selected && sections && (
        <div className="space-y-4">
          {results.length > 1 && (
            <button onClick={() => setPhase('list')} className="inline-flex items-center gap-1 h-11 text-sm font-bold text-indigo-600">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> 검색 결과로
            </button>
          )}

          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{local(selected.cas)?.name || selected.name}</h2>
              <p className="text-slate-300 text-sm font-mono mt-1">
                CAS {selected.cas || '-'}{local(selected.cas)?.formula ? ` · ${local(selected.cas).formula}` : ''}
              </p>
              {local(selected.cas)?.location && (
                <p className="text-amber-300 text-sm font-bold mt-1 flex items-center gap-1">
                  <MapPin className="w-4 h-4" aria-hidden="true" /> 보관 위치: {local(selected.cas).location}
                </p>
              )}
              <p className="text-slate-400 text-xs mt-1">최종 갱신일 {selected.lastDate || '-'} · 출처: 한국산업안전보건공단</p>
            </div>
            <a href={koshaDetailUrl(selected.chemId)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-white text-slate-900 font-black text-sm shrink-0">
              <ExternalLink className="w-4 h-4" aria-hidden="true" /> KOSHA 원문 보기
            </a>
          </div>

          <MsdsSummary sections={sections} />

          <AIAssistant key={selected.chemId} chem={{ chemId: selected.chemId, name: local(selected.cas)?.name || selected.name }} />

          <h3 className="font-black text-gray-900 pt-4">전체 원문 (16개 항목)</h3>
          <div className="space-y-2">
            {SECTION_TITLES.map((title, i) => {
              const n = i + 1;
              const items = sections[n] || [];
              return (
                <details key={n} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <summary className="flex items-center justify-between gap-3 px-4 sm:px-6 min-h-14 cursor-pointer font-black text-gray-900 list-none">
                    <span>{n}. {title}</span>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <div className="px-4 sm:px-6 pb-5 space-y-3">
                    {items.length === 0 ? (
                      <p className="text-sm text-gray-500">자료 없음</p>
                    ) : items.map((it, j) => (
                      <div key={j} className={it.level > 1 ? (it.level > 2 ? 'pl-6' : 'pl-3') : ''}>
                        <div className="text-sm font-bold text-gray-800">{it.name}</div>
                        {it.detail && <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mt-0.5">{it.detail.split('|').map(s => s.trim()).filter(Boolean).join('\n')}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 leading-relaxed px-1">
            안전보건공단 화학물질정보는 참고용 자료입니다. 실제 사용하는 제품의 MSDS(공급사 제공)를 함께 확인하세요.
          </p>
        </div>
      )}

      {phase === 'idle' && !showCatalog && (
        <div className="bg-indigo-600 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-black mb-3">검색 안내</h3>
          <ul className="space-y-2 text-sm font-bold text-indigo-100">
            <li>• 물질의 한글 이름(교과서 이름도 가능)이나 CAS 번호로 검색하세요.</li>
            <li>• 같은 이름의 물질이 여럿이면 CAS 번호가 정확합니다.</li>
            <li>• 시약병의 QR 코드를 찍으면 이 화면이 바로 열립니다.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
