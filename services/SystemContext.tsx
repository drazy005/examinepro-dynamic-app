
import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemSettings, AppBranding } from './types';
import { STORAGE_KEYS } from '../constants';
import { SecureStorage } from './storageService';

interface SystemContextType {
  settings: SystemSettings;
  branding: AppBranding;
  setSettings: (s: SystemSettings) => void;
  setBranding: (b: AppBranding) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [settings, setSettingsState] = useState<SystemSettings>(() =>
    SecureStorage.load(STORAGE_KEYS.SYSTEM_SETTINGS, { aiEnabled: true, maintenanceMode: false })
  );

  const [branding, setBrandingState] = useState<AppBranding>(() =>
    SecureStorage.load(STORAGE_KEYS.BRANDING, {
      primaryColor: '#4f46e5',
      appName: 'ExaminePro',
      appIcon: '',
      bannerImage: '',
      backgroundImage: '',
      borderRadius: '24px',
      fontFamily: 'sans'
    })
  );

  const setSettings = (s: SystemSettings) => {
    setSettingsState(s);
    SecureStorage.save(STORAGE_KEYS.SYSTEM_SETTINGS, s);
  };

  const setBranding = (b: AppBranding) => {
    setBrandingState(b);
    SecureStorage.save(STORAGE_KEYS.BRANDING, b);
  };

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <SystemContext.Provider value={{ settings, branding, setSettings, setBranding, isDarkMode, toggleDarkMode }}>
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) throw new Error("useSystem must be used within SystemProvider");
  return context;
};
