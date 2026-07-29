export type ThemeColors = {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  surfaceHighlight: string;
  text: string;
  textMuted: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  border: string;
  shadow: string;
  black: string;
  white: string;
};

export const lightColors: ThemeColors = {
  primary: '#d97706', // Mustard yellow
  primaryLight: '#fef3c7',
  background: '#fafafa',
  surface: '#ffffff',
  surfaceHighlight: '#f4f4f5',
  text: '#111827',
  textMuted: '#6b7280',
  success: '#16a34a',
  successLight: '#dcfce7',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  warning: '#eab308',
  warningLight: '#fef9c3',
  border: '#e5e7eb',
  shadow: 'rgba(0,0,0,0.05)',
  black: '#000000',
  white: '#ffffff',
};

export const darkColors: ThemeColors = {
  primary: '#d97706', // Mustard yellow
  primaryLight: '#452a0a',
  background: '#0a0a0a',
  surface: '#171717',
  surfaceHighlight: '#262626',
  text: '#f9fafb',
  textMuted: '#9ca3af',
  success: '#22c55e',
  successLight: '#052e16',
  danger: '#ef4444',
  dangerLight: '#450a0a',
  warning: '#facc15',
  warningLight: '#422006',
  border: '#262626',
  shadow: 'rgba(0,0,0,0.3)',
  black: '#000000',
  white: '#ffffff',
};

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const roundness = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};
