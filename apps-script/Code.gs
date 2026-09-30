/**
 * Lab-ON 과학실 API (Google Apps Script 웹 앱) — 기자재 예약, 보유 시약 목록, 월간 안전점검 기록
 *
 * 붙여넣기 → 배포 → 배포 관리 → 기존 배포 수정(연필) → 버전: 새 버전 → 배포
 * (새 배포를 만들면 URL이 바뀌므로 반드시 '기존 배포 수정'으로 올린다)
 *
 * 개인정보: 조회(GET) 응답에는 이름을 가려서(홍*동) 내보내고 학번·점검자 이름은 내보내지 않는다.
 * 학번은 반납·취소 본인 확인에만 쓴다. 스프레드시트 공유는 '제한됨'으로 둔다(웹 앱은 소유자 권한으로 실행).
 *
 * 안전점검 기록은 관리자 PIN이 있어야 저장된다. [프로젝트 설정 → 스크립트 속성]에
 * ADMIN_PIN(Netlify의 ADMIN_PIN과 같은 값)을 넣어 둔다. 없으면 점검 기록 저장을 거부한다.
 *
 * 시트는 이름이 아니라 1행 헤더로 찾는다.
 *   예약 시트: 1행에 '신청자명'이 있는 시트 (없던 '학번'·'반납일시'·'번호' 열은 자동으로 추가)
 *   기자재 시트: 1행 A열이 '기자재'로 시작하는 다른 시트의 A열 목록 (없으면 앱 기본 목록 사용)
 *     1행에 '수량' 열을 두고 2 이상을 적은 기자재(예: 학생용 노트북 30)는 1번부터 번호별로 따로 예약된다
 *   보유 시약 시트: 1행에 'CAS번호'가 있는 시트. 쓰는 열: 이름, CAS번호, 화학식, 분류, 보관위치 (없는 열은 비워 둠)
 *   안전점검 시트: '안전점검기록' (없으면 첫 기록 때 자동으로 만든다)
 *
 * 오래된 예약 기록 정리: 하루 한 번, 첫 예약·반납·취소 요청 때 KEEP_DAYS보다 오래된 예약 행을 자동으로 지운다.
 *   바로 지우려면 편집기에서 cleanupReservations 를 선택해 [실행]
 */

// 스프레드시트의 [확장 프로그램 → Apps Script]에서 연 스크립트(원래 v2.1 방식)면 비워 둔다.
// 독립 스크립트로 옮길 때만 시트 ID를 적는다.
// v2.1에 있던 updateEquipments(인증 없이 기자재 목록 덮어쓰기)는 앱이 쓰지 않아 뺐다 — 목록은 '기자재목록' 시트에서 직접 고친다.
var SPREADSHEET_ID = '';
var TZ = 'Asia/Seoul';
var KEEP_DAYS = 365;
var INSPECTION_SHEET = '안전점검기록';
var RATINGS = ['○', '△', '×'];

