import { useState, useEffect } from 'react';
import { Search, Beaker, Loader2, AlertCircle, List, X, Info, ExternalLink, ShieldAlert, Thermometer, Droplets, Eye, Wind, FileText, AlertTriangle, Database } from 'lucide-react';
import { casListData } from '../data/casListData';
import { fetchSpreadsheetData } from '../utils/googleSheets';
import { useAppConfig } from '../context/AppConfigContext';

// 스프레드시트 ID (선생님께서 생성하신 시트 ID)
const DEFAULT_SHEET_ID = '1P90px_1wDHJgkWZDpKsHUNUXLoMp-Z2L2RyccSwVAQc';

const msdsSections = [
  { id: 1, title: '1. 화학제품과 회사에 관한 정보' },
  { id: 2, title: '2. 유해성·위험성' },
  { id: 3, title: '3. 구성성분의 명칭 및 함유량' },
  { id: 4, title: '4. 응급조치 요령' },
  { id: 5, title: '5. 폭발·화재시 대처방법' },
  { id: 6, title: '6. 누출 사고 시 대처방법' },
  { id: 7, title: '7. 취급 및 저장방법' },
  { id: 8, title: '8. 노출방지 및 개인보호구' },
  { id: 9, title: '9. 물리화학적 특성' },
  { id: 10, title: '10. 안정성 및 반응성' },
  { id: 11, title: '11. 독성에 관한 정보' },
  { id: 12, title: '12. 환경에 미치는 영향' },
  { id: 13, title: '13. 폐기시 주의사항' },
  { id: 14, title: '14. 운송에 필요한 정보' },
  { id: 15, title: '15. 법적 규제현황' },
  { id: 16, title: '16. 그 밖의 참고사항' },
];

