import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casListData } from '../src/data/casListData.js';
import { resolveCas, catalogMatches, mergeCatalog, normalize } from '../src/utils/chemSearch.js';

// CAS check digit: digits before it, read right to left, weighted 1, 2, 3, ... (mod 10).
const validCas = (cas) => {
  const m = cas.match(/^(\d{2,7})-(\d{2})-(\d)$/);
  if (!m) return false;
  const digits = (m[1] + m[2]).split('').reverse();
  return digits.reduce((sum, d, i) => sum + Number(d) * (i + 1), 0) % 10 === Number(m[3]);
};

test('every catalog CAS is well formed, check-digit valid and unique', () => {
  for (const item of casListData) assert.ok(validCas(item.cas), `${item.name} ${item.cas}`);
  assert.equal(new Set(casListData.map(i => i.cas)).size, casListData.length);
});

test('textbook and everyday names resolve to the right CAS', () => {
  const cases = {
    '염산': '7647-01-0',
    '염화 수소': '7647-01-0',
    '염화 수소(염산)': '7647-01-0',
    '메탄올': '67-56-1',
    '아세트산': '64-19-7',
    '초산': '64-19-7',
    '암모니아수': '1336-21-6',
    '아이오딘': '7553-56-2',
    '요오드': '7553-56-2',
    '폼알데하이드': '50-00-0',
    'BTB': '76-59-5',
    '나트륨': '7440-23-5',
    '7440-23-5': '7440-23-5',
  };
  for (const [q, cas] of Object.entries(cases)) assert.equal(resolveCas(q, casListData), cas, q);
  assert.equal(resolveCas('처음 보는 물질', casListData), null);
});

test('partial names suggest catalog entries', () => {
  const names = catalogMatches('나트륨', casListData).map(i => i.name);
  assert.ok(names.includes('수산화 나트륨') && names.includes('염화 나트륨'));
  assert.equal(normalize(' 황산 구리(Ⅱ) '), '황산구리ⅱ');
});

test('sheet rows add reagents and override names/locations by CAS', () => {
  const merged = mergeCatalog(casListData, [
    { name: '나트륨(석유 속 보관)', cas: '7440-23-5', location: '시약장 A-1' },
    { name: '새 시약', cas: '7732-18-5', formula: 'H2O' },
    { name: '잘못된 행', cas: 'abc' },
  ]);
  assert.equal(merged.length, casListData.length + 1);
  const na = merged.find(i => i.cas === '7440-23-5');
  assert.equal(na.name, '나트륨(석유 속 보관)');
  assert.equal(na.location, '시약장 A-1');
  assert.equal(na.formula, 'Na');
  assert.equal(merged.find(i => i.cas === '7732-18-5').category, '기타');
});
