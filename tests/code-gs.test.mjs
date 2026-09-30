// Runs apps-script/Code.gs against an in-memory spreadsheet. Fake names only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const RealmDate = vm.runInNewContext('Date');
const pad = (n) => String(n).padStart(2, '0');
const kstDate = (y, m, d) => new RealmDate(Date.UTC(y, m - 1, d) - 9 * 3600e3); // how Sheets hands back KST midnight
const kstString = (ms) => { const k = new Date(ms + 9 * 3600e3); return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`; };

function makeSheet(name, rows) {
  const s = {
    name, rows,
    getName: () => name,
    getLastRow: () => s.rows.length,
    getLastColumn: () => Math.max(0, ...s.rows.map(r => r.length)),
    getDataRange: () => ({ getValues: () => s.rows.map(r => [...r, ...Array(s.getLastColumn() - r.length).fill('')]) }),
    deleteRow: (r) => { s.rows.splice(r - 1, 1); },
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (s.rows[r - 1 + i] || [])[c - 1 + j] ?? '')),
      getValue: () => (s.rows[r - 1] || [])[c - 1] ?? '',
      setValue(v) { while (s.rows.length < r) s.rows.push([]); s.rows[r - 1][c - 1] = v; return this; },
      setNumberFormat() { return this; },
      setValues(vals) { vals.forEach((row, i) => { while (s.rows.length < r + i) s.rows.push([]); row.forEach((v, j) => { s.rows[r - 1 + i][c - 1 + j] = v; }); }); return this; },
    }),
  };
  return s;
}

function load() {
  const today = kstString(Date.now());
  const res = makeSheet('예약내역', [
    ['ID', '신청자명', '날짜', '시간대', '기자재', '상태', '신청일시'],
    ['old1', '홍길동 (10101)', kstDate(2099, 10, 5), '1교시 (09:00~09:50)', '광학 현미경', '예약완료', kstDate(2099, 10, 1)],
    ['past1', '김철수 (20202)', kstDate(2020, 3, 2), '2교시 (10:00~10:50)', '광학 현미경', '예약완료', kstDate(2020, 3, 1)],
  ]);
  const eq = makeSheet('기자재목록', [['기자재명'], ['광학 현미경'], ['전자 저울']]);
  const chem = makeSheet('시트1', [['이름', 'CAS번호', '화학식', '섹션1'], ['나트륨', '7440-23-5', 'Na', ''], ['물', '7732-18-5', 'H2O', ''], ['잘못', 'abc', '', '']]);
  const sheets = [chem, res, eq];
  const ss = {
    getSheets: () => sheets,
    getSheetByName: (n) => sheets.find(s => s.name === n) || null,
    insertSheet: (n) => { const s = makeSheet(n, []); sheets.push(s); return s; },
  };
  const ctx = {
    Date: RealmDate,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => { throw new Error('openById should not be used'); } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Logger: { log() {} },
    Utilities: {
      formatDate: (d, tz, f) => {
        const s = kstString(d.getTime());
        if (!f.includes('HH')) return s;
        const k = new Date(d.getTime() + 9 * 3600e3);
        return `${s} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
      },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const post = (body) => ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  return { ctx, post, res, sheets, today };
}

test('GET masks names, hides student IDs, sends KST dates and adds the 학번 column', () => {
  const { ctx, res } = load();
  const g = ctx.doGet({ parameter: {} });
  assert.equal(g.data.reservations[0]['신청자명'], '홍*동');
  assert.equal(g.data.reservations[0]['날짜'], '2099-10-05');
  assert.ok(!JSON.stringify(g).includes('10101'));
  assert.deepEqual(g.data.equipments, ['광학 현미경', '전자 저울']);
  assert.ok(res.rows[0].includes('학번') && res.rows[0].includes('반납일시'));
});

test('GET ?type=chemicals reads the CAS번호 sheet and skips bad rows', () => {
  const { ctx } = load();
  const g = ctx.doGet({ parameter: { type: 'chemicals' } });
  assert.deepEqual(g.data.chemicals.map(c => c.cas), ['7440-23-5', '7732-18-5']);
  assert.equal(g.data.chemicals[0].formula, 'Na');
});

