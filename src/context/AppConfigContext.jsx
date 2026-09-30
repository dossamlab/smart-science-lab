import { createContext, useContext, useState } from 'react';

// School defaults baked in at build time (Netlify env vars) so every device works without setup.
// Personal phone numbers stay out of the bundle: they are entered per device (behind the admin PIN).
const env = import.meta.env;

const DEFAULT_CONFIG = {
  schoolName: env.VITE_SCHOOL_NAME || '',
  schoolPhone: env.VITE_SCHOOL_PHONE || '',
  adminPhone: env.VITE_ADMIN_PHONE || '',
  safetyManagerName: '',
  safetyManagerPhone: '',
  safetyCoordinatorName: '',
  safetyCoordinatorPhone: '',
  nearbyHospitalName: env.VITE_HOSPITAL_NAME || '',
  nearbyHospitalPhone: env.VITE_HOSPITAL_PHONE || '',
  schoolGuidelines: '',
  gasUrl: env.VITE_RESERVATION_API_URL || '',
  isConfigured: Boolean(env.VITE_SCHOOL_NAME),
};

const STORAGE_KEY = 'lab_on_config_v2';

function loadConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored) {
      // AI now runs on the server; drop any Gemini key an older version saved on this device.
      if ('geminiApiKey' in stored) {
        delete stored.geminiApiKey;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }
      return { ...DEFAULT_CONFIG, ...stored };
    }
  } catch {
    // Corrupt or blocked storage: fall back to the school defaults.
  }
  return DEFAULT_CONFIG;
}

const AppConfigContext = createContext(null);

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(loadConfig);

  const updateConfig = (partial) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetConfig = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <AppConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </AppConfigContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives beside its provider
export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used within AppConfigProvider');
  return ctx;
}
