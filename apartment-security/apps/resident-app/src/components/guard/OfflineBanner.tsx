import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { onQueueChange, flushQueue } from '../../services/syncService';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function OfflineBanner() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    flushQueue();
    return onQueueChange(setPending);
  }, []);

  if (pending === 0) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.primaryDark }]}>
      <Text style={styles.text}>
        {pending === 1 ? t('sync_pendingOne') : t('sync_pendingMany').replace('{count}', String(pending))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, alignItems: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
