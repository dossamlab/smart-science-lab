import { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SafetyPage from './pages/SafetyPage';
import MsdsPage from './pages/MsdsPage';
import ReservationPage from './pages/ReservationPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import SosButton from './components/SosButton';
import { ShieldAlert, Beaker, CalendarClock, Shield, Home } from 'lucide-react';
import { useAppConfig } from './context/AppConfigContext';

function AutoRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (location.pathname !== '/') {
      timerRef.current = setTimeout(() => { navigate('/'); }, INACTIVITY_TIMEOUT);
    }
  };

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    resetTimer();
    events.forEach(e => window.addEventListener(e, resetTimer));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [location.pathname, navigate]);

  return null;
}

function AppContent() {
  const { config } = useAppConfig();
  const displayName = config.schoolName?.trim()
    ? `${config.schoolName} Lab-ON`
    : 'Lab-ON 과학실 플랫폼';

  return (
    <>
      <AutoRedirectHandler />
      <div className="min-h-screen bg-brand-50 flex flex-col font-sans">
        <SosButton />

        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="bg-brand-600 p-2 rounded-lg group-hover:bg-brand-700 transition-colors">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-gray-900 group-hover:text-brand-600 transition-colors">
                  {displayName}
                </span>
              </Link>

              <nav className="hidden md:flex gap-6">
                <Link to="/safety" className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-brand-600 transition-colors">
                  <ShieldAlert className="w-4 h-4" /> 안전 대처방안
                </Link>
                <Link to="/msds" className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-brand-600 transition-colors">
                  <Beaker className="w-4 h-4" /> MSDS 조회
                </Link>
                <Link to="/reservation" className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-brand-600 transition-colors">
                  <CalendarClock className="w-4 h-4" /> 기자재 예약
                </Link>
              </nav>

            </div>
          </div>
        </header>

        {/* Phones: bottom tab bar within thumb reach instead of a header menu */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {[
            { to: '/', label: '홈', icon: Home },
            { to: '/safety', label: '안전', icon: ShieldAlert },
            { to: '/msds', label: 'MSDS', icon: Beaker },
            { to: '/reservation', label: '예약', icon: CalendarClock },
          ].map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end
              className={({ isActive }) => `flex flex-col items-center justify-center gap-1 h-16 text-xs font-bold ${isActive ? 'text-brand-600' : 'text-gray-500'}`}
            >
              <Icon className="w-6 h-6" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-grow w-full max-w-7xl mx-auto p-4 pb-28 sm:p-6 sm:pb-28 md:pb-8 lg:p-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/msds" element={<MsdsPage />} />
            <Route path="/reservation" element={<ReservationPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
