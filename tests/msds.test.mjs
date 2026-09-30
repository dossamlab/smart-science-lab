import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { default: handler } = await import('../netlify/functions/msds.mjs');

const ok = (items) => `<?xml version="1.0"?><response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>${items}</items></body></response>`;
let calls;

beforeEach(() => {
  calls = [];
  process.env.KOSHA_API_KEY = encodeURIComponent('k/ey+1'); // an "Encoding" key must be decoded once
  globalThis.fetch = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const op = u.pathname.split('/').pop();
    if (u.searchParams.get('serviceKey') !== 'k/ey+1') {
      return new Response('<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>');
    }
    if (op === 'getChemList001') {
      return new Response(ok(
        '<item><casNo>67-56-1</casNo><chemId>001151</chemId><chemNameKor>메틸 알코올</chemNameKor><lastDate>2025-08-08</lastDate></item>' +
        '<item><casNo>867-56-1</casNo><chemId>017182</chemId><chemNameKor>L-젖산 나트륨염</chemNameKor><lastDate>2025-08-08</lastDate></item>' +
        '<item><casNo>50-00-0</casNo><chemId>000100</chemId><chemNameKor>포름알데히드&lt;br/&gt;( 관용명 : 폼알데하이드 )</chemNameKor><lastDate>2025-08-08</lastDate></item>'));
    }
    if (op === 'getChemDetail021') {
      return new Response(ok('<item><msdsItemNameKor>유해·위험문구</msdsItemNameKor><itemDetail>H225 고인화성 액체 &amp; 증기</itemDetail><lev>2</lev></item>'));
    }
    if (op === 'getChemDetail081') {
      return new Response(ok('<item><msdsItemNameKor>호흡기 보호</msdsItemNameKor><itemDetail>산소가 부족한 경우(&amp;lt;19.6%)</itemDetail><lev>2</lev></item>'));
    }
    return new Response(ok(`<item><msdsItemNameKor>${op}</msdsItemNameKor><itemDetail><![CDATA[a<b]]></itemDetail><lev>1</lev></item>`));
  };
});

const get = async (qs) => {
  const r = await handler(new Request(`https://x/api/msds?${qs}`));
  return { status: r.status, body: await r.json(), cdn: r.headers.get('Netlify-CDN-Cache-Control') };
};

test('no key -> 503 NO_KEY', async () => {
  delete process.env.KOSHA_API_KEY;
  assert.equal((await get('q=벤젠')).body.error, 'NO_KEY');
});

test('CAS search uses searchCnd=1 and keeps only the exact CAS', async () => {
  const r = await get('q=67-56-1');
  assert.equal(r.status, 200);
  assert.equal(new URL(calls[0]).searchParams.get('searchCnd'), '1');
  assert.deepEqual(r.body.items.map(i => i.cas), ['67-56-1']);
  assert.match(r.cdn, /durable/);
});

test('name search uses searchCnd=0 and strips markup from names', async () => {
  const r = await get('q=' + encodeURIComponent('포름'));
  assert.equal(new URL(calls[0]).searchParams.get('searchCnd'), '0');
  assert.equal(r.body.items.length, 3);
  assert.equal(r.body.items[2].name, '포름알데히드 ( 관용명 : 폼알데하이드 )');
});

test('detail calls all 16 sections and decodes CDATA, entities and double-escaped entities', async () => {
  const r = await get('chemId=001008');
  assert.equal(calls.length, 16);
  assert.equal(new URL(calls[0]).pathname.split('/').pop(), 'getChemDetail011');
  assert.equal(new URL(calls[15]).pathname.split('/').pop(), 'getChemDetail161');
  assert.equal(r.body.sections[2][0].detail, 'H225 고인화성 액체 & 증기');
  assert.equal(r.body.sections[2][0].level, 2);
  assert.equal(r.body.sections[8][0].detail, '산소가 부족한 경우(<19.6%)');
  assert.equal(r.body.sections[1][0].detail, 'a<b');
});

test('input validation and upstream errors are not cached', async () => {
  assert.equal((await get('chemId=1;drop')).status, 400);
  assert.equal((await get('')).status, 400);
  assert.equal((await get('q=' + 'a'.repeat(60))).status, 400);
  process.env.KOSHA_API_KEY = 'wrong';
  const r = await get('q=벤젠');
  assert.equal(r.status, 502);
  assert.equal(r.cdn, null);
  assert.match(r.body.message, /30/);
});
