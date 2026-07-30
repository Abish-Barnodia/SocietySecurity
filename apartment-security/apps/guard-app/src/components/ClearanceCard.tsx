import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export type ClearanceState = 'PENDING' | 'APPROVED' | 'DENIED' | 'TIMEOUT';

const CONFIG: Record<ClearanceState, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: colors.warningLight, fg: colors.warning, label: 'Awaiting resident approval' },
  APPROVED: { bg: colors.successLight, fg: colors.success, label: 'Approved — allow entry' },
  DENIED: { bg: colors.dangerLight, fg: colors.danger, label: 'Denied — do not allow entry' },
  TIMEOUT: { bg: colors.dangerLight, fg: colors.danger, label: 'No response — approval expired' },
};

export default function ClearanceCard({ state, timeoutAt, reason }: { state: ClearanceState; timeoutAt?: string | null; reason?: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
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
        <Text style={[styles.countdown, { color: fg }]}>{secondsLeft}s remaining</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  label: { fontSize: 15, fontWeight: '800' },
  countdown: { fontSize: 13, marginTop: 4, fontWeight: '600' },
});