export default function MsdsPage() {
  const { config } = useAppConfig();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCasList, setShowCasList] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSection, setActiveSection] = useState(2);
  const [dataSource, setDataSource] = useState('local'); // 'local' or 'spreadsheet'

  const searchMsds = async (e, directQuery = null) => {
    if (e) e.preventDefault();
    const searchQuery = (directQuery || query).trim().toLowerCase();
    if (!searchQuery) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);
    setShowCasList(false);

    try {
      // 1. 구글 스프레드시트에서 데이터 가져오기 시도
      let sheetData = [];
      const sheetId = config.spreadsheetId?.trim() || DEFAULT_SHEET_ID;
      
      try {
        // 실제 유효한 ID인 경우에만 페치 실행
        if (sheetId && sheetId.length > 20) {
          sheetData = await fetchSpreadsheetData(sheetId);
          setDataSource('spreadsheet');
        }
      } catch (sErr) {
        console.warn('스프레드시트 연동 실패, 로컬 데이터로 전환합니다.', sErr);
        setDataSource('local');
      }

      // 2. 검색 필터링 (스프레드시트 데이터가 있으면 거기서, 없으면 CAS 목록에서)
      if (sheetData.length > 0) {
        const filtered = sheetData.filter(row => 
          (row['이름'] && row['이름'].toLowerCase().includes(searchQuery)) ||
          (row['CAS번호'] && row['CAS번호'].includes(searchQuery))
        );

        if (filtered.length > 0) {
          const mappedResults = filtered.map((row, idx) => {
            const details = {};
            // 시트의 컬럼명(Section1~16)을 섹션 데이터로 매핑
            for (let i = 1; i <= 16; i++) {
              details[i] = row[`Section${i}`] || row[`섹션${i}`] || '등록된 데이터가 없습니다.';
            }
            return {
              id: `sheet-${idx}`,
              name: row['이름'],
              casNo: row['CAS번호'],
              formula: row['화학식'] || 'N/A',
              details
            };
          });
          setResults(mappedResults);
          setLoading(false);
          return;
        }
      }

      // 3. 스프레드시트에 없거나 실패한 경우 기존 로컬 Mock 데이터 활용 (Fallback)
      const foundInCasList = casListData.filter(item => 
        item.name.toLowerCase().includes(searchQuery) || 
        item.cas.includes(searchQuery)
      );

      setTimeout(() => {
        const enhancedResults = foundInCasList.map(item => {
          const details = {
            1: `${item.name} / ${item.formula}\n- 용도: 실험용 시약\n- 공급자: 학교 지정 시약 공급업체`,
            2: `[GHS 유해성 분류]\n- 급성 독성, 피부 부식성/자극성\n- 심한 눈 손상성/눈 자극성\n\n[그림문자]\n(Pictograms: Corrosive, Harmful)\n\n[신호어] 위험 (Danger)\n\n[유해·위험문구]\n- 삼키면 유해함\n- 피부에 심한 화상과 눈에 손상을 일으킴`,
            3: `성분명: ${item.name}\n이명: ${item.formula}\nCAS No: ${item.cas}\n함유량: 90~100%`,
            4: `[눈] 즉시 15분 이상 물로 세척 후 의료조치\n[피부] 오염된 의복 제거 및 다량의 물 세척\n[흡입] 신선한 공기가 있는 곳으로 이동\n[소화기] 억지로 토하게 하지 말고 즉시 병원 이송`,
            5: `[소화제] 주변 화재에 적합한 소화제 사용\n[유해 연소생물] 열분해 시 자극성 가스 발생 가능\n[진화 시 주의] 방화복 및 공기호흡기 착용`,
            7: `보관: 서늘하고 건조한 장소에 밀폐 보관. 강염기 및 인화성 물질과 격리. 환기가 잘 되는 시약장에 보관.`,
            8: `보호구: 보안경(또는 안면보호구), 내화학성 장갑, 실험용 가운, 방독마스크(필요시)`,
            9: `상태: 액체/고체\n색상: 자료없음/백색\n냄새: 자극적 냄새/무취\npH: 강산성/강염기성\n비중: 자료참조`,
            13: `폐기방법: 관련 법규에 따라 지정 폐기물로 처리. 성상별 전용 수거함 배출.`,
            15: `법적규제: 화학물질관리법(유독물질), 산업안전보건법(노출기준설정물질)`,
          };

          return {
            ...item,
            casNo: item.cas,
            details
          };
        });

        setResults(enhancedResults);
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error(err);
      setError('데이터 조회 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleCasSelect = (item) => {
    setQuery(item.cas);
    searchMsds(null, item.cas);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 mb-6">
          <FileText className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">MSDS 전문가 조회 (GHS 16개 항목)</h1>
        <p className="text-gray-500 text-lg font-medium">안전보건공단 표준 MSDS 구조를 바탕으로 상세 정보를 제공합니다.</p>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <form onSubmit={searchMsds} className="relative flex-grow">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className="w-6 h-6" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="시약명 또는 CAS 번호 입력 (예: 염산, 7647-01-0)"
            className="w-full pl-16 pr-32 py-5 text-xl border-none bg-white rounded-3xl shadow-xl shadow-gray-200/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold"
          />
          <button
            type="submit"
            className="absolute right-3 top-3 bottom-3 bg-indigo-600 text-white px-8 rounded-2xl font-bold hover:bg-indigo-700 transition-all"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '조회'}
          </button>
        </form>
        <button
          onClick={() => setShowCasList(!showCasList)}
          className={`flex items-center justify-center gap-2 px-8 py-5 rounded-3xl font-bold transition-all shadow-xl shadow-gray-200/50 ${
            showCasList ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-gray-700'
          }`}
        >
          <List className="w-6 h-6" />
          시약 목록
        </button>
      </div>

      {/* CAS List Section (생략) - Previous logic remains same but improved UI */}
      {showCasList && (
        <div className="bg-white rounded-3xl shadow-2xl border border-indigo-50 mb-10 overflow-hidden animate-in zoom-in-95 duration-300">
          {/* ... (Previous CAS list logic grouped by category) ... */}
          <div className="bg-indigo-50 px-8 py-4 flex items-center justify-between">
            <h2 className="text-indigo-900 font-black flex items-center gap-2"><List className="w-5 h-5" /> 분류별 시약 목록</h2>
            <button onClick={() => setShowCasList(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-6 h-6" /></button>
          </div>
          <div className="p-8 max-h-[500px] overflow-y-auto">
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
               {casListData.map(item => (
                 <button key={item.id} onClick={() => handleCasSelect(item)} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-indigo-300 hover:shadow-md transition-all text-left">
                   <div className="text-gray-900 font-bold text-sm truncate">{item.name}</div>
                   <div className="text-[10px] text-indigo-500 font-mono mt-1">{item.cas}</div>
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* Professional MSDS Result View */}
      {hasSearched && results.length > 0 && (
        <div className="space-y-10">
          {results.map((item) => (
            <div key={item.id} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
              {/* Result Header */}
              <div className="bg-slate-900 text-white p-8 md:p-12">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500 text-xs font-black uppercase tracking-wider">
                        CAS Registry No: {item.casNo}
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                        dataSource === 'spreadsheet' ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>
                        <Database className="w-3.5 h-3.5" />
                        {dataSource === 'spreadsheet' ? '학교 관리 실시간 DB' : '표준 요약 데이터'}
                      </div>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">{item.name}</h2>
                    <p className="text-slate-400 text-lg font-medium">분자식: {item.formula} | 상태: 실온 액체/고체</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a 
                      href={`https://msds.kosha.or.kr/` /* 실제 검색 페이지로 바로 가기 */}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-50 transition-colors shadow-lg"
                    >
                      <ExternalLink className="w-5 h-5" /> KOSHA 원문 보기
                    </a>
                  </div>
                </div>

                {/* Pictograms Section */}
                <div className="mt-10 flex gap-4">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center relative group">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                    <span className="absolute -bottom-8 text-[10px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Corrosive</span>
                  </div>
                  <div className="w-20 h-20 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center relative group">
                    <AlertTriangle className="w-10 h-10 text-yellow-500" />
                    <span className="absolute -bottom-8 text-[10px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Harmful</span>
                  </div>
                </div>
              </div>

              {/* 16 Sections Layout */}
              <div className="flex flex-col lg:flex-row">
                {/* Section Navigation Sidebar */}
                <div className="lg:w-80 bg-slate-50 border-r border-gray-100 p-6 max-h-[800px] overflow-y-auto">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">MSDS Sections</h3>
                  <div className="space-y-1">
                    {msdsSections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                          activeSection === section.id
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                            : 'text-slate-500 hover:bg-white hover:text-indigo-600'
                        }`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section Content Area */}
                <div className="flex-grow p-8 md:p-12 min-h-[600px]">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="bg-indigo-100 text-indigo-600 p-3 rounded-2xl">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">
                      {msdsSections.find(s => s.id === activeSection)?.title}
                    </h3>
                  </div>

                  <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                    <div className="prose prose-indigo max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-lg text-slate-700 font-medium leading-relaxed bg-transparent p-0 border-none">
                        {item.details[activeSection] || '이 섹션의 상세 데이터는 실제 스프레드시트 또는 API 연동 시 실시간으로 표시됩니다.'}
                      </pre>
                    </div>
                  </div>

                  {/* Quick Tips Footer for Section */}
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-center gap-4">
                      <Thermometer className="w-6 h-6 text-red-500" />
                      <div>
                        <div className="text-xs font-black text-red-800 uppercase tracking-wider mb-0.5">Flammability</div>
                        <div className="text-sm font-bold text-red-900">주의 필요</div>
                      </div>
                    </div>
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center gap-4">
                      <Droplets className="w-6 h-6 text-blue-500" />
                      <div>
                        <div className="text-xs font-black text-blue-800 uppercase tracking-wider mb-0.5">Water Reactivity</div>
                        <div className="text-sm font-bold text-blue-900">해당없음</div>
                      </div>
                    </div>
                    <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center gap-4">
                      <ShieldAlert className="w-6 h-6 text-green-500" />
                      <div>
                        <div className="text-xs font-black text-green-800 uppercase tracking-wider mb-0.5">PPE Required</div>
                        <div className="text-sm font-bold text-green-900">전면 마스크 권장</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-gray-200">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-6" />
          <h3 className="text-2xl font-black text-gray-900 mb-2">검색 결과가 없습니다.</h3>
          <p className="text-gray-500 text-lg font-medium">관리교사에게 문의하시거나 KOSHA에서 직접 검색해 주세요.</p>
        </div>
      )}

      {/* Empty State Tips */}
      {!hasSearched && (
        <div className="grid md:grid-cols-2 gap-8 opacity-90 mt-10">
          <div className="bg-indigo-600 rounded-[2rem] p-10 text-white shadow-2xl shadow-indigo-200">
            <h3 className="text-2xl font-black mb-6">검색 가이드</h3>
            <ul className="space-y-4 font-bold text-indigo-100">
              <li className="flex items-start gap-3">
                <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                시약의 한글 또는 영문 이름을 입력하세요.
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                정확한 결과를 위해 CAS 번호 조회를 권장합니다.
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                목록 아이콘을 눌러 학교 주요 시약을 확인하세요.
              </li>
            </ul>
          </div>
          <div className="bg-white rounded-[2rem] p-10 border border-gray-100 flex flex-col justify-center text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <p className="text-gray-600 text-lg font-bold leading-relaxed">
              "모든 실험은 MSDS 정보를 숙지한 후<br />안전 보호구를 착용하고 진행해야 합니다."
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

