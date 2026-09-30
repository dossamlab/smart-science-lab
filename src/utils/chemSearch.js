// Students search with textbook names (염산, 아이오딘, 암모니아수); KOSHA indexes older or formal names
// (염화수소, 요오드, 암모니아 용액), so a name search there often misses. Resolve known names to a CAS first.

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

// Everyday and older names -> CAS. Catalog names are matched automatically; list only the extras.
const ALIASES = {
  '염산': '7647-01-0', '염화수소': '7647-01-0',
  '초산': '64-19-7', '빙초산': '64-19-7',
  '메틸알코올': '67-56-1', '에틸알코올': '64-17-5', '알코올': '64-17-5',
  '암모니아수': '1336-21-6', '암모니아용액': '1336-21-6',
  '요오드': '7553-56-2', '요오드화칼륨': '7681-11-0',
  '포름알데히드': '50-00-0', '포르말린': '50-00-0',
  '과망간산칼륨': '7722-64-7', '중크롬산칼륨': '7778-50-9',
  '가성소다': '1310-73-2', '가성칼리': '1310-58-3',
  '소석회': '1305-62-0', '생석회': '1305-78-8',
  '베이킹소다': '144-55-8', '중탄산나트륨': '144-55-8', '탄산수소나트륨': '144-55-8',
  'btb': '76-59-5', '브로모티몰청색': '76-59-5', '브로모티몰블루': '76-59-5',
  '소금': '7647-14-5',
  '황산구리': '7758-99-8',
  '헥산': '110-54-3', '글리세롤': '56-81-5', '덱스트로스': '50-99-7', '전분': '9005-25-8',
  '이소프로필알코올': '67-63-0', 'ipa': '67-63-0',
  '디에틸에테르': '60-29-7', '에테르': '60-29-7',
  '염화제이철': '7705-08-0', '염화철': '7705-08-0',
  '과산화수소수': '7722-84-1',
};

// "염화 수소(염산)" -> "염화수소염산"; spaces, brackets, dots and case never decide a match.
export const normalize = (s) => String(s).toLowerCase().replace(/[\s()（）[\]·.,\-–]/g, '');

export const isCas = (s) => CAS_RE.test(String(s).trim());

/** Every name a catalog entry answers to: full name, name without the bracket part, bracket content. */
const namesOf = (item) => {
  const m = item.name.match(/^(.*?)\((.*?)\)(.*)$/);
  return m ? [item.name, m[1] + m[3], m[2]] : [item.name];
};

/** Exact match on a catalog name or alias -> the CAS to search by, else null. */
export function resolveCas(query, catalog) {
  const q = normalize(query);
  if (!q) return null;
  if (isCas(query)) return query.trim();
  const hit = catalog.find(item => namesOf(item).some(n => normalize(n) === q));
  if (hit) return hit.cas;
  return ALIASES[q] || null;
}

/** Catalog entries whose name contains the query, for "학교 보유 시약" suggestions. */
export function catalogMatches(query, catalog) {
  const q = normalize(query);
  if (!q) return [];
  return catalog.filter(item => namesOf(item).some(n => normalize(n).includes(q)));
}

/** Merge the built-in list with sheet rows; the sheet wins on the same CAS (so it can fix names or add a location). */
export function mergeCatalog(builtIn, sheetRows) {
  const byCas = new Map(builtIn.map(item => [item.cas, item]));
  for (const row of sheetRows) {
    if (!isCas(row.cas)) continue;
    byCas.set(row.cas, { ...byCas.get(row.cas), ...Object.fromEntries(Object.entries(row).filter(([, v]) => v)) });
  }
  return [...byCas.values()].map((item, i) => ({ id: item.id ?? `sheet-${i}`, category: '기타', ...item }));
}
