import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Loader2, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import PinGate from '../components/PinGate';
import { useAppConfig } from '../context/AppConfigContext';
import { CHECKLIST, ALL_ITEMS, RATINGS } from '../data/inspectionChecklist';

const LABS = ['물리/지학실', '화학실', '생명과학실', '물리/지학 준비실', '화학 준비실'];

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const RATING_STYLE = {
  '○': 'bg-emerald-600 text-white border-emerald-600',
  '△': 'bg-amber-400 text-amber-950 border-amber-400',
  '×': 'bg-red-600 text-white border-red-600',
};

function InspectionForm() {
  const { config } = useAppConfig();
  const gasUrl = config.gasUrl?.trim();
  const [month, setMonth] = useState(thisMonth);
  const [lab, setLab] = useState(LABS[0]);
  const [inspector, setInspector] = useState('');
  const [results, setResults] = useState({}); // no -> '○' | '△' | '×'
  const [note, setNote] = useState('');
  const [status, setStatus] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!gasUrl) return;
    let active = true;
    fetch(`${gasUrl}?type=inspections`)
      .then(r => r.json())
      .then(res => { if (active && res.status === 'success') setHistory(res.data?.inspections || []); })
      .catch(() => {});
    return () => { active = false; };
  }, [gasUrl, historyKey]);

  const rate = (no, value) => setResults(prev => ({ ...prev, [no]: prev[no] === value ? undefined : value }));
  const rated = ALL_ITEMS.filter(item => results[item.no]).length;
  const weak = ALL_ITEMS.filter(item => results[item.no] === '×').length;

  const save = async () => {
    if (!gasUrl) {
      setStatus({ type: 'error', text: '관리자 설정의 Google 연동(Apps Script URL)이 필요합니다.' });
      return;
    }
    if (!rated) {
      setStatus({ type: 'error', text: '점검 결과를 하나 이상 입력하세요.' });
      return;
    }
    setSaving(true);
    setStatus({ type: '', text: '' });
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'inspection', month, lab, inspector, note,
          results: ALL_ITEMS.filter(item => results[item.no]).map(item => ({ no: item.no, result: results[item.no] })),
        }),
      });
      const body = await res.json();
      if (body.status !== 'success') throw new Error(body.message);
      setStatus({ type: 'success', text: `${month} ${lab} 점검 결과를 스프레드시트 '안전점검기록' 탭에 저장했습니다.` });
      setHistoryKey(k => k + 1);
    } catch (e) {
      setStatus({ type: 'error', text: e.message || '저장하지 못했습니다. 인터넷 연결을 확인해 주세요.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="print:hidden">
        <Link to="/admin/settings" className="inline-flex items-center gap-2 text-brand-600 font-bold mb-6">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" /> 관리자 설정으로
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3 mb-1">
        <ClipboardCheck className="w-8 h-8 text-brand-600 print:hidden" aria-hidden="true" /> 과학실험실 안전관리 자체 점검표
      </h1>
      <p className="text-sm text-gray-600 mb-6">경기도교육청 2026 과학실 안전관리 계획 서식1 · 월 1회(매월 4일) 이상 점검 후 실험실별 게시 · ★ 주요점검사항</p>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <label className="block">
          <span className="text-xs font-black text-gray-600">점검월</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-1 w-full h-12 px-3 rounded-xl bg-white border border-gray-200 font-bold text-base" />
        </label>
        <label className="block">
          <span className="text-xs font-black text-gray-600">실험실</span>
          <input list="lab-list" value={lab} onChange={e => setLab(e.target.value)} className="mt-1 w-full h-12 px-3 rounded-xl bg-white border border-gray-200 font-bold text-base" />
          <datalist id="lab-list">{LABS.map(l => <option key={l} value={l} />)}</datalist>
        </label>
        <label className="block">
          <span className="text-xs font-black text-gray-600">점검자 (선택)</span>
          <input value={inspector} onChange={e => setInspector(e.target.value)} maxLength={20} className="mt-1 w-full h-12 px-3 rounded-xl bg-white border border-gray-200 font-bold text-base" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <button onClick={() => setResults(Object.fromEntries(ALL_ITEMS.map(item => [item.no, '○'])))}
          className="h-11 px-4 rounded-xl bg-white border border-gray-200 font-bold text-sm">모두 양호로 채우기</button>
        <span className="text-sm text-gray-600">평가 {rated}/{ALL_ITEMS.length} · 미흡 {weak} · 해당 없는 항목은 비워 두세요</span>
      </div>

      <div className="space-y-6">
        {CHECKLIST.map(group => (
          <section key={group.area} className="break-inside-avoid">
            <h2 className="text-lg font-black text-gray-900 mb-2">{group.area}</h2>
            <ol className="space-y-2">
              {group.items.map(item => (
                <li key={item.no} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-grow">
                    <p className="font-bold text-gray-900 leading-relaxed">
                      <span className="text-brand-600 mr-1">{item.no}.</span>{item.text}
                      {item.key && <span className="ml-1 text-amber-600" title="주요점검사항">★</span>}
                    </p>
                    {item.sub && (
                      <ul className="mt-1 text-sm text-gray-600 space-y-0.5">
                        {item.sub.map(s => <li key={s}>- {s}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0" role="group" aria-label={`${item.no}번 평가`}>
                    {RATINGS.map(r => (
                      <button key={r.value} type="button" onClick={() => rate(item.no, r.value)}
                        aria-pressed={results[item.no] === r.value}
                        className={`w-16 h-12 rounded-xl border-2 font-black text-sm ${results[item.no] === r.value ? RATING_STYLE[r.value] : 'bg-white text-gray-600 border-gray-200'}`}>
                        {r.value} {r.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <label className="block mt-6">
        <span className="text-sm font-black text-gray-700">미흡 사항 조치 계획 / 비고</span>
        <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
          className="mt-1 w-full p-3 rounded-xl bg-white border border-gray-200 text-base" />
      </label>
      <div className="hidden print:block mt-8 text-sm">점검자(과학업무 담당 부서 부장): ____________ (서명) &nbsp;&nbsp; 확인자(교감): ____________ (서명)</div>

      {status.text && (
        <div className={`mt-4 p-4 rounded-2xl flex items-center gap-2 font-bold text-sm print:hidden ${status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />} {status.text}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 justify-end print:hidden">
        <button onClick={() => window.print()} className="h-12 px-5 rounded-xl bg-white border border-gray-200 font-black flex items-center gap-2">
          <Printer className="w-5 h-5" aria-hidden="true" /> 게시용 인쇄
        </button>
        <button onClick={save} disabled={saving} className="h-12 px-6 rounded-xl bg-brand-600 text-white font-black flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" aria-label="저장 중" /> : <ClipboardCheck className="w-5 h-5" aria-hidden="true" />} 점검 결과 저장
        </button>
      </div>

      {history.length > 0 && (
        <section className="mt-10 print:hidden">
          <h2 className="text-lg font-black text-gray-900 mb-2">최근 점검 기록</h2>
          <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-bold text-gray-900">{h.month} · {h.lab}</span>
                <span className={h.weak ? 'font-bold text-red-700' : 'text-gray-600'}>미흡 {h.weak} · {h.recordedAt}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function InspectionPage() {
  return <PinGate><InspectionForm /></PinGate>;
}
