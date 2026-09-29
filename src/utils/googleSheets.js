/**
 * Google Sheets API를 대신하여 공개된 스프레드시트 데이터를 가져오는 유틸리티
 * Zero-Budget을 위해 별도의 API Key 없이 'JSON 시각화 엔드포인트'를 활용합니다.
 */

export async function fetchSpreadsheetData(sheetId, gid = '0') {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
    const response = await fetch(url);
    const text = await response.text();
    
    // Google Visualization API의 응답 형식(구조화된 JSON)에서 순수 데이터 추출
    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
    if (!jsonStr || !jsonStr[1]) throw new Error('데이터 형식이 올바르지 않습니다.');
    
    const obj = JSON.parse(jsonStr[1]);
    const table = obj.table;
    const rows = table.rows;
    
    // 컬럼 헤더 추출 (첫 번째 행이 헤더인 경우)
    const headers = table.cols.map(col => col.label || '');
    
    // 데이터를 객체 배열로 변환
    const data = rows.map(row => {
      const item = {};
      row.c.forEach((cell, i) => {
        const header = headers[i] || `col_${i}`;
        item[header] = cell ? (cell.v || '') : '';
      });
      return item;
    });
    
    return data;
  } catch (error) {
    console.error('Google Sheets Fetch Error:', error);
    throw error;
  }
}
