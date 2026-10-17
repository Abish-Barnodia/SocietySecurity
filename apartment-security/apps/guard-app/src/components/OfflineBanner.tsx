import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { onQueueChange, flushQueue, isSyncing } from '../services/syncService';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function OfflineBanner() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    flushQueue();
    return onQueueChange((count) => {
      setPending(count);
      setSyncing(isSyncing());
    });
  }, []);

  if (pending === 0) return null;

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await flushQueue();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleManualSync}
      style={[styles.banner, { backgroundColor: colors.primaryDark }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {syncing && <ActivityIndicator size="small" color="#fff" />}
        <Text style={styles.text}>
          {pending === 1 ? t('sync_pendingOne') : t('sync_pendingMany').replace('{count}', String(pending))}
          {syncing ? ' — Syncing now...' : ' (Tap to sync)'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

