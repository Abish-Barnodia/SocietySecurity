// Same palette as resident-app's theme (apps/resident-app/src/theme/colors.ts)
// — kept in sync deliberately so guard-app's post-login screens feel like the
// same product family.
export const colors = {
  primary: '#B67318',
  primaryLight: '#F5EBE1',
  primaryDark: '#8F5A13',
  background: '#FFFDF9',
  card: '#FFFFFF',
  text: '#1C1917',
  textMuted: '#8A7D73',
  success: '#16A34A',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FDECEF',
  warning: '#EAB308',
  warningLight: '#FEF9C3',
  border: '#EBE5DF',
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
