# 청학고 Lab-ON

과학실 안전 대처방안, MSDS 조회, 기자재 예약, 월간 안전점검을 한곳에서 하는 웹앱. 주 사용 환경은 학생 휴대폰과 실험실 태블릿이다.

- 배포: https://chlabon.netlify.app (Netlify, `main`에 push하면 자동 배포)
- 저장소: `dossamlab/smart-science-lab` (비공개)

## 구성

| 부분 | 위치 | 설명 |
|---|---|---|
| 화면 | `src/` | Vite + React. 휴대폰은 하단 탭 바, 태블릿·PC는 상단 메뉴 |
| MSDS 조회 | `netlify/functions/msds.mjs` | 안전보건공단(KOSHA) MSDS Open API 프록시. 결과를 Netlify CDN에 30일 캐시 |
| AI 비서 | `netlify/functions/ai.mjs` | Gemini 3.8 → 3.7 → 3.6 → 3.5 Flash 순서로 호출, 넘어갈 때마다 원인을 화면에 안내. 전화·주민번호는 가려서 보낸다 |
| 관리자 PIN | `netlify/functions/admin.mjs` | 관리자 설정·안전점검 화면 잠금 |
| 예약·보유 시약·안전점검 | `apps-script/Code.gs` | 스프레드시트에 붙은 Apps Script 웹 앱 |
| 오프라인 | `public/sw.js` | 와이파이가 끊겨도 SOS·안전 지침·이미 본 MSDS가 열린다 |

## 환경변수 (Netlify → Project configuration → Environment variables)

| 이름 | 공개 여부 | 용도 |
|---|---|---|
| `VITE_SCHOOL_NAME`, `VITE_ADMIN_PHONE`, `VITE_HOSPITAL_NAME`, `VITE_HOSPITAL_PHONE`, `VITE_SCHOOL_PHONE` | 공개(번들에 들어감) | 모든 기기의 기본 학교 정보·SOS 번호. **개인 휴대폰 번호 금지** |
| `VITE_RESERVATION_API_URL` | 공개 | Apps Script 웹 앱 URL |
| `KOSHA_API_KEY` | 비밀(Contains secret values) | data.go.kr 「한국산업안전보건공단_물질안전보건자료 조회 서비스」 Decoding 키 |
| `GEMINI_API_KEY` | 비밀 | Google AI Studio 키. **결제가 연결되지 않은 프로젝트의 키**를 쓰면 무료 한도 안에서만 동작한다 |
| `ADMIN_PIN` | 비밀 | 관리자 화면 PIN (6자리 이상 권장) |

`VITE_`로 시작하는 값은 누구나 볼 수 있다. 키와 PIN은 절대 `VITE_`로 만들지 않는다. 환경변수를 바꾼 뒤에는 Deploys → Trigger deploy로 다시 배포해야 반영된다.

## 개발

```bash
npm install
npm run dev     # http://localhost:5173, /api/* 함수도 함께 동작 (.env의 KOSHA_API_KEY 등을 사용)
npm test        # 함수·Apps Script·검색 로직 검사 (node --test)
npm run lint
npm run build
```

로컬 `.env`는 git에 올라가지 않는다. 서버 키는 `VITE_` 없이 적는다(`KOSHA_API_KEY=...`).

## Apps Script 배포 (예약·보유 시약·안전점검)

1. 스프레드시트 → 확장 프로그램 → Apps Script → `Code.gs`에 `apps-script/Code.gs` 내용을 붙여넣고 저장
2. 배포 → 배포 관리 → 기존 배포 수정(연필) → 버전: 새 버전 → 배포 (URL이 바뀌지 않는다)
3. 스프레드시트 공유는 **제한됨**으로 둔다. 웹 앱은 소유자 권한으로 실행되므로 공개할 필요가 없고, 공개하면 예약 시트의 학생 이름·학번이 그대로 노출된다
4. 오래된 예약 기록 정리: 편집기에서 `cleanupReservations` 선택 후 실행 (`KEEP_DAYS`일보다 오래된 행 삭제)

시트는 1행 헤더로 찾는다.
- 예약: `신청자명` 열이 있는 시트 (`학번`·`반납일시` 열은 자동 추가)
- 기자재: A1이 `기자재`로 시작하는 시트의 A열
- 보유 시약: `CAS번호` 열이 있는 시트. 쓰는 열은 `이름`, `CAS번호`, `화학식`, `분류`, `보관위치`. 여기 추가한 시약은 MSDS 목록과 QR 라벨에 바로 나온다
- 안전점검: `안전점검기록` 시트 (첫 저장 때 자동 생성)

## 데이터 갱신

- 학교 시약 기본 목록: `src/data/casListData.js`. 추가할 때는 KOSHA에서 CAS로 조회되는지 확인한다(`npm test`가 CAS 검사 숫자를 확인)
- 교과서 이름 ↔ KOSHA 이름: `src/utils/chemSearch.js`의 `ALIASES`
- 경기도교육청 안전관리 계획 검색: 새 PDF가 나오면 `extract_safety_text.py`로 `src/data/safetyManualData.json`을 만든 뒤 `node scripts/build-manual.mjs`
- 안전점검표 문항: `src/data/inspectionChecklist.js` (경기도교육청 계획 서식1)

## 개인정보 원칙

- 예약 조회 응답에는 이름을 가려서(홍*동) 내보내고 학번은 내보내지 않는다. 학번은 반납·취소 본인 확인에만 쓴다
- AI에 보내는 질문과 학교 지침에서 전화번호·주민번호를 가린다. 질문 입력란에 개인정보 입력 금지 안내가 있다
- 학교 자체 안전관리 계획(`school_manual`)은 번들에 넣지 않는다
