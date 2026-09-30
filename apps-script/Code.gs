/**
 * Lab-ON 기자재 예약 API (Google Apps Script 웹 앱)
 *
 * 붙여넣기 → 배포 → 배포 관리 → 기존 배포 수정(연필) → 버전: 새 버전 → 배포
 * (새 배포를 만들면 URL이 바뀌므로 반드시 '기존 배포 수정'으로 올린다)
 *
 * 개인정보: 조회(GET) 응답에는 이름을 가려서(홍*동) 내보내고 학번은 내보내지 않는다.
 * 학번은 반납 본인 확인에만 쓴다.
 *
 * 시트는 이름이 아니라 1행 헤더로 찾는다.
 *   예약 시트: 1행에 '신청자명'이 있는 시트 (없던 '학번' 열은 자동으로 추가)
 *   기자재 시트: 1행 A열이 '기자재'로 시작하는 다른 시트의 A열 목록 (없으면 앱 기본 목록 사용)
 */

// 기존 스크립트 상단에 있던 시트 ID를 그대로 옮겨 적는다. 시트에 붙은 스크립트라면 비워 둬도 된다.
var SPREADSHEET_ID = '';
var TZ = 'Asia/Seoul';

function ss_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  var sheet = findReservationSheet_();
  var rows = readRows_(sheet);
  var reservations = rows.map(function (r) {
    return {
      'ID': r['ID'],
      '신청자명': maskName_(r['신청자명']),
      '날짜': formatDate_(r['날짜']),
      '시간대': r['시간대'],
      '기자재': r['기자재'],
      '상태': r['상태'],
      '신청일시': formatDateTime_(r['신청일시']),
      '반납일시': formatDateTime_(r['반납일시'])
    };
  });
  return json_({ status: 'success', data: { reservations: reservations, equipments: readEquipments_() } });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ status: 'error', message: '요청 형식이 올바르지 않습니다.' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === 'book') return json_(book_(body));
    if (body.action === 'return') return json_(returnItem_(body));
    return json_({ status: 'error', message: '알 수 없는 요청입니다.' });
  } finally {
    lock.releaseLock();
  }
}

function book_(body) {
  var name = String(body.studentName || '').trim();
  var studentId = String(body.studentId || '').trim();
  var date = String(body.date || '').trim();
  var time = String(body.time || '').trim();
  var equipment = String(body.equipment || '').trim();
  if (!name || !studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !time || !equipment) {
    return { status: 'error', message: '모든 항목을 입력해 주세요.' };
  }

  var sheet = findReservationSheet_();
  var slots = time.split(', ');
  var taken = [];
  readRows_(sheet).forEach(function (r) {
    if (r['상태'] !== '예약완료' || r['기자재'] !== equipment || formatDate_(r['날짜']) !== date) return;
    String(r['시간대']).split(', ').forEach(function (s) {
      if (slots.indexOf(s) !== -1 && taken.indexOf(s) === -1) taken.push(s);
    });
  });
  if (taken.length) return { status: 'error', message: '이미 예약된 시간대입니다: ' + taken.join(', ') };

  var id = 'R' + new Date().getTime();
  var values = {
    'ID': id,
    '신청자명': name,
    '학번': studentId,
    '날짜': date,
    '시간대': time,
    '기자재': equipment,
    '상태': '예약완료',
    '신청일시': Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
    '반납일시': ''
  };
  var headers = headers_(sheet);
  var row = headers.map(function (h) { return values.hasOwnProperty(h) ? values[h] : ''; });
  var rowIndex = sheet.getLastRow() + 1;
  // Store the date as text so it is never shifted by time zones.
  sheet.getRange(rowIndex, 1, 1, headers.length).setNumberFormat('@').setValues([row]);
  return { status: 'success', id: id };
}

function returnItem_(body) {
  var id = String(body.id || '');
  var studentId = String(body.studentId || '').trim();
  if (!id || !studentId) return { status: 'error', message: '학번을 입력해 주세요.' };

  var sheet = findReservationSheet_();
  var headers = headers_(sheet);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = toObject_(headers, data[i]);
    if (String(r['ID']) !== id) continue;
    if (r['상태'] !== '예약완료') return { status: 'error', message: '이미 반납된 예약입니다.' };
    // Rows made before this version kept the student ID inside '이름 (학번)'.
    var owner = String(r['학번'] || '').trim() || (String(r['신청자명']).match(/\((\d+)\)\s*$/) || [])[1];
    if (owner !== studentId) return { status: 'error', message: '예약할 때 입력한 학번과 다릅니다.' };
    sheet.getRange(i + 1, headers.indexOf('상태') + 1).setValue('반납완료');
    sheet.getRange(i + 1, headers.indexOf('반납일시') + 1).setValue(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
    return { status: 'success' };
  }
  return { status: 'error', message: '예약을 찾을 수 없습니다.' };
}

/* ---------- helpers ---------- */

function findReservationSheet_() {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getLastColumn() === 0) continue;
    var headers = headers_(sheet);
    if (headers.indexOf('신청자명') === -1) continue;
    ['학번', '반납일시'].forEach(function (h) {
      if (headers.indexOf(h) === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
    });
    return sheet;
  }
  throw new Error("1행에 '신청자명' 헤더가 있는 예약 시트를 찾지 못했습니다.");
}

function readEquipments_() {
  var sheets = ss_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getLastRow() < 2) continue;
    var first = String(sheet.getRange(1, 1).getValue());
    if (first.indexOf('기자재') !== 0 || headers_(sheet).indexOf('신청자명') !== -1) continue;
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
      .map(function (r) { return String(r[0]).trim(); })
      .filter(function (v) { return v; });
  }
  return [];
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

function formatDate_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '');
}

function formatDateTime_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v || '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
