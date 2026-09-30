import { useEffect, useState } from 'react';
import { AlertCircle, Lock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const UNLOCK_KEY = 'lab_on_admin_unlocked';

/** Asks the server-side ADMIN_PIN (netlify/functions/admin.mjs) once per browser session. */
export default function PinGate({ children }) {
  const [state, setState] = useState(() => (sessionStorage.getItem(UNLOCK_KEY) ? 'open' : 'checking'));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (state !== 'checking') return;
    fetch('/api/admin')
      .then(r => r.json())
      .then(({ pinRequired }) => setState(pinRequired ? 'locked' : 'nopin'))
      .catch(() => setState('locked'));
  }, [state]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setState('verifying');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) throw new Error();
      sessionStorage.setItem(UNLOCK_KEY, '1');
      setState('open');
    } catch {
      setError('PIN이 맞지 않습니다.');
      setPin('');
      setState('locked');
    }
  };

  if (state === 'open') return children;
  if (state === 'nopin') {
    return (
      <>
        <div className="max-w-3xl mx-auto mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-bold text-amber-800 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          관리자 PIN이 설정되지 않아 누구나 이 화면을 열 수 있습니다. Netlify 환경변수 ADMIN_PIN을 설정하세요.
        </div>
        {children}
      </>
    );
  }
  const busy = state === 'verifying' || state === 'checking';
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 space-y-4 text-center">
      <Lock className="w-10 h-10 text-brand-600 mx-auto" aria-hidden="true" />
      <h1 className="text-xl font-black text-gray-900">관리자 PIN</h1>
      <p className="text-sm text-gray-500">관리 교사용 화면입니다. PIN을 입력하세요.</p>
      <input
        type="password" inputMode="numeric" autoComplete="off" autoFocus
        aria-label="관리자 PIN"
        value={pin} onChange={e => setPin(e.target.value)}
        className="w-full h-12 px-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-brand-400 focus:outline-none text-center text-xl tracking-widest font-black"
      />
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button disabled={!pin || busy}
        className="w-full h-12 rounded-xl bg-brand-600 text-white font-black disabled:opacity-50 flex items-center justify-center">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-label="확인 중" /> : '확인'}
      </button>
      <Link to="/" className="block text-sm font-bold text-gray-500">메인으로 돌아가기</Link>
    </form>
  );
}
