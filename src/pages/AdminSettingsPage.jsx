import { useState } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, Eye, EyeOff,
  School, KeyRound, FileText, Link2, ChevronRight, ArrowLeft, Info, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppConfig } from '../context/AppConfigContext';

const TABS = [
  { id: 'school', label: '학교 기본 정보', icon: School },
  { id: 'api',    label: 'API 키 설정',   icon: KeyRound },
  { id: 'guide',  label: '학교 안전 지침', icon: FileText },
  { id: 'link',   label: 'Google 연동',   icon: Link2 },
];

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 font-medium">{hint}</p>}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent
        focus:border-brand-400 focus:bg-white focus:outline-none font-semibold text-gray-800
        placeholder:text-gray-300 transition-all"
    />
  );
}

function Textarea({ ...props }) {
  return (
    <textarea
      {...props}
      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent
        focus:border-brand-400 focus:bg-white focus:outline-none font-medium text-gray-800
        placeholder:text-gray-300 transition-all resize-none leading-relaxed"
    />
  );
}

/* ─── Tab: 학교 기본 정보 ─── */
function TabSchool({ draft, set }) {
  return (
    <div className="space-y-5">
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 text-sm text-brand-700 font-medium flex gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        여기서 입력한 학교명과 연락처는 헤더, SOS 비상연락망, AI 비서에 자동 반영됩니다.
      </div>

      <Field label="학교명" hint="예: 청학고등학교">
        <Input
          value={draft.schoolName}
          onChange={e => set('schoolName', e.target.value)}
          placeholder="○○고등학교"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="학교 대표전화" hint="SOS 의료 탭에 표시">
          <Input
            value={draft.schoolPhone}
            onChange={e => set('schoolPhone', e.target.value)}
            placeholder="031-000-0000"
          />
        </Field>
        <Field label="행정실 전화" hint="SOS 화재 탭에 표시">
          <Input
            value={draft.adminPhone}
            onChange={e => set('adminPhone', e.target.value)}
            placeholder="031-000-0001"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="안전 책임자 성명">
          <Input
            value={draft.safetyManagerName}
            onChange={e => set('safetyManagerName', e.target.value)}
            placeholder="홍길동"
          />
        </Field>
        <Field label="안전 책임자 연락처" hint="SOS 화재 탭에 표시">
          <Input
            value={draft.safetyManagerPhone}
            onChange={e => set('safetyManagerPhone', e.target.value)}
            placeholder="010-0000-0000"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="안전 담당자 성명">
          <Input
            value={draft.safetyCoordinatorName}
            onChange={e => set('safetyCoordinatorName', e.target.value)}
            placeholder="김철수"
          />
        </Field>
        <Field label="안전 담당자 연락처" hint="SOS 화학 탭에 표시">
          <Input
            value={draft.safetyCoordinatorPhone}
            onChange={e => set('safetyCoordinatorPhone', e.target.value)}
            placeholder="010-0000-0001"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="인근 병원명">
          <Input
            value={draft.nearbyHospitalName}
            onChange={e => set('nearbyHospitalName', e.target.value)}
            placeholder="○○의원"
          />
        </Field>
        <Field label="인근 병원 전화" hint="SOS 의료 탭에 표시">
          <Input
            value={draft.nearbyHospitalPhone}
            onChange={e => set('nearbyHospitalPhone', e.target.value)}
            placeholder="031-000-0002"
          />
        </Field>
      </div>
    </div>
  );
}

/* ─── Tab: API 키 설정 ─── */
function TabApi({ draft, set }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-700 font-medium flex gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        API 키는 이 기기의 브라우저(localStorage)에만 저장됩니다. 외부로 전송되지 않습니다.
      </div>

      <Field
        label="Google Gemini API 키"
        hint="AI 비서 기능에 사용됩니다. 키 미입력 시 로컬 키워드 검색 모드로 작동합니다."
      >
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={draft.geminiApiKey}
            onChange={e => set('geminiApiKey', e.target.value)}
            placeholder="AIza..."
            className="w-full pl-4 pr-12 py-3 rounded-xl bg-gray-50 border-2 border-transparent
              focus:border-brand-400 focus:bg-white focus:outline-none font-mono text-sm text-gray-800
              placeholder:text-gray-300 transition-all"
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </Field>

      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-brand-200
          hover:border-brand-400 hover:bg-brand-50 transition-all group"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 group-hover:bg-brand-200 transition-colors">
          <ExternalLink className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <p className="font-black text-gray-800 text-sm">Google AI Studio에서 API 키 발급</p>
          <p className="text-xs text-gray-500 font-medium">aistudio.google.com/apikey → Create API key</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 ml-auto group-hover:text-brand-600 transition-colors" />
      </a>

      <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">발급 방법</p>
        {[
          '① Google AI Studio (aistudio.google.com) 접속 후 Google 계정 로그인',
          '② 좌측 메뉴 또는 상단의 "Get API key" 클릭',
          '③ "Create API key" 버튼 클릭 → 프로젝트 선택',
          '④ 생성된 키를 복사하여 위 입력창에 붙여넣기',
        ].map((step, i) => (
          <p key={i} className="text-sm text-gray-600 font-medium">{step}</p>
        ))}
      </div>
    </div>
  );
}

