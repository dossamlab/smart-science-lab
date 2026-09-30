import { useState } from 'react';
import { AlertTriangle, Phone, Flame, Skull, HeartPulse, X } from 'lucide-react';
import { useAppConfig } from '../context/AppConfigContext';

export default function SosButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('fire');
  const { config } = useAppConfig();

  const sn = config.schoolName || '학교';
  const notConfigured = !config.schoolPhone && !config.adminPhone && !config.safetyManagerPhone;

  const buildContacts = (list) => list.filter(c => c && c.number?.trim());

  const sosData = {
    fire: {
      title: '화재/폭발',
      icon: <Flame className="w-5 h-5 text-red-500" />,
      flow: [
        '1. "불이야!" 크게 외쳐 주변에 알림',
        '2. 소화기/소화전으로 초기 진화 시도 (위험 시 대피 우선)',
        '3. 젖은 수건으로 코/입을 막고 낮은 자세로 계단 대피',
        '4. 119 및 학교 행정실 즉시 신고',
      ],
      contacts: buildContacts([
        { name: '119 긴급 신고', number: '119' },
        config.adminPhone ? { name: `${sn} 행정실`, number: config.adminPhone } : null,
        config.safetyManagerPhone ? { name: `안전 책임자${config.safetyManagerName ? ` (${config.safetyManagerName})` : ''}`, number: config.safetyManagerPhone } : null,
      ]),
    },
    chemical: {
      title: '화학물질 누출',
      icon: <Skull className="w-5 h-5 text-purple-500" />,
      flow: [
        '1. 즉시 환기 및 실험실 밖으로 신속 대피 (바람 등지고 이동)',
        '2. 신체 접촉 시 흐르는 물로 15분 이상 세척',
        '3. 화학사고 발생 시 15분 이내 관계 기관 신고 필수',
        '4. MSDS를 지참하여 신속히 병원 이송',
      ],
      contacts: buildContacts([
        { name: '한강유역환경청 (화학)', number: '031-790-2590' },
        { name: '화학재난합동방재센터', number: '031-470-2412' },
        config.safetyCoordinatorPhone ? { name: `안전 담당자${config.safetyCoordinatorName ? ` (${config.safetyCoordinatorName})` : ''}`, number: config.safetyCoordinatorPhone } : null,
      ]),
    },
    medical: {
      title: '응급 환자',
      icon: <HeartPulse className="w-5 h-5 text-pink-500" />,
      flow: [
        '1. 환자 의식 확인 및 주변 위험 요소 제거',
        '2. 보건실 및 119 연락 요청 (주변 사람 지정)',
        '3. 호흡 정지 시 즉시 CPR 및 AED 사용',
        '4. 구급대 도착 시까지 환자 곁을 지키며 상태 체크',
      ],
      contacts: buildContacts([
        { name: '응급 신고 (119)', number: '119' },
        config.schoolPhone ? { name: `${sn} (대표)`, number: config.schoolPhone } : null,
        config.nearbyHospitalPhone ? { name: `인근 병원${config.nearbyHospitalName ? ` (${config.nearbyHospitalName})` : ''}`, number: config.nearbyHospitalPhone } : null,
      ]),
    },
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50bg-red-600 text-white w-16 h-16 rounded-full flex flex-col items-center justify-center shadow-2xl hover:bg-red-700 hover:scale-110 active:scale-95 transition-all duration-300 animate-bounce group"
      >
        <AlertTriangle className="w-8 h-8 mb-0.5 group-hover:animate-pulse" />
        <span className="text-[10px] font-black">SOS</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">긴급 비상 연락망</h2>
                  {notConfigured && (
                    <p className="text-red-200 text-xs font-bold">⚠ 관리자 설정에서 학교 연락처를 입력하세요</p>
                  )}
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-red-100 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                {Object.keys(sosData).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                      activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {sosData[key].icon}
                    <span>{sosData[key].title}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-gray-900 mb-3 flex items-center gap-2">
                    {sosData[activeTab].icon} 대처 흐름도
                  </h3>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                    <ul className="space-y-2">
                      {sosData[activeTab].flow.map((step, idx) => (
                        <li key={idx} className="text-orange-900 font-medium text-sm flex items-start">
                          <span className="mr-2">•</span>{step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-black text-gray-900 mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-500" /> 긴급 연락처 (터치 시 통화)
                  </h3>
                  <div className="space-y-3">
                    {sosData[activeTab].contacts.length === 0 ? (
                      <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-400 font-bold text-center">
                        관리자 설정에서 학교 연락처를 입력해 주세요.
                      </div>
                    ) : (
                      sosData[activeTab].contacts.map((contact, idx) => (
                        <a
                          key={idx}
                          href={`tel:${contact.number.replace(/-/g, '')}`}
                          className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors group"
                        >
                          <span className="font-bold text-gray-800 group-hover:text-red-700">{contact.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-mono text-sm">{contact.number}</span>
                            <div className="bg-red-100 text-red-600 p-1.5 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors">
                              <Phone className="w-4 h-4" />
                            </div>
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
