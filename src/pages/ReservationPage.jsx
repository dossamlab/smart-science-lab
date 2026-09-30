import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, Package, User, CheckCircle2, AlertCircle, Loader2, ChevronLeft, ChevronRight, Plus, RotateCcw, Hash, X } from 'lucide-react';
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
  // A number label on a laptop (QR 라벨 page) opens ?eq=학생용 노트북&unit=3 with that unit picked.
  const [params] = useSearchParams();
  const qrEquipment = params.get('eq') || '';
  const qrUnit = Number(params.get('unit')) || 0;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEquipment, setSelectedEquipment] = useState(qrEquipment);
  const [manualEquipment, setManualEquipment] = useState('');
  const [selectedTimes, setSelectedTimes] = useState([]); // 체크박스 다중 선택
  const [applicantName, setApplicantName] = useState('');
  const [applicantId, setApplicantId] = useState('');
  const [pending, setPending] = useState(null); // { id, kind: 'return' | 'cancel' } awaiting 학번 confirmation
  const [returnStudentId, setReturnStudentId] = useState('');
  const [returnError, setReturnError] = useState('');

  const [reservations, setReservations] = useState([]);
  const [equipmentList, setEquipmentList] = useState(DEFAULT_EQUIPMENTS);
  const [equipmentUnits, setEquipmentUnits] = useState({}); // { '학생용 노트북': 30 } from the sheet's 수량 column
  const [selectedUnit, setSelectedUnit] = useState(qrUnit);
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(Boolean(API_URL));
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

  const todayStr = getLocalDateString(new Date());

  useEffect(() => {
    if (!API_URL) return;
    let active = true;
    fetch(API_URL)
      .then(response => response.json())
      .then(result => {
        if (!active || result.status !== 'success' || !result.data) return;
        // 객체 형태(reservations)나 배열 형태 모두 대응
        const resData = result.data.reservations || (Array.isArray(result.data) ? result.data : []);
        // Old script versions sent Sheets dates as UTC ISO (KST midnight = previous day 15:00Z).
        const normalizeDate = (value) =>
          typeof value === 'string' && value.includes('T') ? getLocalDateString(new Date(value)) : value;
        setReservations(resData.map(r => ({ ...r, '날짜': normalizeDate(r['날짜']) })));
        if (result.data.equipments?.length > 0) setEquipmentList(result.data.equipments);
        setEquipmentUnits(result.data.equipmentUnits || {});
      })
      .catch(error => console.error('Fetch error:', error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [API_URL, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  // Once the data is in, a QR scan lands on that unit's booking today (to return it) or on the form (to book it).
  useEffect(() => {
    if (loading || !qrEquipment) return;
    (document.getElementById('qr-booking') || document.getElementById('booking-form'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, qrEquipment]);

  // Active bookings of `equipment` on `date` that use any of `slots`.
  const bookingsOf = (equipment, date, slots) => reservations.filter(r =>
    r['날짜'] === date && r['기자재'] === equipment && r['상태'] === '예약완료' &&
    String(r['시간대']).split(', ').some(s => slots.includes(s)));

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
    if (dateStr < todayStr) {
      setMessage({ type: 'error', text: '지난 날짜는 예약할 수 없습니다. 달력에서 오늘 이후 날짜를 고르세요.' });
      return;
    }
    // Multi-unit equipment (laptops) is booked per numbered unit, so only the same number conflicts.
    const units = equipmentUnits[finalEquipment] || 0;
    if (units > 1 && !(selectedUnit >= 1 && selectedUnit <= units)) {
      setMessage({ type: 'error', text: `${finalEquipment} 번호를 골라 주세요.` });
      return;
    }
    const taken = selectedTimes.filter(slot => bookingsOf(finalEquipment, dateStr, [slot])
      .some(r => units <= 1 || String(r['번호']) === String(selectedUnit)));
    if (taken.length > 0) {
      setMessage({ type: 'error', text: `${units > 1 ? `${selectedUnit}번은 ` : ''}이미 예약된 시간대입니다: ${taken.join(', ')}` });
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
        equipment: finalEquipment,
        unit: units > 1 ? selectedUnit : undefined
      });
      if (result.status !== 'success') {
        setMessage({ type: 'error', text: result.message || '예약하지 못했습니다.' });
        return;
      }
      setMessage({ type: 'success', text: units > 1 ? `${finalEquipment} ${selectedUnit}번이 예약되었습니다.` : '예약되었습니다.' });
      setApplicantName('');
      setApplicantId('');
      setSelectedEquipment('');
      setManualEquipment('');
      setSelectedTimes([]);
      setSelectedUnit(0);
      refresh();
    } catch {
      setMessage({ type: 'error', text: '연결 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Return or cancel; both need the booker's 학번 (checked by Code.gs).
  const handleAction = async () => {
    if (!returnStudentId.trim()) {
      setReturnError('예약할 때 입력한 학번을 입력하세요.');
      return;
    }
    const { id, kind } = pending;
    setActionLoadingId(id);
    setReturnError('');
    try {
      const result = await post({ action: kind, id, studentId: returnStudentId.trim() });
      if (result.status !== 'success') {
        setReturnError(result.message || (kind === 'cancel' ? '취소하지 못했습니다.' : '반납하지 못했습니다.'));
        return;
      }
      setPending(null);
      setReturnStudentId('');
      refresh();
    } catch {
      setReturnError('연결 오류가 발생했습니다.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openAction = (id, kind) => {
    setPending({ id, kind });
    setReturnStudentId('');
    setReturnError('');
  };

  // Tap a free cell in the day grid to fill the booking form.
  const pickSlot = (equipment, slot) => {
    if (equipmentList.includes(equipment)) {
      setSelectedEquipment(equipment);
    } else {
      setSelectedEquipment('manual');
      setManualEquipment(equipment);
    }
    setSelectedTimes(prev => (prev.includes(slot) ? prev : [...prev, slot]));
    document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const isPast = dateStr < todayStr; // an active booking on a past day was never returned

      days.push(
        <button key={d} onClick={() => setSelectedDate(date)}
          aria-label={`${month + 1}월 ${d}일${hasReservation ? (isPast ? ', 미반납 있음' : ', 예약 있음') : ''}`}
          aria-pressed={isSelected}
          className={`h-14 rounded-2xl flex flex-col items-center justify-center relative transition-all ${
            isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' :
            isToday ? 'bg-indigo-50 text-indigo-700 font-bold' :
            isPast ? 'text-gray-500 hover:bg-gray-50' : 'hover:bg-gray-50 text-gray-700'
          }`}
        >
          <span className="text-sm">{d}</span>
          {hasReservation && !isSelected && <div className={`w-1 h-1 rounded-full mt-1 ${isPast ? 'bg-red-500' : 'bg-indigo-400'}`} />}
        </button>
      );
    }
    return days;
  };

  const changeMonth = (offset) =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));

  const showDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    setSelectedDate(new Date(y, m - 1, d));
    setCurrentMonth(new Date(y, m - 1, 1));
    document.getElementById('daily-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectedDateStr = getLocalDateString(selectedDate);
  const selectedIsPast = selectedDateStr < todayStr;
  const isQrUnit = (r) => qrUnit > 0 && r['기자재'] === qrEquipment && Number(r['번호']) === qrUnit;
  const dailyReservations = reservations.filter(r => r['날짜'] === selectedDateStr && r['상태'] !== '예약취소')
    .sort((a, b) => isQrUnit(b) - isQrUnit(a));
  const qrBooking = dailyReservations.find(r => isQrUnit(r) && r['상태'] === '예약완료');
  // Past bookings never returned (still 예약완료), oldest first, so they can be chased up.
  const overdue = reservations.filter(r => r['날짜'] && r['날짜'] < todayStr && r['상태'] === '예약완료')
    .sort((a, b) => String(a['날짜']).localeCompare(String(b['날짜'])));
  const activeToday = dailyReservations.filter(r => r['상태'] === '예약완료');
  const gridEquipments = [...new Set([...equipmentList, ...activeToday.map(r => r['기자재'])])];
  const bookingEquipment = selectedEquipment === 'manual' ? manualEquipment : selectedEquipment;
  const bookingUnits = equipmentUnits[bookingEquipment] || 0;
  const takenUnits = new Set(bookingsOf(bookingEquipment, selectedDateStr, selectedTimes).map(r => Number(r['번호'])));

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
        <div className="lg:col-span-2 space-y-8 min-w-0">
          {overdue.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-[2rem] p-5">
              <p className="font-black text-red-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" /> 반납되지 않은 지난 예약 {overdue.length}건
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {overdue.slice(0, 6).map((r, i) => (
                  <button key={r['ID'] || i} type="button" onClick={() => showDate(r['날짜'])}
                    className="h-10 px-3 rounded-xl bg-white border border-red-200 text-sm font-bold text-red-800 hover:bg-red-100 transition-colors">
                    {r['날짜'].slice(5).replace('-', '/')} {r['기자재']}{r['번호'] && ` ${r['번호']}번`} · {r['신청자명']}
                  </button>
                ))}
                {overdue.length > 6 && <span className="self-center text-sm font-bold text-red-700">외 {overdue.length - 6}건</span>}
              </div>
              <p className="mt-3 text-xs text-red-700">누르면 그날 예약 현황으로 갑니다. 빌린 학생이 학번으로 반납하거나, 스프레드시트에서 상태를 '반납완료'로 바꾸면 사라집니다.</p>
            </div>
          )}

          {/* Calendar */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-4 sm:p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-gray-900">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h2>
              <div className="flex gap-2">
                <button onClick={() => changeMonth(-1)} aria-label="이전 달" className="p-3 rounded-2xl hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                <button onClick={() => changeMonth(1)} aria-label="다음 달" className="p-3 rounded-2xl hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-4 text-center font-bold text-gray-500 text-xs uppercase tracking-widest">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>
          </div>

          {/* Day grid: equipment x period, so a tablet shows the whole day at a glance */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-4 sm:p-8">
            <h3 className="text-xl font-black text-gray-900 mb-1">
              {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} 시간표
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedIsPast ? '지난 날짜는 조회만 할 수 있습니다.' : '빈칸(+)을 누르면 예약 신청서에 기자재와 교시가 채워집니다.'}
            </p>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-black text-gray-500 px-2">기자재</th>
                    {TIME_SLOTS.map(slot => (
                      <th key={slot} className="text-xs font-black text-gray-500 whitespace-nowrap">{slot.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridEquipments.map(eq => (
                    <tr key={eq}>
                      <th scope="row" className="text-left font-bold text-gray-800 px-2 whitespace-nowrap max-w-[10rem] truncate">
                        {eq}{equipmentUnits[eq] > 1 && <span className="ml-1 text-xs font-medium text-gray-500">{equipmentUnits[eq]}대</span>}
                      </th>
                      {TIME_SLOTS.map(slot => {
                        const booked = bookingsOf(eq, selectedDateStr, [slot]);
                        const units = equipmentUnits[eq] || 0;
                        // A multi-unit cell stays open until every unit is booked and shows booked/total.
                        if (booked.length > 0 && booked.length >= Math.max(units, 1)) {
                          return (
                            <td key={slot} className="h-11 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold text-center px-1">
                              {units > 1 ? `${booked.length}/${units}` : booked[0]['신청자명']}
                            </td>
                          );
                        }
                        const chosen = !selectedIsPast && (selectedEquipment === eq || (selectedEquipment === 'manual' && manualEquipment === eq)) && selectedTimes.includes(slot);
                        return (
                          <td key={slot} className="h-11 p-0">
                            <button
                              type="button"
                              disabled={selectedIsPast}
                              onClick={() => pickSlot(eq, slot)}
                              aria-label={`${eq} ${slot} 예약하기${booked.length ? ` (${units}대 중 ${booked.length}대 예약됨)` : ''}`}
                              className={`w-full h-11 rounded-lg font-black transition-colors ${chosen ? 'bg-indigo-600 text-white' : booked.length ? 'bg-indigo-50 text-indigo-700 text-xs hover:bg-indigo-100' : 'bg-gray-50 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'} disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:text-gray-400`}
                            >
                              {chosen ? '✓' : booked.length ? `${booked.length}/${units}` : selectedIsPast ? '' : '+'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Reservations */}
          <div id="daily-list" className="scroll-mt-24 bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-8">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" />
              {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} 예약 현황
            </h3>

            {loading ? (
              <div className="py-10 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />불러오는 중...</div>
            ) : dailyReservations.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {dailyReservations.map((res, i) => (
                  <div key={i} id={res === qrBooking ? 'qr-booking' : undefined}
                    className={`scroll-mt-24 flex flex-col gap-3 p-5 rounded-3xl border transition-all ${res['상태'] === '반납완료' ? 'bg-gray-50 border-gray-100 opacity-60' : selectedIsPast ? 'bg-white border-red-200 shadow-md' : 'bg-white border-indigo-100 shadow-md'} ${isQrUnit(res) ? 'ring-2 ring-indigo-500' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${res['상태'] === '반납완료' ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600'}`}>
                        <Package className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <div className="text-sm font-black text-gray-900 truncate">{res['기자재']}{res['번호'] && ` ${res['번호']}번`}</div>
                        <div className="text-xs font-bold text-gray-500 mt-1">{res['신청자명']}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{res['시간대']}</div>
                        {selectedIsPast && res['상태'] === '예약완료' && (
                          <div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-black">미반납</div>
                        )}
                        {res['반납일시'] && <div className="text-xs font-bold text-gray-500 mt-1">반납: {res['반납일시']}</div>}
                      </div>
                    </div>

                    {/* 반납·취소 확인 UI */}
                    {res['상태'] === '예약완료' && (
                      pending?.id === res['ID'] ? (
                        <div className="mt-1 space-y-2">
                          <p className="text-sm font-black text-gray-700">{pending.kind === 'cancel' ? '예약 취소' : '반납'} — 예약한 사람의 학번</p>
                          <input
                            type="text" inputMode="numeric" autoComplete="off" autoFocus
                            aria-label="예약한 사람의 학번"
                            value={returnStudentId} onChange={e => setReturnStudentId(e.target.value)}
                            placeholder="학번"
                            className="w-full h-11 px-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:outline-none text-base font-bold"
                          />
                          {returnError && <p className="text-xs font-bold text-red-600">{returnError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={handleAction}
                              disabled={actionLoadingId === res['ID']}
                              className="flex-1 h-11 bg-red-500 text-white text-sm font-black rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              {actionLoadingId === res['ID'] ? <Loader2 className="w-4 h-4 animate-spin" /> : pending.kind === 'cancel' ? '취소 확인' : '반납 확인'}
                            </button>
                            <button onClick={() => { setPending(null); setReturnError(''); }} className="flex-1 h-11 bg-gray-100 text-gray-600 text-sm font-black rounded-xl hover:bg-gray-200 transition-colors">
                              닫기
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openAction(res['ID'], 'return')}
                            className="flex-1 h-11 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-black rounded-xl transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" /> 반납하기
                          </button>
                          {!selectedIsPast && (
                            <button
                              onClick={() => openAction(res['ID'], 'cancel')}
                              className="flex-1 h-11 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-black rounded-xl transition-colors"
                            >
                              <X className="w-4 h-4" /> 예약 취소
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-500 font-bold">확정된 예약이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Booking Form */}
        <div>
          <div id="booking-form" className="scroll-mt-24 bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-indigo-50 p-6 sm:p-8 lg:sticky lg:top-24">
            <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Plus className="w-7 h-7 text-indigo-600" />
              신규 예약 신청
            </h3>

            <form onSubmit={handleReservation} className="space-y-5">
              {/* 신청자 이름 */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">신청자 이름</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <input type="text" value={applicantName} onChange={e => setApplicantName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:outline-none font-bold transition-all" required />
                </div>
              </div>

              {/* 학번 */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">신청자 학번</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <input type="text" inputMode="numeric" value={applicantId} onChange={e => setApplicantId(e.target.value)}
                    placeholder="학번을 입력하세요 (예: 10101)"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-300 focus:outline-none font-bold transition-all" required />
                </div>
              </div>

              {/* 기자재 선택 */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">기자재 선택</label>
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
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
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

              {/* 번호 선택: 수량이 2대 이상인 기자재(노트북 등) */}
              {bookingUnits > 1 && (
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                    {bookingEquipment} 번호
                    {selectedUnit >= 1 && selectedUnit <= bookingUnits && (
                      <span className="ml-2 text-indigo-600 normal-case font-black">({selectedUnit}번 선택됨)</span>
                    )}
                  </label>
                  {selectedTimes.length === 0 && <p className="text-xs text-gray-500 mb-2">시간대를 먼저 고르면 이미 예약된 번호가 흐리게 표시됩니다.</p>}
                  <div className="grid grid-cols-6 gap-1.5" role="group" aria-label={`${bookingEquipment} 번호 선택`}>
                    {Array.from({ length: bookingUnits }, (_, i) => i + 1).map(n => {
                      const taken = takenUnits.has(n);
                      return (
                        <button key={n} type="button" disabled={taken} onClick={() => setSelectedUnit(n)}
                          aria-pressed={selectedUnit === n}
                          aria-label={`${n}번${taken ? ', 이미 예약됨' : ''}`}
                          className={`h-11 rounded-xl text-sm font-black transition-colors ${taken ? 'bg-gray-100 text-gray-400 line-through cursor-not-allowed' : selectedUnit === n ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-indigo-50'}`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
