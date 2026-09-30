import { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';

// Full-text search over the public 경기도교육청 2026 과학실 안전관리 계획 (scripts/build-manual.mjs).
// The ~36 KB of text loads only once someone actually searches.

const MAX_RESULTS = 6;

function Highlight({ text, terms }) {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">{part}</mark> : part);
}

function snippet(text, term) {
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  const from = Math.max(0, at - 120);
  return (from ? '…' : '') + text.slice(from, from + 360) + (from + 360 < text.length ? '…' : '');
}

function Result({ chunk, terms }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="bg-white rounded-2xl border border-gray-100 p-5">
      {chunk.section && <p className="text-xs font-bold text-gray-500 mb-1">{chunk.section}</p>}
      <h4 className="font-black text-gray-900 mb-2 line-clamp-2">{chunk.title}</h4>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        <Highlight text={open ? chunk.text : snippet(chunk.text, terms[0])} terms={terms} />
      </p>
      {chunk.text.length > 360 && (
        <button onClick={() => setOpen(v => !v)} className="mt-2 h-9 text-sm font-bold text-brand-600">
          {open ? '접기' : '전체 보기'}
        </button>
      )}
    </li>
  );
}

export default function ManualSearch({ query }) {
  const [chunks, setChunks] = useState(null);
  const terms = query.trim().split(/\s+/).filter(t => t.length >= 2);

  useEffect(() => {
    if (!terms.length || chunks) return;
    let active = true;
    import('../data/manualChunks.json').then(m => { if (active) setChunks(m.default); });
    return () => { active = false; };
  }, [terms.length, chunks]);

  if (!terms.length) return null;

  const results = (chunks || [])
    .map(c => {
      const hay = `${c.title}\n${c.text}`.toLowerCase();
      const counts = terms.map(t => hay.split(t.toLowerCase()).length - 1);
      return { c, score: counts.every(n => n > 0) ? counts.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-black text-gray-900 flex items-center gap-2 px-2">
        <BookOpen className="w-5 h-5 text-brand-600" aria-hidden="true" /> 경기도교육청 2026 과학실 안전관리 계획에서 찾은 내용
      </h3>
      {!chunks ? (
        <p className="text-sm text-gray-500 px-2 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> 계획 원문을 불러오는 중...</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-gray-500 px-2">원문에서 찾지 못했습니다. 다른 낱말로 검색해 보세요.</p>
      ) : (
        <ul className="grid gap-3">
          {results.map(({ c }, i) => <Result key={`${c.title}-${i}`} chunk={c} terms={terms} />)}
        </ul>
      )}
    </section>
  );
}
