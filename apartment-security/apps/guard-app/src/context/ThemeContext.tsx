import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors as lightColors, darkColors, ThemeColors } from '../theme/colors';
import tokenStorage from '../utils/tokenStorage';

const THEME_STORAGE_KEY = 'themePreference';

export type ThemeName = 'light' | 'dark';

type ThemeContextType = {
  theme: ThemeName;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeName>(systemScheme === 'dark' ? 'dark' : 'light');
  const [hydrated, setHydrated] = useState(false);

  // A user's explicit choice (once made) always wins over the OS setting —
  // only fall back to the system scheme before any preference is saved.
  useEffect(() => {
    tokenStorage.getItemAsync(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') setThemeState(stored);
      setHydrated(true);
    });
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    tokenStorage.setItemAsync(THEME_STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<ThemeContextType>(
    () => ({ theme, colors: theme === 'dark' ? darkColors : lightColors, isDark: theme === 'dark', toggleTheme }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme]
  );

  // Avoid a flash of the wrong theme while the stored preference loads.
  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
