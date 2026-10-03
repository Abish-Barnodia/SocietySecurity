export const colors = {
  primary: '#0f172a', // Clean Deep Slate Black for active buttons and accents
  primaryLight: '#f1f5f9', // Light slate for icons/badges
  primaryDark: '#020617',
  background: '#f5f3ef', // Neutral off-white background
  card: '#ffffff',
  text: '#0f172a', // Dark slate for text
  textMuted: '#64748b', // Slate muted
  success: '#16a34a',
  successLight: '#dcfce7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  border: '#e2e8f0', // Crisp border for inputs and cards
  black: '#000000',
  white: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkColors: typeof colors = {
  primary: '#ffffff', // High-contrast White for active elements in dark mode
  primaryLight: '#334155', // Slate 700 for icon boxes
  primaryDark: '#cbd5e1',
  background: '#0f172a', // Slate 900 — matching all app pages
  card: '#1e293b', // Slate 800 — matching all app pages
  text: '#f8fafc', // Slate 50 — clean crisp white text
  textMuted: '#94a3b8', // Slate 400 — clean muted text
  success: '#22c55e',
  successLight: 'rgba(34, 197, 94, 0.2)',
  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.2)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.2)',
  border: '#334155', // Slate 700 — matching all app pages
  black: '#000000',
  white: '#ffffff',
  overlay: 'rgba(0,0,0,0.65)',
};

export type ThemeColors = typeof colors;
