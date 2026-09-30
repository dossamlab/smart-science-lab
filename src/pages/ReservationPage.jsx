import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Package, User, CheckCircle2, AlertCircle, Loader2, ChevronLeft, ChevronRight, Plus, RotateCcw, Hash } from 'lucide-react';
import { useAppConfig } from '../context/AppConfigContext';

const DEFAULT_EQUIPMENTS = [
  'MBL 센서 세트', '광학 현미경', '디지털 분광광도계', 
  '가열 교반기 (Hotplate)', '원심분리기', '전자 저울 (정밀)', 
  '데이터 로거', '천체 망원경', '3D 프린터', '드론 (교육용)'
];

const TIME_SLOTS = [
  '1교시 (09:00~09:50)', '2교시 (10:00~10:50)', '3교시 (11:00~11:50)',
  '4교시 (12:00~12:50)', '점심시간', '5교시 (13:50~14:40)',
  '6교시 (14:50~15:40)', '7교시 (15:50~16:40)', '방과후'
];

export default function ReservationPage() {
  const { config } = useAppConfig();
  const API_URL = config.gasUrl?.trim() || '';
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [manualEquipment, setManualEquipment] = useState('');
  const [selectedTimes, setSelectedTimes] = useState([]); // 체크박스 다중 선택
  const [applicantName, setApplicantName] = useState('');
  const [applicantId, setApplicantId] = useState('');
  const [returningId, setReturningId] = useState(null); // 반납 확인 중인 ID
  const [returnStudentId, setReturnStudentId] = useState('');
  const [returnError, setReturnError] = useState('');

  const [reservations, setReservations] = useState([]);
  const [equipmentList, setEquipmentList] = useState(DEFAULT_EQUIPMENTS);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 로컬 날짜 문자열 생성 (YYYY-MM-DD) - 타임존 문제 방지
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Code.gs answers JSON; the pre-2026-09 script's answer may not parse, which meant "sent".
  const post = async (payload) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    return res.json().catch(() => ({ status: 'success' }));
  };

  const normalizeDate = (value) =>
    typeof value === 'string' && value.includes('T') ? getLocalDateString(new Date(value)) : value;

  const fetchReservations = async () => {
    if (!API_URL) return;
    setLoading(true);
    try {
      const response = await fetch(API_URL);
      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        // 객체 형태(reservations)나 배열 형태 모두 대응
        const resData = result.data.reservations || (Array.isArray(result.data) ? result.data : []);
        // Sheets date cells arrive as UTC ISO (KST midnight = previous day 15:00Z); compare in local date.
        setReservations(resData.map(r => ({ ...r, '날짜': normalizeDate(r['날짜']) })));
        
        if (result.data.equipments?.length > 0) {
          setEquipmentList(result.data.equipments);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReservations(); }, []);

  const toggleTime = (slot) => {
    setSelectedTimes(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

  const handleReservation = async (e) => {
    e.preventDefault();
    const finalEquipment = selectedEquipment === 'manual' ? manualEquipment : selectedEquipment;

    if (!applicantName || !applicantId || !finalEquipment || selectedTimes.length === 0) {
      setMessage({ type: 'error', text: '모든 항목을 입력하고, 시간대를 하나 이상 선택해 주세요.' });
      return;
    }

    const dateStr = getLocalDateString(selectedDate);
    const taken = selectedTimes.filter(slot => reservations.some(r =>
      r['날짜'] === dateStr && r['기자재'] === finalEquipment && r['상태'] === '예약완료' &&
      String(r['시간대']).split(', ').includes(slot)
    ));
    if (taken.length > 0) {
      setMessage({ type: 'error', text: `이미 예약된 시간대입니다: ${taken.join(', ')}` });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const result = await post({
        action: 'book',
        name: `${applicantName} (${applicantId})`, // read by the pre-2026-09 script
        studentName: applicantName,
        studentId: applicantId,
        date: dateStr,
        time: selectedTimes.join(', '),
        equipment: finalEquipment
      });
      if (result.status !== 'success') {
        setMessage({ type: 'error', text: result.message || '예약하지 못했습니다.' });
        return;
      }
      setMessage({ type: 'success', text: '예약되었습니다.' });
      setApplicantName('');
      setApplicantId('');
      setSelectedEquipment('');
      setManualEquipment('');
      setSelectedTimes([]);
      fetchReservations();
    } catch {
      setMessage({ type: 'error', text: '연결 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (id) => {
    if (!returnStudentId.trim()) {
      setReturnError('예약할 때 입력한 학번을 입력하세요.');
      return;
    }
    setActionLoadingId(id);
    setReturnError('');
    try {
      const result = await post({ action: 'return', id, studentId: returnStudentId.trim() });
      if (result.status !== 'success') {
        setReturnError(result.message || '반납하지 못했습니다.');
        return;
      }
      setReturningId(null);
      setReturnStudentId('');
      fetchReservations();
    } catch {
      setReturnError('연결 오류가 발생했습니다.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < startDay; i++) days.push(<div key={`e-${i}`} className="h-14" />);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const isToday = new Date().toDateString() === date.toDateString();
      const dateStr = getLocalDateString(date);
      const hasReservation = reservations.some(r => r['날짜'] === dateStr && r['상태'] === '예약완료');

      days.push(
        <button key={d} onClick={() => setSelectedDate(date)}
          className={`h-14 rounded-2xl flex flex-col items-center justify-center relative transition-all ${
            isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' :
            isToday ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-gray-50 text-gray-700'
          }`}
        >
          <span className="text-sm">{d}</span>
          {hasReservation && !isSelected && <div className="w-1 h-1 bg-indigo-400 rounded-full mt-1" />}
        </button>
      );
    }
    return days;
  };

  const changeMonth = (offset) =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));

  const selectedDateStr = getLocalDateString(selectedDate);
  const dailyReservations = reservations.filter(r => r['날짜'] === selectedDateStr && r['상태'] !== '예약취소');

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 mb-6">
          <CalendarIcon className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">스마트 기자재 예약</h1>
        <p className="text-gray-500 text-lg font-medium mb-4">실시간으로 과학실 기자재 사용 현황을 확인하고 예약하세요.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Calendar & Daily List */}
        <div className="lg:col-span-2 space-y-8">
          {/* Calendar */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-4 sm:p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-gray-900">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h2>
              <div className="flex gap-2">
                <button onClick={() => changeMonth(-1)} className="p-3 rounded-2xl hover:bg-gray-100 text-gray-400 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                <button onClick={() => changeMonth(1)} className="p-3 rounded-2xl hover:bg-gray-100 text-gray-400 transition-colors"><ChevronRight className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-4 text-center font-bold text-gray-400 text-xs uppercase tracking-widest">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>
          </div>

          {/* Daily Reservations */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-8">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" />
              {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} 예약 현황
            </h3>

            {loading ? (
              <div className="py-10 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />불러오는 중...</div>
            ) : dailyReservations.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {dailyReservations.map((res, i) => (
                  <div key={i} className={`flex flex-col gap-3 p-5 rounded-3xl border transition-all ${res['상태'] === '반납완료' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-indigo-100 shadow-md'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${res['상태'] === '반납완료' ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600'}`}>
                        <Package className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <div className="text-sm font-black text-gray-900 truncate">{res['기자재']}</div>
                        <div className="text-xs font-bold text-gray-500 mt-1">{res['신청자명']}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{res['시간대']}</div>
                        {res['반납일시'] && <div className="text-[10px] font-bold text-gray-400 mt-1">반납: {res['반납일시']}</div>}
                      </div>
                    </div>

                    {/* 반납 확인 UI */}
                    {res['상태'] === '예약완료' && (
                      returningId === res['ID'] ? (
                        <div className="mt-1 space-y-2">
                          <input
                            type="text" inputMode="numeric" autoComplete="off"
                            value={returnStudentId} onChange={e => setReturnStudentId(e.target.value)}
                            placeholder="예약한 사람의 학번"
                            className="w-full h-11 px-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:outline-none text-base font-bold"
                          />
                          {returnError && <p className="text-xs font-bold text-red-600">{returnError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReturn(res['ID'])}
                              disabled={actionLoadingId === res['ID']}
                              className="flex-1 h-11 bg-red-500 text-white text-sm font-black rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              {actionLoadingId === res['ID'] ? <Loader2 className="w-4 h-4 animate-spin" /> : '반납 확인'}
                            </button>
                            <button onClick={() => { setReturningId(null); setReturnError(''); }} className="flex-1 h-11 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200 transition-colors">
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setReturningId(res['ID']); setReturnStudentId(''); setReturnError(''); }}
                          className="w-full h-11 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-black rounded-xl transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> 반납하기
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400 font-bold">확정된 예약이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Booking Form */}
        <div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-indigo-50 p-6 sm:p-8 lg:sticky lg:top-24">
            <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Plus className="w-7 h-7 text-indigo-600" />
              신규 예약 신청
            </h3>

            <form onSubmit={handleReservation} className="space-y-5">
              {/* 신청자 이름 */}
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">신청자 이름</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <input type="text" value={applicantName} onChange={e => setApplicantName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:outline-none font-bold transition-all" required />
                </div>
              </div>

              {/* 학번 */}
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">신청자 학번</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <input type="text" inputMode="numeric" value={applicantId} onChange={e => setApplicantId(e.target.value)}
                    placeholder="학번을 입력하세요 (예: 10101)"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:outline-none font-bold transition-all" required />
                </div>
              </div>

              {/* 기자재 선택 */}
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">기자재 선택</label>
                <div className="relative mb-3">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <select value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:outline-none font-bold transition-all appearance-none" required>
                    <option value="">기자재를 선택하세요</option>
                    {equipmentList.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                    <option value="manual">+ 직접 입력 (목록에 없음)</option>
                  </select>
                </div>
                {selectedEquipment === 'manual' && (
                  <input type="text" value={manualEquipment} onChange={e => setManualEquipment(e.target.value)}
                    placeholder="기자재 이름을 직접 입력하세요"
                    className="w-full px-4 py-4 rounded-2xl bg-gray-50 border-2 border-indigo-100 focus:border-indigo-300 focus:outline-none font-bold transition-all" required />
                )}
              </div>

              {/* 사용 시간대 체크박스 */}
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
                  사용 시간대
                  {selectedTimes.length > 0 && (
                    <span className="ml-2 text-indigo-600 normal-case font-black">({selectedTimes.length}개 선택됨)</span>
                  )}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {TIME_SLOTS.map(slot => {
                    const checked = selectedTimes.includes(slot);
                    return (
                      <label key={slot}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all border-2 ${
                          checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-transparent hover:border-indigo-200 text-gray-700'
                        }`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleTime(slot)} className="hidden" />
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-all ${checked ? 'bg-white border-white' : 'border-gray-300'}`}>
                          {checked && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <span className="text-sm font-bold">{slot}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {message.text && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {message.text}
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200/50 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : '예약 신청하기'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
