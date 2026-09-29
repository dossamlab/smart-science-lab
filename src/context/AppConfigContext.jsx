import { createContext, useContext, useState } from 'react';

// School defaults baked in at build time (Netlify env vars) so every device works without setup.
// Personal phone numbers and the Gemini key stay out of the bundle: they are entered per device.
const env = import.meta.env;

export const DEFAULT_CONFIG = {
  schoolName: env.VITE_SCHOOL_NAME || '',
  schoolPhone: env.VITE_SCHOOL_PHONE || '',
  adminPhone: env.VITE_ADMIN_PHONE || '',
  safetyManagerName: '',
  safetyManagerPhone: '',
  safetyCoordinatorName: '',
  safetyCoordinatorPhone: '',
  nearbyHospitalName: env.VITE_HOSPITAL_NAME || '',
  nearbyHospitalPhone: env.VITE_HOSPITAL_PHONE || '',
  geminiApiKey: '',
  schoolGuidelines: '',
  spreadsheetId: env.VITE_MSDS_SHEET_ID || '',
  gasUrl: env.VITE_RESERVATION_API_URL || '',
  isConfigured: Boolean(env.VITE_SCHOOL_NAME),
};

const STORAGE_KEY = 'lab_on_config_v2';

export function loadConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch (e) {}
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

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used within AppConfigProvider');
  return ctx;
}
