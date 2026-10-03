import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';

type PrefKey = 'pushEnabled' | 'smsEnabled' | 'staffEnabled';

export default function NotificationSettingsScreen() {
  const navigation = useNavigation<any>();
  const { alertPreferences, updateAlertPreferences } = useData();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
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

  const rows: { key: PrefKey; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'pushEnabled', title: 'Push Notifications', desc: 'Receive gate entries, guest arrivals, and exit alerts on lock screen.', icon: 'notifications-outline' },
    { key: 'smsEnabled', title: 'SMS Fallback Alerts', desc: "Receive automated SMS when push alerts remain unacknowledged.", icon: 'chatbox-outline' },
    { key: 'staffEnabled', title: 'Daily Help & Staff Arrival', desc: 'Instant alerts when your registered housekeeper, cook, or driver checks in.', icon: 'people-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Alert preferences and sound alerts</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Test Loud Ringtone Card */}
        <TouchableOpacity
          style={styles.testCard}
          onPress={() => navigation?.navigate('NotificationSetup')}
          activeOpacity={0.8}
        >
          <View style={styles.testCardIconBox}>
            <Ionicons name="volume-high-outline" size={24} color={colors.text} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.testCardTitle}>Test Gate Ringtone & Alerts</Text>
            <Text style={styles.testCardDesc}>
              Listen to the high-priority gate ringtone and verify arrival banner popups
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>DELIVERY CHANNELS</Text>

        <View style={styles.card}>
          {rows.map((row, idx) => (
            <View key={row.key} style={[styles.prefRow, idx === rows.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.prefIconBox}>
                <Ionicons name={row.icon} size={20} color={colors.text} />
              </View>
              <View style={styles.prefTextGroup}>
                <Text style={styles.prefTitle}>{row.title}</Text>
                <Text style={styles.prefDesc}>{row.desc}</Text>
              </View>
              {savingKey === row.key ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <TouchableOpacity
                  style={[styles.toggleSwitch, { backgroundColor: alertPreferences[row.key] ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#334155' : '#e2e8f0') }]}
                  onPress={() => handleToggle(row.key)}
                >
                  <View style={[styles.toggleThumb, alertPreferences[row.key] && (isDark ? styles.toggleThumbActiveDark : styles.toggleThumbActive)]} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0f172a' : '#f5f3ef' },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    testCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    testCardIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    testCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    testCardDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },

    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    prefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    prefIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    prefTextGroup: { flex: 1, marginRight: 12 },
    prefTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    prefDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },

    toggleSwitch: { width: 48, height: 28, borderRadius: 14, justifyContent: 'center', padding: 2 },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#ffffff',
    },
    toggleThumbActive: { transform: [{ translateX: 20 }], backgroundColor: '#ffffff' },
    toggleThumbActiveDark: { transform: [{ translateX: 20 }], backgroundColor: '#0f172a' },
  });
