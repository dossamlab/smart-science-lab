import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Printer, QrCode } from 'lucide-react';
import { useCatalog } from '../utils/useCatalog';
import { useAppConfig } from '../context/AppConfigContext';

// Bottle labels: each QR opens /msds/<CAS> (the at-a-glance safety card) on any phone or tablet.
// Unit labels: each QR opens /reservation?eq=<기자재>&unit=<번호> with that laptop or sensor kit picked.
export default function LabelsPage() {
  const catalog = useCatalog();
  const { config } = useAppConfig();
  const gasUrl = config.gasUrl?.trim();
  const [kind, setKind] = useState('chem'); // 'chem' | 'unit'
  const [picked, setPicked] = useState(() => new Set());
  const [units, setUnits] = useState({}); // { '학생용 노트북': 14 } from the sheet's 수량 column
  const [codes, setCodes] = useState({}); // QR target URL -> data URL

  useEffect(() => {
    if (!gasUrl) return;
    let active = true;
    fetch(`${gasUrl}?type=equipments`)
      .then(r => r.json())
      .then(res => { if (active && res.status === 'success') setUnits(res.data?.units || {}); })
      .catch(() => {});
    return () => { active = false; };
  }, [gasUrl]);

  const origin = window.location.origin;
  const options = kind === 'chem'
    ? catalog.map(c => ({ key: c.cas, title: c.name, sub: c.cas }))
    : Object.entries(units).map(([name, n]) => ({ key: name, title: name, sub: `${n}대 · 번호별 라벨` }));
  const labels = kind === 'chem'
    ? catalog.filter(c => picked.has(c.cas)).map(c => ({
      key: c.cas, url: `${origin}/msds/${c.cas}`, title: c.name, alt: `${c.name} MSDS QR 코드`,
      lines: [c.cas, c.location && `보관: ${c.location}`], hint: 'QR을 찍으면 안전정보',
    }))
    : Object.entries(units).filter(([name]) => picked.has(name)).flatMap(([name, n]) =>
      Array.from({ length: n }, (_, i) => ({
        key: `${name}#${i + 1}`, url: `${origin}/reservation?eq=${encodeURIComponent(name)}&unit=${i + 1}`,
        title: `${name} ${i + 1}번`, alt: `${name} ${i + 1}번 예약 QR 코드`, lines: [], hint: 'QR을 찍으면 예약·반납',
      })));

  useEffect(() => {
    let active = true;
    const missing = labels.filter(l => !codes[l.url]);
    if (!missing.length) return;
    Promise.all(missing.map(l =>
      QRCode.toDataURL(l.url, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then(url => [l.url, url])))
      .then(pairs => { if (active) setCodes(prev => ({ ...prev, ...Object.fromEntries(pairs) })); });
    return () => { active = false; };
  }, [labels, codes]);

  const toggle = (key) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const switchKind = (next) => {
    setKind(next);
    setPicked(new Set());
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="print:hidden">
        <Link to="/admin/settings" className="inline-flex items-center gap-2 text-brand-600 font-bold mb-6">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" /> 관리자 설정으로
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3 mb-2">
          <QrCode className="w-8 h-8 text-brand-600" aria-hidden="true" /> QR 라벨
        </h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-4 max-w-md" role="group" aria-label="라벨 종류">
          {[['chem', '시약병'], ['unit', '기자재 번호']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => switchKind(value)} aria-pressed={kind === value}
              className={`flex-1 h-11 rounded-xl text-sm font-black transition-all ${kind === value ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-gray-600 mb-6">
          {kind === 'chem'
            ? '시약을 고르고 인쇄하세요. 휴대폰이나 태블릿으로 QR을 찍으면 그 시약의 MSDS 안전 카드가 바로 열립니다.'
            : '노트북·센서처럼 여러 대인 기자재의 번호별 라벨입니다. QR을 찍으면 그 번호가 골라진 예약 화면이 열리고, 오늘 예약이 있으면 반납하기로 바로 갑니다.'}
        </p>

        {kind === 'unit' && !options.length && (
          <p className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-bold text-amber-800">
            스프레드시트 기자재목록 시트의 '수량' 열에 2 이상을 적은 기자재가 여기에 나옵니다.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setPicked(new Set(options.map(o => o.key)))} className="h-11 px-4 rounded-xl bg-white border border-gray-200 font-bold text-sm">전체 선택</button>
          <button onClick={() => setPicked(new Set())} className="h-11 px-4 rounded-xl bg-white border border-gray-200 font-bold text-sm">선택 해제</button>
          <button onClick={() => window.print()} disabled={!labels.length}
            className="h-11 px-5 rounded-xl bg-brand-600 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50">
            <Printer className="w-4 h-4" aria-hidden="true" /> {labels.length}개 인쇄
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-8">
          {options.map(o => (
            <label key={o.key} className={`flex items-center gap-3 min-h-14 p-3 rounded-xl border cursor-pointer ${picked.has(o.key) ? 'border-brand-400 bg-brand-50' : 'border-gray-100 bg-white'}`}>
              <input type="checkbox" checked={picked.has(o.key)} onChange={() => toggle(o.key)} className="w-5 h-5 accent-brand-600" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 truncate">{o.title}</span>
                <span className="block text-xs text-gray-500 font-mono">{o.sub}</span>
              </span>
            </label>
          ))}
        </div>
        {labels.length > 0 && <h2 className="text-lg font-black text-gray-900 mb-3">미리보기</h2>}
      </div>

      <div className="grid grid-cols-3 gap-3 print:gap-2">
        {labels.map(l => (
          <div key={l.key} className="break-inside-avoid border-2 border-gray-800 rounded-lg p-2 flex items-center gap-2 bg-white">
            {codes[l.url]
              ? <img src={codes[l.url]} alt={l.alt} className="w-24 h-24 shrink-0" />
              : <div className="w-24 h-24 shrink-0 bg-gray-100" />}
            <div className="min-w-0">
              <div className="font-black text-gray-900 leading-tight">{l.title}</div>
              {l.lines.filter(Boolean).map(line => <div key={line} className="text-xs text-gray-700">{line}</div>)}
              <div className="text-[11px] text-gray-600 mt-1">{l.hint}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
