export const colors = {
  primary: '#B67318', // Warm brown/golden for active buttons and accents
  primaryLight: '#F5EBE1', // Light tan background for icons/badges
  primaryDark: '#8F5A13',
  background: '#FFFDF9', // Warm off-white background
  card: '#FFFFFF',
  text: '#1C1917', // Dark brown/black for text
  textMuted: '#8A7D73', // Muted text
  success: '#16A34A',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FDECEF', // Light red background for emergency button
  warning: '#EAB308',
  warningLight: '#FEF9C3',
  border: '#EBE5DF', // Light border for inputs and cards
  black: '#000000',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkColors: typeof colors = {
  primary: '#D9973F',
  primaryLight: '#3A2C1A',
  primaryDark: '#F2A65A',
  background: '#141210',
  card: '#1F1B17',
  text: '#F5EFE7',
  textMuted: '#A99C8E',
  success: '#22C55E',
  successLight: '#123321',
  danger: '#F87171',
  dangerLight: '#3B1717',
  warning: '#FBBF24',
  warningLight: '#3A2E0C',
  border: '#332C25',
  black: '#000000',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.65)',
};

export type ThemeColors = typeof colors;
