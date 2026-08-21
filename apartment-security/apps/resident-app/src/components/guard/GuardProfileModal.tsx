import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/colors';
import { LANGUAGES } from '../../i18n/translations';
import api from '../../utils/api';

export type GuardMe = {
  name: string;
  badgeNumber: string;
  phone: string | null;
  email: string | null;
  isOnDuty: boolean;
  propertyName: string;
  shiftStartedAt: string | null;
  currentPostName: string | null;
};

// Fetches its own /guards/me on open instead of depending on HomeScreen's
// dashboard-load prop — opening the profile shouldn't wait on 4 unrelated endpoints.
export default function GuardProfileModal({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  const { logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const styles = getStyles(colors);
  const [profile, setProfile] = useState<GuardMe | null>(null);

  useEffect(() => {
    if (!visible) return;
    api.get('/guards/me').then((res) => setProfile(res.data.data ?? null)).catch(() => {});
  }, [visible]);

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('profile_title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!profile ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{profile.name}</Text>
            <View style={[styles.statusPill, profile.isOnDuty ? styles.statusPillOn : styles.statusPillOff]}>
              <View style={[styles.statusDot, { backgroundColor: profile.isOnDuty ? colors.success : colors.textMuted }]} />
              <Text style={[styles.statusPillText, { color: profile.isOnDuty ? colors.success : colors.textMuted }]}>
                {profile.isOnDuty ? t('profile_onDuty') : t('profile_offDuty')}
              </Text>
            </View>

            <View style={styles.card}>
              <Row label={t('profile_badgeNumber')} value={profile.badgeNumber} />
              <Row label={t('profile_phone')} value={profile.phone ?? '—'} />
              <Row label={t('profile_email')} value={profile.email ?? '—'} />
              <Row label={t('profile_property')} value={profile.propertyName} />
              {profile.isOnDuty && (
                <>
                  <Row label={t('profile_currentPost')} value={profile.currentPostName ?? '—'} />
                  <Row
                    label={t('profile_onDutySince')}
                    value={profile.shiftStartedAt
                      ? new Date(profile.shiftStartedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  />
                </>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('profile_darkMode')}</Text>
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ true: colors.primary, false: colors.border }} />
              </View>
              <View style={[styles.row, { borderBottomWidth: 0 }]}>
                <Text style={styles.rowLabel}>{t('profile_language')}</Text>
                <View style={styles.languageRow}>
                  {LANGUAGES.map((lang) => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[styles.languagePill, language === lang.code && styles.languagePillActive]}
                      onPress={() => setLanguage(lang.code)}
                    >
                      <Text style={[styles.languagePillText, language === lang.code && styles.languagePillTextActive]}>
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={styles.logoutText}>{t('profile_logout')}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  content: { padding: 24, alignItems: 'center', paddingBottom: 40 },

  avatarLarge: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarLargeText: { fontSize: 28, fontWeight: '800', color: colors.white },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },

  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 24 },
  statusPillOn: { backgroundColor: colors.successLight },
  statusPillOff: { backgroundColor: colors.border },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  statusPillText: { fontSize: 13, fontWeight: '700' },

  card: {
    width: '100%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 16,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.text },

  languageRow: { flexDirection: 'row', gap: 8 },
  languagePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  languagePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  languagePillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  languagePillTextActive: { color: colors.white },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.dangerLight,
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
