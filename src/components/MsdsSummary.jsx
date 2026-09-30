import { useState } from 'react';
import { Eye, Hand, Wind, Utensils, Flame, Droplets, ShieldCheck, Ban, Archive, Siren, Glasses, Shirt } from 'lucide-react';

// At-a-glance view built from KOSHA's fixed item names. Text is shown verbatim — never summarized —
// so a wrong paraphrase can't reach a student. Anything we can't place stays in the full 16 sections below.

// Tags come from H codes, not KOSHA's pictogram file names: KOSHA's GHS03/GHS04 files are swapped
// against the UN numbering (HCl, H280 gas, ships GHS03.gif; KMnO4, H272 oxidizer, ships GHS04.gif).
// Order = display order; red ones are the "stop and read" hazards.
const H_TAGS = [
  { label: '물과 반응', codes: [260, 261], red: true },
  { label: '자연발화', codes: [250, 251, 252], red: true },
  { label: '폭발성', codes: [200, 201, 202, 203, 204, 205, 240, 241], red: true },
  { label: '인화성', codes: [220, 221, 222, 223, 224, 225, 226, 228, 229, 230, 231, 242] },
  { label: '산화성', codes: [270, 271, 272] },
  { label: '고압가스', codes: [280, 281] },
  { label: '부식성', codes: [290, 314, 318] },
  { label: '급성 독성', codes: [300, 301, 310, 311, 330, 331] },
  { label: '건강 유해성', codes: [304, 334, 340, 341, 350, 351, 360, 361, 362, 370, 371, 372, 373] },
  { label: '자극성·유해', codes: [302, 312, 315, 317, 319, 320, 332, 335, 336] },
  { label: '수생환경 유해', codes: [400, 401, 402, 410, 411, 412, 413] },
];

