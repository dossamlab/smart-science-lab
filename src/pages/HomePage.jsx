import { Link } from 'react-router-dom';
import { ShieldAlert, Beaker, CalendarClock, ArrowRight, Settings, AlertCircle } from 'lucide-react';
import AIAssistant from '../components/AIAssistant';
import { useAppConfig } from '../context/AppConfigContext';

export default function HomePage() {
  const { config } = useAppConfig();
  const schoolName = config.schoolName?.trim();
  const isConfigured = config.isConfigured;

  const menus = [
    {
      title: '안전 대처방안',
      description: '실험실 사고 발생 시 대처 매뉴얼 및 안전지침 검색',
      icon: <ShieldAlert className="w-10 h-10 text-brand-600" />,
      path: '/safety',
      color: 'bg-brand-50 hover:bg-brand-100',
    },
    {
      title: 'MSDS 조회',
      description: '실험실 화학물질 안전보건자료 위험성 및 폐기 방법 검색',
      icon: <Beaker className="w-10 h-10 text-indigo-600" />,
      path: '/msds',
      color: 'bg-indigo-50 hover:bg-indigo-100',
    },
    {
      title: '기자재 예약',
      description: 'MBL 센서, 현미경 등 스마트 과학실 실험 기자재 대여 신청',
      icon: <CalendarClock className="w-10 h-10 text-emerald-600" />,
      path: '/reservation',
      color: 'bg-emerald-50 hover:bg-emerald-100',
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto px-4 py-8">

      {/* 최초 설정 안내 배너 */}
      {!isConfigured && (
        <Link
          to="/admin/settings"
          className="flex items-center gap-3 mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl
            hover:bg-amber-100 transition-colors group"
        >
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm font-bold text-amber-700 flex-grow">
            아직 학교 정보가 설정되지 않았습니다. 클릭하여 관리자 설정을 완료해 주세요.
          </span>
          <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      <div className="grid lg:grid-cols-12 gap-10 items-start">
        {/* 좌측 메뉴 영역 */}
        <div className="lg:col-span-8 flex flex-col justify-center min-h-[80vh] lg:min-h-[650px]">
          <div className="text-left mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 tracking-tight mb-6">
              {schoolName
                ? <>{schoolName} <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Lab-ON</span></>
                : <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Lab-ON</span>
              }
            </h1>
            <p className="text-lg md:text-xl text-gray-500 font-medium max-w-2xl">
              학생과 교사의 안전하고 효율적인 과학실 이용을 위한 통합 플랫폼입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 w-full">
            {menus.map((menu, idx) => (
              <Link
                key={idx}
                to={menu.path}
                className={`group relative overflow-hidden rounded-3xl p-8 transition-all duration-300
                  hover:shadow-xl hover:-translate-y-1 bg-white border border-gray-100 shadow-sm
                  ${idx === 2 ? 'md:col-span-2 lg:col-span-1' : ''}`}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${menu.color} -z-10`} />
                <div className="bg-gray-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  {menu.icon}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">{menu.title}</h2>
                <p className="text-gray-500 leading-relaxed font-medium mb-8">{menu.description}</p>
                <div className="flex items-center text-sm font-bold text-gray-900 mt-auto">
                  바로가기
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>

          {/* 관리자 설정 버튼 */}
          <div className="mt-8 flex justify-start">
            <Link
              to="/admin/settings"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200
                text-gray-500 text-sm font-bold hover:border-brand-300 hover:text-brand-600
                hover:bg-brand-50 transition-all"
            >
              <Settings className="w-4 h-4" />
              관리자 설정
            </Link>
          </div>
        </div>

        {/* 우측 AI 비서 영역 */}
        <div className="lg:col-span-4 w-full">
          <AIAssistant />
        </div>
      </div>
    </div>
  );
}