function ss_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  var type = e && e.parameter && e.parameter.type;
  if (type === 'chemicals') return json_({ status: 'success', data: { chemicals: readChemicals_() } });
  if (type === 'inspections') return json_({ status: 'success', data: { inspections: readInspections_() } });
  if (type === 'equipments') return json_({ status: 'success', data: readEquipments_() });

  var sheet = findReservationSheet_();
  var reservations = readRows_(sheet).map(function (r) {
    return {
      'ID': r['ID'],
      '신청자명': maskName_(r['신청자명']),
      '날짜': formatDate_(r['날짜']),
      '시간대': r['시간대'],
      '기자재': r['기자재'],
      '번호': r['번호'] ? String(r['번호']) : '',
      '상태': r['상태'],
      '신청일시': formatDateTime_(r['신청일시']),
      '반납일시': formatDateTime_(r['반납일시'])
    };
  });
  var equipment = readEquipments_();
  return json_({ status: 'success', data: { reservations: reservations, equipments: equipment.names, equipmentUnits: equipment.units } });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ status: 'error', message: '요청 형식이 올바르지 않습니다.' });
  }

  // Checked before the lock, so a wrong-PIN delay never holds up bookings.
  if (body.action === 'inspection') {
    var denied = checkPin_(body.pin);
    if (denied) return json_(denied);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    try {
      cleanupDaily_();
    } catch (err) {
      Logger.log('예약 정리 실패: ' + err); // housekeeping never blocks a booking
    }
    if (body.action === 'book') return json_(book_(body));
    if (body.action === 'return') return json_(returnItem_(body));
    if (body.action === 'cancel') return json_(cancel_(body));
    if (body.action === 'inspection') return json_(inspection_(body));
    return json_({ status: 'error', message: '알 수 없는 요청입니다.' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 예약 ---------- */

function book_(body) {
  var name = String(body.studentName || '').trim();
  var studentId = String(body.studentId || '').trim();
  var date = String(body.date || '').trim();
  var time = String(body.time || '').trim();
  var equipment = String(body.equipment || '').trim();
  if (!name || !studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !time || !equipment) {
    return { status: 'error', message: '모든 항목을 입력해 주세요.' };
  }
  if (date < today_()) return { status: 'error', message: '지난 날짜는 예약할 수 없습니다.' };

  // Equipment with a 수량 of 2+ (e.g. 30 laptops) is booked per numbered unit; conflicts are per unit.
  var total = readEquipments_().units[equipment] || 0;
  var unit = '';
  if (total > 1) {
    var n = parseInt(body.unit, 10);
    if (!(n >= 1 && n <= total)) return { status: 'error', message: equipment + ' 번호(1~' + total + ')를 골라 주세요.' };
    unit = String(n);
  }

  var sheet = findReservationSheet_();
  var slots = time.split(', ');
  var taken = [];
  readRows_(sheet).forEach(function (r) {
    if (r['상태'] !== '예약완료' || r['기자재'] !== equipment || formatDate_(r['날짜']) !== date) return;
    if (unit && String(r['번호'] || '') !== unit) return;
    String(r['시간대']).split(', ').forEach(function (s) {
      if (slots.indexOf(s) !== -1 && taken.indexOf(s) === -1) taken.push(s);
    });
  });
  if (taken.length) {
    return { status: 'error', message: (unit ? unit + '번은 ' : '') + '이미 예약된 시간대입니다: ' + taken.join(', ') };
  }

  var id = 'R' + new Date().getTime();
  appendByHeader_(sheet, {
    'ID': id,
    '신청자명': name,
    '학번': studentId,
    '날짜': date,
    '시간대': time,
    '기자재': equipment,
    '번호': unit,
    '상태': '예약완료',
    '신청일시': Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
    '반납일시': ''
  });
  return { status: 'success', id: id };
}

function returnItem_(body) {
  var found = findOwnedReservation_(body);
  if (found.error) return found.error;
  found.sheet.getRange(found.row, found.headers.indexOf('상태') + 1).setValue('반납완료');
  found.sheet.getRange(found.row, found.headers.indexOf('반납일시') + 1).setValue(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
  return { status: 'success' };
}

function cancel_(body) {
  var found = findOwnedReservation_(body);
  if (found.error) return found.error;
  if (formatDate_(found.record['날짜']) < today_()) return { status: 'error', message: '지난 예약은 취소할 수 없습니다. 반납으로 처리해 주세요.' };
  found.sheet.getRange(found.row, found.headers.indexOf('상태') + 1).setValue('예약취소');
  return { status: 'success' };
}

/** The reservation row for body.id, only if it is still active and body.studentId is its owner. */
function findOwnedReservation_(body) {
  var id = String(body.id || '');
  var studentId = String(body.studentId || '').trim();
  if (!id || !studentId) return { error: { status: 'error', message: '학번을 입력해 주세요.' } };

  var sheet = findReservationSheet_();
  var headers = headers_(sheet);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = toObject_(headers, data[i]);
    if (String(r['ID']) !== id) continue;
    if (r['상태'] !== '예약완료') return { error: { status: 'error', message: '이미 처리된 예약입니다.' } };
    // Rows made before 2026-09 kept the student ID inside '이름 (학번)'.
    var owner = String(r['학번'] || '').trim() || (String(r['신청자명']).match(/\((\d+)\)\s*$/) || [])[1];
    if (owner !== studentId) return { error: { status: 'error', message: '예약할 때 입력한 학번과 다릅니다.' } };
    return { sheet: sheet, headers: headers, row: i + 1, record: r };
  }
  return { error: { status: 'error', message: '예약을 찾을 수 없습니다.' } };
}

/** Runs cleanupReservations at most once a day, from inside doPost (under the lock, so row numbers stay put). */
function cleanupDaily_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LAST_CLEANUP') === today_()) return;
  cleanupReservations();
  props.setProperty('LAST_CLEANUP', today_());
}

/** Deletes reservation rows older than KEEP_DAYS. Runs daily via cleanupDaily_; can also be run by hand from the editor. */
function cleanupReservations() {
  var sheet = findReservationSheet_();
  var headers = headers_(sheet);
  var data = sheet.getDataRange().getValues();
  var cutoff = Utilities.formatDate(new Date(Date.now() - KEEP_DAYS * 86400000), TZ, 'yyyy-MM-dd');
  var removed = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    var date = formatDate_(toObject_(headers, data[i])['날짜']);
    if (date && date < cutoff) {
      sheet.deleteRow(i + 1);
      removed++;
    }
  }
  Logger.log(cutoff + ' 이전 예약 ' + removed + '건을 삭제했습니다.');
  return removed;
}

/* ---------- 보유 시약 ---------- */

function readChemicals_() {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getLastColumn() === 0 || sheet.getLastRow() < 2) continue;
    var headers = headers_(sheet);
    if (headers.indexOf('CAS번호') === -1 || headers.indexOf('신청자명') !== -1) continue;
    return readRows_(sheet)
      .map(function (r) {
        return {
          name: String(r['이름'] || '').trim(),
          cas: String(r['CAS번호'] || '').trim(),
          formula: String(r['화학식'] || '').trim(),
          category: String(r['분류'] || '').trim(),
          location: String(r['보관위치'] || '').trim()
        };
      })
      .filter(function (c) { return c.name && /^\d{2,7}-\d{2}-\d$/.test(c.cas); });
  }
  return [];
}

