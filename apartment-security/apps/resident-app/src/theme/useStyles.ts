import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';
import { ThemeColors } from './tokens';

export function useStyles<T>(
  styleFactory: (colors: ThemeColors, isDarkMode: boolean) => T
): any {
  const { colors, isDarkMode } = useTheme();

  return useMemo(() => {
    return StyleSheet.create(styleFactory(colors, isDarkMode) as any);
  }, [colors, isDarkMode, styleFactory]);
}
