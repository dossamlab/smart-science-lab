import { createContext, useContext, useState } from 'react';

export const DEFAULT_CONFIG = {
  schoolName: '',
  schoolPhone: '',
  adminPhone: '',
  safetyManagerName: '',
  safetyManagerPhone: '',
  safetyCoordinatorName: '',
  safetyCoordinatorPhone: '',
  nearbyHospitalName: '',
  nearbyHospitalPhone: '',
  geminiApiKey: '',
  schoolGuidelines: '',
  spreadsheetId: '',
  gasUrl: '',
  isConfigured: false,
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