test('booking: conflicts, past dates and missing fields are refused', () => {
  const { post, res } = load();
  const base = { action: 'book', studentName: '김철수', studentId: '20202', equipment: '광학 현미경' };
  let r = post({ ...base, date: '2099-10-05', time: '2교시 (10:00~10:50), 1교시 (09:00~09:50)' });
  assert.equal(r.status, 'error');
  assert.match(r.message, /1교시/);
  assert.match(post({ ...base, date: '2020-01-01', time: '1교시 (09:00~09:50)' }).message, /지난 날짜/);
  assert.equal(post({ ...base, studentName: '', date: '2099-10-05', time: 'a' }).status, 'error');

  r = post({ ...base, date: '2099-10-05', time: '2교시 (10:00~10:50)' });
  assert.equal(r.status, 'success');
  const H = res.rows[0];
  const row = res.rows.at(-1);
  assert.equal(row[H.indexOf('학번')], '20202');
  assert.equal(row[H.indexOf('신청자명')], '김철수');
  assert.equal(row[H.indexOf('날짜')], '2099-10-05');
});

test('return and cancel need the booker\'s 학번; past bookings cannot be cancelled', () => {
  const { post, res } = load();
  const H = () => res.rows[0];
  assert.match(post({ action: 'cancel', id: 'old1', studentId: '99999' }).message, /학번/);
  assert.equal(post({ action: 'cancel', id: 'old1', studentId: '10101' }).status, 'success'); // legacy '이름 (학번)' row
  assert.equal(res.rows[1][H().indexOf('상태')], '예약취소');
  assert.match(post({ action: 'return', id: 'old1', studentId: '10101' }).message, /이미 처리/);

  assert.match(post({ action: 'cancel', id: 'past1', studentId: '20202' }).message, /지난 예약/);
  assert.equal(post({ action: 'return', id: 'past1', studentId: '20202' }).status, 'success');
  assert.equal(res.rows[2][H().indexOf('상태')], '반납완료');
  assert.match(post({ action: 'return', id: 'nope', studentId: '1' }).message, /찾을 수 없습니다/);
});

test('inspection creates its sheet, stores each item under 항목N and counts 미흡', () => {
  const { ctx, post, sheets } = load();
  const r = post({
    action: 'inspection', month: '2026-10', lab: '화학실', inspector: '교사', note: '소화기 교체 예정',
    results: [{ no: '1', result: '○' }, { no: '24-1', result: '×' }, { no: '11', result: '×' }, { no: 'x', result: '○' }, { no: '2', result: '?' }],
  });
  assert.equal(r.status, 'success');
  const sheet = sheets.find(s => s.name === '안전점검기록');
  const [head, row] = sheet.rows;
  assert.equal(row[head.indexOf('항목24-1')], '×');
  assert.equal(row[head.indexOf('미흡')], 2);
  assert.ok(!head.includes('항목x') && !head.includes('항목2'));
  const list = ctx.doGet({ parameter: { type: 'inspections' } }).data.inspections;
  assert.deepEqual(list.map(i => [i.month, i.lab, i.weak]), [['2026-10', '화학실', 2]]);
  assert.ok(!JSON.stringify(list).includes('교사'));
  assert.equal(post({ action: 'inspection', month: '2026/10', lab: '화학실', results: [{ no: '1', result: '○' }] }).status, 'error');
});

test('cleanupReservations deletes only rows older than KEEP_DAYS', () => {
  const { ctx, res } = load();
  assert.equal(ctx.cleanupReservations(), 1);
  assert.deepEqual(res.rows.slice(1).map(r => r[0]), ['old1']);
});

test('bad JSON and unknown actions are refused', () => {
  const { ctx, post } = load();
  assert.equal(ctx.doPost({ postData: { contents: '{bad' } }).status, 'error');
  assert.equal(post({ action: 'nope' }).status, 'error');
});