/* ---------- 월간 안전점검 (경기도교육청 서식1) ---------- */

/** Inspection records are official records: saving one needs the admin PIN (script property ADMIN_PIN). */
function checkPin_(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!expected) {
    return { status: 'error', message: "Apps Script [프로젝트 설정 → 스크립트 속성]에 ADMIN_PIN을 추가해야 점검 기록을 저장할 수 있습니다." };
  }
  if (String(pin || '') !== expected) {
    Utilities.sleep(1000); // slow down guessing
    return { status: 'error', message: '관리자 PIN이 맞지 않습니다.' };
  }
  return null;
}

function inspection_(body) {
  var month = String(body.month || '').trim();
  var lab = String(body.lab || '').trim().slice(0, 30);
  var inspector = String(body.inspector || '').trim().slice(0, 20);
  var note = String(body.note || '').trim().slice(0, 1000);
  var results = Array.isArray(body.results) ? body.results : [];
  if (!/^\d{4}-\d{2}$/.test(month) || !lab || !results.length) {
    return { status: 'error', message: '점검월, 실험실, 점검 결과를 입력해 주세요.' };
  }

  var values = { '기록일시': Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), '점검월': month, '실험실': lab, '점검자': inspector, '조치사항': note };
  var weak = 0;
  for (var i = 0; i < results.length; i++) {
    var no = String(results[i].no || '');
    var result = String(results[i].result || '');
    if (!/^\d{1,2}(-\d)?$/.test(no) || RATINGS.indexOf(result) === -1) continue;
    values['항목' + no] = result;
    if (result === '×') weak++;
  }
  values['미흡'] = weak;

  var sheet = ss_().getSheetByName(INSPECTION_SHEET) || ss_().insertSheet(INSPECTION_SHEET);
  var base = ['기록일시', '점검월', '실험실', '점검자'];
  var itemHeaders = Object.keys(values).filter(function (k) { return k.indexOf('항목') === 0; });
  ensureHeaders_(sheet, base.concat(itemHeaders, ['미흡', '조치사항']));
  appendByHeader_(sheet, values);
  return { status: 'success' };
}

