// ponytail: synced palette with resident-app theme for unified design system
export const colors = {
  primary: '#0f172a',
  primaryLight: '#f1f5f9',
  primaryDark: '#020617',
  background: '#f5f3ef',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  success: '#16a34a',
  successLight: '#dcfce7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  border: '#e2e8f0',
  black: '#000000',
  white: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkColors: typeof colors = {
  primary: '#ffffff',
  primaryLight: '#334155',
  primaryDark: '#cbd5e1',
  background: '#0f172a',
  card: '#1e293b',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  success: '#22c55e',
  successLight: 'rgba(34, 197, 94, 0.2)',
  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.2)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.2)',
  border: '#334155',
  black: '#000000',
  white: '#ffffff',
  overlay: 'rgba(0,0,0,0.65)',
};

export type ThemeColors = typeof colors;

