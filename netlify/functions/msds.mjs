// Proxy for the KOSHA MSDS Open API (data.go.kr "한국산업안전보건공단_물질안전보건자료 조회 서비스").
// Keeps the serviceKey server-side and lets Netlify's CDN cache results (KOSHA dev quota: 2,000 calls/day).
//   GET /api/msds?q=벤젠 | 71-43-2   -> { items: [{ chemId, name, cas, lastDate }] }
//   GET /api/msds?chemId=001008     -> { sections: { 1: [{ name, detail, level }], ... 16: [...] } }

const BASE = 'https://apis.data.go.kr/B552468/msdschem1';
const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ENTITIES[e])
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : '';
};

// ponytail: regex XML parsing — responses are flat <item> lists; switch to a real parser if KOSHA nests deeper.
export const parseItems = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

async function call(op, params) {
  const url = new URL(`${BASE}/${op}`);
  // data.go.kr issues an "Encoding" and a "Decoding" key; accept either.
  const key = process.env.KOSHA_API_KEY;
  url.searchParams.set('serviceKey', key.includes('%') ? decodeURIComponent(key) : key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const xml = await res.text();
  const code = tag(xml, 'resultCode') || tag(xml, 'returnReasonCode');
  if (!res.ok || (code && code !== '00')) {
    throw new Error(`KOSHA ${op} failed: ${code || res.status} ${tag(xml, 'resultMsg') || tag(xml, 'returnAuthMsg')}`);
  }
  return xml;
}

export async function search(q) {
  const xml = await call('getChemList001', {
    searchWrd: q, searchCnd: CAS_RE.test(q) ? 1 : 0, numOfRows: 30, pageNo: 1,
  });
  return parseItems(xml).map(item => ({
    chemId: tag(item, 'chemId'),
    name: tag(item, 'chemNameKor'),
    cas: tag(item, 'casNo'),
    lastDate: tag(item, 'lastDate'),
  }));
}

export async function detail(chemId) {
  const nums = Array.from({ length: 16 }, (_, i) => i + 1);
  const xmls = await Promise.all(nums.map(n =>
    call(`getChemDetail${String(n).padStart(2, '0')}1`, { chemId })));
  const sections = {};
  xmls.forEach((xml, i) => {
    sections[i + 1] = parseItems(xml).map(item => ({
      name: tag(item, 'msdsItemNameKor'),
      detail: tag(item, 'itemDetail'),
      level: Number(tag(item, 'lev')) || 1,
    }));
  });
  return sections;
}

const json = (body, status = 200, cache = false) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    // Cache successful lookups at the CDN for 30 days; MSDS revisions are rare.
    ...(cache ? { 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=2592000, stale-while-revalidate=86400' } : {}),
  },
});

export default async (req) => {
  if (!process.env.KOSHA_API_KEY) return json({ error: 'NO_KEY' }, 503);
  const params = new URL(req.url).searchParams;
  const q = params.get('q')?.trim();
  const chemId = params.get('chemId')?.trim();
  try {
    if (chemId) {
      if (!/^\d{1,10}$/.test(chemId)) return json({ error: 'BAD_CHEM_ID' }, 400);
      return json({ sections: await detail(chemId) }, 200, true);
    }
    if (q) {
      if (q.length > 50) return json({ error: 'QUERY_TOO_LONG' }, 400);
      return json({ items: await search(q) }, 200, true);
    }
    return json({ error: 'MISSING_QUERY' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: 'UPSTREAM', message: error.message }, 502);
  }
};

export const config = { path: '/api/msds' };