const isEmpty = (s) => !s || !s.replace(/[|\s]/g, '') || /^자료\s*없음$/.test(s.replace(/[|\s]/g, ''));
// KOSHA joins sentences without spaces ("씻으시오.가능하면") and repeats the route ("눈에 묻으면:") the tile title already says.
const tidy = (s) => s
  .replace(/^(눈에 묻으면|피부\(또는 머리카락\)에 묻으면|피부에 묻으면|흡입하면|삼켰다면)\s*:\s*/, '')
  .replace(/\.(?=[가-힣[(])/g, '. ');
const lines = (s) => (isEmpty(s) ? [] : s.split('|').map(x => x.trim()).filter(x => x && !/^자료\s*없음$/.test(x)));
const find = (items, name) => items?.find(it => it.name.replace(/\s/g, '').startsWith(name.replace(/\s/g, '')));
const text = (items, name) => find(items, name)?.detail || '';

// "P305+P351+P338 : 눈에 묻으면:..." -> "눈에 묻으면:..."
const stripCode = (s) => s.replace(/^[PH]\d{3}(\+[PH]\d{3})*\s*:\s*/, '');
const pStatements = (sections, group, prefixRe) =>
  lines(text(sections[2], group)).map(stripCode).filter(s => prefixRe.test(s));

const DANGER_RE = /(사용하지 마시오|하지 마시오|마시오\.?\s*$|금지|즉시|물에 접촉시키지)/;

function Emph({ children }) {
  return children.split(DANGER_RE).map((part, i) =>
    DANGER_RE.test(part) ? <strong key={i} className="text-red-700">{part}</strong> : part);
}

function Lines({ items, max = 3 }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return <p className="text-sm text-gray-500">자료 없음 · 아래 원문 확인</p>;
  const shown = open ? items : items.slice(0, max);
  return (
    <>
      <ul className="space-y-1.5">
        {shown.map((l, i) => <li key={i} className="text-sm leading-relaxed text-gray-700 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-gray-400"><Emph>{tidy(l)}</Emph></li>)}
      </ul>
      {items.length > max && (
        <button onClick={() => setOpen(v => !v)} className="mt-2 h-9 text-sm font-bold text-indigo-600">
          {open ? '접기' : `${items.length - max}개 더 보기`}
        </button>
      )}
    </>
  );
}

function Tile({ icon: Icon, title, tone, children, note }) {
  const tones = {
    red: 'border-red-200 bg-white [&_h4]:text-red-700',
    amber: 'border-amber-200 bg-white [&_h4]:text-amber-800',
  };
  return (
    <section className={`rounded-2xl border-2 p-4 ${tones[tone]}`}>
      <h4 className="flex items-center gap-2 font-black text-base mb-2"><Icon className="w-5 h-5 shrink-0" />{title}</h4>
      {children}
      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
    </section>
  );
}

export default function MsdsSummary({ sections }) {
  const hazard = sections[2] || [];
  const hText = text(hazard, '유해·위험문구');
  const hCodes = (hText.match(/H(\d{3})/g) || []).map(c => Number(c.slice(1)));
  const tags = H_TAGS.filter(t => t.codes.some(c => hCodes.includes(c)));
  const signal = text(hazard, '신호어').trim();

  // First aid: section 4 by route, falling back to the label's response (P3xx) statements.
  const aid = (sec4Name, pRe) => {
    const own = lines(text(sections[4], sec4Name));
    if (own.length) return { items: own };
    const fromLabel = pStatements(sections, '대응', pRe);
    return { items: fromLabel, note: fromLabel.length ? '경고표지 대응문구 기준' : null };
  };
  const eye = aid('눈에 들어갔을 때', /^눈에/);
  const skin = aid('피부에 접촉했을 때', /^피부/);
  const inhale = aid('흡입했을 때', /^흡입/);
  const swallow = aid('먹었을 때', /^삼켰/);

  const ppe = [
    { name: '호흡기 보호', label: '마스크', icon: Wind },
    { name: '눈 보호', label: '보안경', icon: Glasses },
    { name: '손 보호', label: '장갑', icon: Hand },
    { name: '신체 보호', label: '보호복', icon: Shirt },
  ].filter(p => !isEmpty(text(sections[8], p.name)));

  const avoid = [...lines(text(sections[10], '피해야 할 물질')), ...lines(text(sections[10], '피해야 할 조건'))];
  const storage = lines(text(sections[7], '안전한 저장방법'));
  const storageItems = storage.length ? storage : pStatements(sections, '저장', /./);

  return (
    <div className="space-y-4">
      {(signal || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {signal && (
            <span className={`px-4 py-2 rounded-xl text-lg font-black ${signal === '위험' ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950'}`}>{signal}</span>
          )}
          {tags.map(t => (
            <span key={t.label} className={`px-3 py-2 rounded-xl text-sm font-bold ${t.red ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{t.label}</span>
          ))}
        </div>
      )}

      {lines(hText).length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
          <ul className="space-y-1">
            {lines(hText).map((h, i) => <li key={i} className="text-sm font-bold text-red-900 leading-relaxed">{tidy(stripCode(h))}</li>)}
          </ul>
        </div>
      )}

      <h3 className="flex items-center gap-2 font-black text-red-700 pt-1"><Siren className="w-5 h-5" /> 사고가 났을 때</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile icon={Eye} title="눈에 들어가면" tone="red" note={eye.note}><Lines items={eye.items} /></Tile>
        <Tile icon={Hand} title="피부에 묻으면" tone="red" note={skin.note}><Lines items={skin.items} /></Tile>
        <Tile icon={Wind} title="들이마시면" tone="red" note={inhale.note}><Lines items={inhale.items} /></Tile>
        <Tile icon={Utensils} title="삼키면" tone="red" note={swallow.note}><Lines items={swallow.items} /></Tile>
        <Tile icon={Flame} title="불이 나면" tone="red"><Lines items={lines(text(sections[5], '적절한'))} max={2} /></Tile>
        <Tile icon={Droplets} title="쏟았을 때" tone="red"><Lines items={lines(text(sections[6], '정화 또는 제거'))} max={2} /></Tile>
      </div>

      <h3 className="flex items-center gap-2 font-black text-amber-800 pt-1"><ShieldCheck className="w-5 h-5" /> 쓰기 전에</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile icon={ShieldCheck} title="보호구" tone="amber">
          {ppe.length ? (
            <div className="flex flex-wrap gap-2">
              {ppe.map(p => (
                <span key={p.name} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-amber-200 text-sm font-bold text-amber-900">
                  <p.icon className="w-4 h-4" />{p.label}
                </span>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">자료 없음 · 아래 원문 확인</p>}
        </Tile>
        <Tile icon={Ban} title="피해야 할 것" tone="amber"><Lines items={avoid} /></Tile>
        <Tile icon={Archive} title="보관" tone="amber"><Lines items={storageItems} max={2} /></Tile>
      </div>
    </div>
  );
}
