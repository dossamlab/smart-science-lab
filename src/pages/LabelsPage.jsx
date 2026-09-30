import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Printer, QrCode } from 'lucide-react';
import { useCatalog } from '../utils/useCatalog';

// Bottle labels: each QR opens /msds/<CAS> (the at-a-glance safety card) on any phone or tablet.
export default function LabelsPage() {
  const catalog = useCatalog();
  const [picked, setPicked] = useState(() => new Set());
  const [codes, setCodes] = useState({}); // cas -> data URL

  const chosen = catalog.filter(c => picked.has(c.cas));

  useEffect(() => {
    let active = true;
    const missing = chosen.filter(c => !codes[c.cas]);
    if (!missing.length) return;
    Promise.all(missing.map(c =>
      QRCode.toDataURL(`${window.location.origin}/msds/${c.cas}`, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
        .then(url => [c.cas, url])))
      .then(pairs => { if (active) setCodes(prev => ({ ...prev, ...Object.fromEntries(pairs) })); });
    return () => { active = false; };
  }, [chosen, codes]);

  const toggle = (cas) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(cas)) next.delete(cas); else next.add(cas);
    return next;
  });

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="print:hidden">
        <Link to="/admin/settings" className="inline-flex items-center gap-2 text-brand-600 font-bold mb-6">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" /> 관리자 설정으로
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3 mb-2">
          <QrCode className="w-8 h-8 text-brand-600" aria-hidden="true" /> 시약병 QR 라벨
        </h1>
        <p className="text-gray-600 mb-6">시약을 고르고 인쇄하세요. 휴대폰이나 태블릿으로 QR을 찍으면 그 시약의 MSDS 안전 카드가 바로 열립니다.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setPicked(new Set(catalog.map(c => c.cas)))} className="h-11 px-4 rounded-xl bg-white border border-gray-200 font-bold text-sm">전체 선택</button>
          <button onClick={() => setPicked(new Set())} className="h-11 px-4 rounded-xl bg-white border border-gray-200 font-bold text-sm">선택 해제</button>
          <button onClick={() => window.print()} disabled={!chosen.length}
            className="h-11 px-5 rounded-xl bg-brand-600 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50">
            <Printer className="w-4 h-4" aria-hidden="true" /> {chosen.length}개 인쇄
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-8">
          {catalog.map(c => (
            <label key={c.cas} className={`flex items-center gap-3 min-h-14 p-3 rounded-xl border cursor-pointer ${picked.has(c.cas) ? 'border-brand-400 bg-brand-50' : 'border-gray-100 bg-white'}`}>
              <input type="checkbox" checked={picked.has(c.cas)} onChange={() => toggle(c.cas)} className="w-5 h-5 accent-brand-600" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 truncate">{c.name}</span>
                <span className="block text-xs text-gray-500 font-mono">{c.cas}</span>
              </span>
            </label>
          ))}
        </div>
        {chosen.length > 0 && <h2 className="text-lg font-black text-gray-900 mb-3">미리보기</h2>}
      </div>

      <div className="grid grid-cols-3 gap-3 print:gap-2">
        {chosen.map(c => (
          <div key={c.cas} className="break-inside-avoid border-2 border-gray-800 rounded-lg p-2 flex items-center gap-2 bg-white">
            {codes[c.cas]
              ? <img src={codes[c.cas]} alt={`${c.name} MSDS QR 코드`} className="w-24 h-24 shrink-0" />
              : <div className="w-24 h-24 shrink-0 bg-gray-100" />}
            <div className="min-w-0">
              <div className="font-black text-gray-900 leading-tight">{c.name}</div>
              <div className="text-xs font-mono text-gray-700">{c.cas}</div>
              {c.location && <div className="text-xs text-gray-700">보관: {c.location}</div>}
              <div className="text-[11px] text-gray-600 mt-1">QR을 찍으면 안전정보</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
