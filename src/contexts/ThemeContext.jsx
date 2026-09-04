import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(undefined);

export const ThemeModeProvider = ({ children }) => {
  const [darkMode] = useState(false);

  useEffect(() => {
    localStorage.removeItem('asm_dark_mode');
    document.body.classList.remove('asm-dark');
  }, []);

  const value = useMemo(
    () => ({
      darkMode,
      toggleDarkMode: () => {},
      setDarkMode: () => {},
    }),
    [darkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return context;
};
