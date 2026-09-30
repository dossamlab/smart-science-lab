import { useState } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle,
  School, FileText, Link2, ArrowLeft, Info, QrCode, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppConfig } from '../context/AppConfigContext';
import PinGate from '../components/PinGate';

const TABS = [
  { id: 'school', label: '학교 기본 정보', icon: School },
  { id: 'guide',  label: '학교 안전 지침', icon: FileText },
  { id: 'link',   label: 'Google 연동',   icon: Link2 },
];

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 font-medium">{hint}</p>}
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

/* ─── Tab: 학교 안전 지침 ─── */
function TabGuide({ draft, set }) {
  return (
    <div className="space-y-5">
      <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-sm text-green-700 font-medium flex gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>과학실 안전사고 대응 지침 요약</strong>(사고 대응·약품·기구·화재·법규 5개 항목)은 이미 내장되어 있습니다.<br />
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
        Google Apps Script를 연동하면 기자재 예약, 보유 시약 목록, 안전점검 기록을 Google 스프레드시트로 관리합니다.
      </div>

      <Field
        label="Google Apps Script 배포 URL"
        hint="예약, 보유 시약 목록(1행에 'CAS번호' 열이 있는 시트), 안전점검 기록에 사용됩니다."
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
          '① 스프레드시트에서 [확장 프로그램 → Apps Script]를 열고 저장소의 apps-script/Code.gs 내용을 붙여넣기',
          '② 코드를 고친 경우: 배포 → 배포 관리 → 기존 배포 수정(연필) → 버전: 새 버전 → 배포 (URL 유지)',
          '③ 처음 만드는 경우: 배포 → 새 배포 → 웹 앱 → 실행: 나, 액세스: 모든 사용자 → 생성된 URL을 위 칸에 입력',
          '④ 스프레드시트 공유는 "제한됨"으로 두세요. 웹 앱은 소유자 권한으로 실행되므로 공개할 필요가 없습니다.',
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
    <PinGate>
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
          <p className="text-gray-500 font-medium text-sm mt-0.5">학교명, 비상연락처, 지침, Google 연동을 설정합니다.</p>
        </div>
      </div>

      {/* 관리 도구 */}
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        <Link to="/labels" className="flex items-center gap-3 h-16 px-5 rounded-2xl bg-white border border-gray-100 shadow-sm font-black text-gray-800 hover:border-brand-300">
          <QrCode className="w-6 h-6 text-brand-600" aria-hidden="true" /> 시약병 QR 라벨 인쇄
        </Link>
        <Link to="/inspection" className="flex items-center gap-3 h-16 px-5 rounded-2xl bg-white border border-gray-100 shadow-sm font-black text-gray-800 hover:border-brand-300">
          <ClipboardCheck className="w-6 h-6 text-brand-600" aria-hidden="true" /> 월간 안전점검 기록
        </Link>
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
              <span className="sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
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
    </PinGate>
  );
}