function readInspections_() {
  var sheet = ss_().getSheetByName(INSPECTION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return readRows_(sheet).slice(-24).reverse().map(function (r) {
    return {
      recordedAt: formatDateTime_(r['기록일시']),
      month: String(r['점검월'] || ''),
      lab: String(r['실험실'] || ''),
      weak: Number(r['미흡']) || 0
    };
  });
}

/* ---------- helpers ---------- */

function findReservationSheet_() {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getLastColumn() === 0) continue;
    var headers = headers_(sheet);
    if (headers.indexOf('신청자명') === -1) continue;
    ensureHeaders_(sheet, ['학번', '반납일시', '번호']);
    return sheet;
  }
  throw new Error("1행에 '신청자명' 헤더가 있는 예약 시트를 찾지 못했습니다.");
}

/** { names: ['현미경', ...], units: { '학생용 노트북': 30 } } — units only for a 수량 of 2 or more. */
function readEquipments_() {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getLastRow() < 2) continue;
    var headers = headers_(sheet);
    if (headers[0].indexOf('기자재') !== 0 || headers.indexOf('신청자명') !== -1) continue;
    var qty = headers.indexOf('수량');
    var names = [];
    var units = {};
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().forEach(function (r) {
      var name = String(r[0]).trim();
      if (!name) return;
      names.push(name);
      var n = qty === -1 ? 0 : parseInt(r[qty], 10);
      if (n > 1) units[name] = n;
    });
    return { names: names, units: units };
  }
  return { names: [], units: {} };
}

/** Adds any of `wanted` missing from row 1, at the end, as text (so '24-1' never turns into a date). */
function ensureHeaders_(sheet, wanted) {
  var headers = sheet.getLastColumn() ? headers_(sheet) : [];
  wanted.forEach(function (h) {
    if (headers.indexOf(h) !== -1) return;
    sheet.getRange(1, headers.length + 1).setNumberFormat('@').setValue(h);
    headers.push(h);
  });
}

/** Appends one row, placing each value under its header. Stored as text so dates never shift by time zone. */
function appendByHeader_(sheet, values) {
  var headers = headers_(sheet);
  var row = headers.map(function (h) { return values.hasOwnProperty(h) ? values[h] : ''; });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setNumberFormat('@').setValues([row]);
}

function headers_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

function readRows_(sheet) {
  var headers = headers_(sheet);
  return sheet.getDataRange().getValues().slice(1)
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) { return toObject_(headers, row); });
}

function toObject_(headers, row) {
  var o = {};
  headers.forEach(function (h, i) { o[h] = row[i]; });
  return o;
}

function maskName_(value) {
  var name = String(value || '').replace(/\s*\(\d+\)\s*$/, '').trim(); // drop '(학번)' from old rows
  if (name.length <= 1) return name ? '*' : '';
  if (name.length === 2) return name[0] + '*';
  return name[0] + new Array(name.length - 1).join('*') + name[name.length - 1];
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function formatDate_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '');
}

function formatDateTime_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v || '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
