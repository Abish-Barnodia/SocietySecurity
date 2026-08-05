import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/colors';

export type ClearanceState = 'PENDING' | 'APPROVED' | 'DENIED' | 'TIMEOUT';

export default function ClearanceCard({ state, timeoutAt, reason }: { state: ClearanceState; timeoutAt?: string | null; reason?: string | null }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const CONFIG: Record<ClearanceState, { bg: string; fg: string; label: string }> = {
    PENDING: { bg: colors.warningLight, fg: colors.warning, label: t('clearance_pending') },
    APPROVED: { bg: colors.successLight, fg: colors.success, label: t('clearance_approved') },
    DENIED: { bg: colors.dangerLight, fg: colors.danger, label: t('clearance_denied') },
    TIMEOUT: { bg: colors.dangerLight, fg: colors.danger, label: t('clearance_timeout') },
  };
  const { bg, fg, label } = CONFIG[state];

  useEffect(() => {
    if (state !== 'PENDING' || !timeoutAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.round((new Date(timeoutAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state, timeoutAt]);

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      {reason && state === 'DENIED' && (
        <Text style={[styles.countdown, { color: fg }]}>{reason}</Text>
      )}
      {secondsLeft !== null && (
        <Text style={[styles.countdown, { color: fg }]}>{t('clearance_secondsRemaining', { n: secondsLeft })}</Text>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  label: { fontSize: 15, fontWeight: '800' },
  countdown: { fontSize: 13, marginTop: 4, fontWeight: '600' },
});