/* ─── Tab: 학교 안전 지침 ─── */
function TabGuide({ draft, set }) {
  return (
    <div className="space-y-5">
      <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-sm text-green-700 font-medium flex gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>경기도교육청 2026 과학실 안전관리 지침</strong>은 이미 내장되어 있습니다.<br />
          아래에는 <strong>우리 학교만의 추가 지침</strong>만 입력하세요. (비상연락망, 실험실 현황 등)
        </span>
      </div>

      <Field
        label="학교별 추가 안전 지침"
        hint="여기서 입력한 내용은 AI 비서의 답변 기반 데이터로 사용됩니다."
      >
        <Textarea
          rows={14}
          value={draft.schoolGuidelines}
          onChange={e => set('schoolGuidelines', e.target.value)}
          placeholder={`예시:\n\n[비상연락망]\n- 학교 대표: 031-000-0000\n- 행정실: 031-000-0001\n- 안전 책임자 (홍길동): 010-0000-0000\n\n[실험실 현황]\n- 물리/지학실: 3층 301호\n- 화학실: 3층 302호\n- 생명과학실: 3층 303호\n\n[특이 사항]\n- 소화기 위치: 각 실험실 입구 오른쪽\n- AED 위치: 1층 행정실 앞`}
        />
      </Field>
    </div>
  );
}

/* ─── Tab: Google 연동 ─── */
function TabLink({ draft, set }) {
  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 font-medium flex gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Google 스프레드시트와 Apps Script를 연동하면 기자재 예약 및 MSDS 데이터를 관리할 수 있습니다.
      </div>

      <Field
        label="Google 스프레드시트 Sheet ID"
        hint="스프레드시트 URL에서 /d/ 와 /edit 사이의 문자열을 입력하세요."
      >
        <Input
          value={draft.spreadsheetId}
          onChange={e => set('spreadsheetId', e.target.value)}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
        />
      </Field>
      <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 font-mono">
        https://docs.google.com/spreadsheets/d/<span className="text-brand-600 font-bold">여기가 Sheet ID</span>/edit
      </p>

      <Field
        label="Google Apps Script 배포 URL"
        hint="예약 신청 저장 및 기자재 목록 관리에 사용됩니다."
      >
        <Input
          value={draft.gasUrl}
          onChange={e => set('gasUrl', e.target.value)}
          placeholder="https://script.google.com/macros/s/..."
        />
      </Field>

      <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Apps Script 연동 방법</p>
        {[
          '① 제공된 Apps Script 파일(GAS)을 본인 Google 계정으로 복사',
          '② 스크립트 상단의 SPREADSHEET_ID를 본인 시트 ID로 변경',
          '③ 배포 → 새 배포 → 웹 앱 → 액세스: 모든 사용자 → 배포',
          '④ 생성된 배포 URL을 위 입력창에 붙여넣기',
        ].map((step, i) => (
          <p key={i} className="text-sm text-gray-600 font-medium">{step}</p>
        ))}
      </div>
    </div>
  );
}

/* ─── 메인 컴포넌트 ─── */
export default function AdminSettingsPage() {
  const { config, updateConfig } = useAppConfig();
  const [activeTab, setActiveTab] = useState('school');
  const [draft, setDraft] = useState({ ...config });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!draft.schoolName?.trim()) {
      setError('학교명을 입력해 주세요.');
      setActiveTab('school');
      return;
    }
    updateConfig({ ...draft, isConfigured: true });
    setSaved(true);
    setError('');
    setTimeout(() => setSaved(false), 3000);
  };

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500 pb-24 px-4">
      {/* 뒤로가기 */}
      <Link to="/" className="inline-flex items-center gap-2 text-brand-600 font-bold mb-8 hover:text-brand-800 transition-colors">
        <ArrowLeft className="w-5 h-5" /> 메인으로 돌아가기
      </Link>

      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-200">
          <Settings className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900">관리자 설정</h1>
          <p className="text-gray-500 font-medium text-sm mt-0.5">학교명, API 키, 지침, Google 연동을 설정합니다.</p>
        </div>
      </div>

      {/* 탭 내비게이션 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-8">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                active ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-[10px]">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8">
        <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
          {currentTab && <currentTab.icon className="w-6 h-6 text-brand-600" />}
          {currentTab?.label}
        </h2>

        {activeTab === 'school' && <TabSchool draft={draft} set={set} />}
        {activeTab === 'api'    && <TabApi    draft={draft} set={set} />}
        {activeTab === 'guide'  && <TabGuide  draft={draft} set={set} />}
        {activeTab === 'link'   && <TabLink   draft={draft} set={set} />}
      </div>

      {/* 피드백 메시지 */}
      {saved && (
        <div className="mt-4 p-4 rounded-2xl bg-green-50 text-green-700 border border-green-100 flex items-center gap-3 font-bold">
          <CheckCircle2 className="w-5 h-5" /> 설정이 저장되었습니다. 모든 페이지에 즉시 반영됩니다.
        </div>
      )}
      {error && (
        <div className="mt-4 p-4 rounded-2xl bg-red-50 text-red-700 border border-red-100 flex items-center gap-3 font-bold">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          className="px-10 py-4 rounded-[2rem] bg-brand-600 text-white font-black text-lg
            hover:bg-brand-700 transition-all shadow-xl shadow-brand-200/50 flex items-center gap-3"
        >
          <Save className="w-5 h-5" /> 설정 저장하기
        </button>
      </div>
    </div>
  );
}
