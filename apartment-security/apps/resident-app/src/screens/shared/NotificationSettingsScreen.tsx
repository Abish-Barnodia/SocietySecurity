import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';

type PrefKey = 'pushEnabled' | 'smsEnabled' | 'staffEnabled';

export default function NotificationSettingsScreen() {
  const { alertPreferences, updateAlertPreferences } = useData();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  const handleToggle = async (key: PrefKey) => {
    setSavingKey(key);
    try {
      await updateAlertPreferences({ [key]: !alertPreferences[key] });
    } catch {
      Alert.alert('Error', 'Failed to update notification setting. Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const rows: { key: PrefKey; title: string; desc: string }[] = [
    { key: 'pushEnabled', title: 'Push Notifications', desc: 'Receive entry and exit alerts on your phone lock screen.' },
    { key: 'smsEnabled', title: 'SMS Fallback', desc: "Get an SMS if you don't respond to a push notification." },
    { key: 'staffEnabled', title: 'Domestic Worker Entries', desc: 'Notify me when my registered staff arrives.' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {rows.map((row) => (
        <View key={row.key} style={styles.prefRow}>
          <View style={styles.prefTextGroup}>
            <Text style={styles.prefTitle}>{row.title}</Text>
            <Text style={styles.prefDesc}>{row.desc}</Text>
          </View>
          {savingKey === row.key ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <TouchableOpacity
              style={[styles.toggleSwitch, { backgroundColor: alertPreferences[row.key] ? colors.success : colors.border }]}
              onPress={() => handleToggle(row.key)}
            >
              <View style={[styles.toggleThumb, alertPreferences[row.key] && styles.toggleThumbActive]} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20 },
    prefRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    prefTextGroup: { flex: 1, marginRight: 16 },
    prefTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    prefDesc: { fontSize: 14, color: colors.textMuted },
    toggleSwitch: { width: 50, height: 30, borderRadius: 15, justifyContent: 'center', padding: 2 },
    toggleThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.card,
    },
    toggleThumbActive: { transform: [{ translateX: 20 }] },
  });
