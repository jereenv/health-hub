import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import type { ColorScheme, ThemeColors } from './tokens';
import { COLORS } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
}

const ThemeContext = createContext<Theme | null>(null);

/** Provides the colour tokens for the system light or dark mode (dark when unknown). */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const scheme: ColorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const theme = useMemo(() => ({ scheme, colors: COLORS[scheme] }), [scheme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => undefined);
  }, [theme.colors.bg]);

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

/** Returns the active theme; only valid beneath `ThemeProvider`. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
}
