import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Modal, FlatList, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemeColors } from '../theme/colors';
import { TranslationKey } from '../i18n/translations';
import { useAuth } from '@apartment-security/shared-auth';
import PieChart from '../components/PieChart';

type EntryMethod = 'QR_SCAN' | 'OTP' | 'MANUAL_GUARD' | 'VEHICLE_ANPR';

type ShiftSummary = {
  startedAt: string;
  totalEntries: number;
  totalIncidents: number;
  entryBreakdown: { method: EntryMethod; count: number }[];
};

type RosterGuard = { id: string; name: string; badgeNumber: string; isOnDuty: boolean };

const METHOD_LABEL_KEY: Record<EntryMethod, TranslationKey> = {
  QR_SCAN: 'handover_methodQrScan',
  OTP: 'handover_methodOtp',
  MANUAL_GUARD: 'handover_methodWalkin',
  VEHICLE_ANPR: 'handover_methodVehicle',
};

const formatDuration = (startedAt: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function ShiftHandoverScreen({ onNavigate }: { onNavigate: (tab: 'home') => void }) {
  const { refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    console.log('🛡️ [Guard Component: ShiftHandoverScreen] Mounted');
  }, []);

  const METHOD_COLOR: Record<EntryMethod, string> = {
    QR_SCAN: colors.primary,
    OTP: colors.success,
    MANUAL_GUARD: colors.warning,
    VEHICLE_ANPR: colors.danger,
  };

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [roster, setRoster] = useState<RosterGuard[]>([]);
  const [notOnShift, setNotOnShift] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<RosterGuard | null>(null);
  const [handoverNote, setHandoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRes, rosterRes] = await Promise.all([
        api.get('/guards/shift/summary').catch((err) => {
          if (err.response?.status === 400) { setNotOnShift(true); return null; }
          throw err;
        }),
        api.get('/guards/roster'),
      ]);
      if (summaryRes) {
        setNotOnShift(false);
        setSummary(summaryRes.data.data);
      }
      setRoster(rosterRes.data.data ?? []);
    } catch (error) {
      console.error('Failed to load shift summary:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleConfirm = async () => {
    if (!selectedGuard) return;
    setSubmitting(true);
    try {
      await api.post('/guards/shift/end', {
        handedOverToId: selectedGuard.id,
        handoverNote: handoverNote.trim() || undefined,
      });
      await refreshProfile();
      Alert.alert(t('handover_shiftEndedTitle'), t('handover_shiftEndedMsg', { name: selectedGuard.name }), [
        { text: t('common_ok'), onPress: () => onNavigate('home') },
      ]);
    } catch (error: any) {
      Alert.alert(t('common_error'), error.response?.data?.message ?? t('handover_endFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (notOnShift) {
    return (
      <View style={styles.centered}>
        <Ionicons name="moon-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>{t('handover_notOnShiftTitle')}</Text>
        <Text style={styles.emptyText}>{t('handover_notOnShiftSub')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('handover_title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >

        {summary && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t('handover_shiftStarted')}</Text>
              <Text style={styles.cardValue}>
                {new Date(summary.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
              <Text style={styles.cardSub}>{t('handover_duration', { d: formatDuration(summary.startedAt) })}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{summary.totalEntries}</Text>
                <Text style={styles.statLabel}>{t('handover_visitorsCheckedIn')}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{summary.totalIncidents}</Text>
                <Text style={styles.statLabel}>{t('handover_incidentsLogged')}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>{t('handover_entriesByType')}</Text>
            {summary.totalEntries === 0 ? (
              <Text style={styles.emptyText}>{t('handover_noVisitorsYet')}</Text>
            ) : (
              <View style={styles.chartRow}>
                <PieChart
                  data={summary.entryBreakdown.map((e) => ({
                    label: t(METHOD_LABEL_KEY[e.method]),
                    value: e.count,
                    color: METHOD_COLOR[e.method],
                  }))}
                />
                <View style={styles.legend}>
                  {summary.entryBreakdown.map((e) => (
                    <View key={e.method} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: METHOD_COLOR[e.method] }]} />
                      <Text style={styles.legendText}>{t(METHOD_LABEL_KEY[e.method])}</Text>
                      <Text style={styles.legendCount}>{e.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionLabel}>{t('handover_handOverTo')}</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setPickerOpen(true)}>
          <Text style={{ color: selectedGuard ? colors.text : colors.textMuted, fontSize: 15 }}>
            {selectedGuard ? `${selectedGuard.name} (#${selectedGuard.badgeNumber})` : t('handover_selectGuard')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t('handover_notesLabel')}</Text>
        <TextInput
          style={styles.notesInput}
          placeholder={t('handover_notesPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={handoverNote}
          onChangeText={setHandoverNote}
          multiline
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.confirmButton, !selectedGuard && { opacity: 0.5 }]}
          onPress={handleConfirm}
          disabled={!selectedGuard || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.confirmButtonText}>{t('handover_confirmButton')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalSheet}>
            {roster.length === 0 ? (
              <Text style={{ padding: 20, color: colors.textMuted }}>{t('handover_noGuardsFound')}</Text>
            ) : (
              <FlatList
                data={roster}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => { setSelectedGuard(item); setPickerOpen(false); }}
                  >
                    <View>
                      <Text style={styles.modalItemText}>{item.name}</Text>
                      <Text style={styles.modalItemSub}>#{item.badgeNumber} · {item.isOnDuty ? t('profile_onDuty') : t('profile_offDuty')}</Text>
                    </View>
                    {item.id === selectedGuard?.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 },

  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  cardLabel: { fontSize: 12, color: colors.textMuted },
  cardValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  cardSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statTile: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 14, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },

  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 8 },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 13, color: colors.text },
  legendCount: { fontSize: 13, fontWeight: '700', color: colors.text },

  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, marginBottom: 4,
  },
  notesInput: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, fontSize: 14, color: colors.text,
    height: 90, textAlignVertical: 'top',
  },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  confirmButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: colors.card, fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingVertical: 8 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  modalItemText: { fontSize: 15, fontWeight: '600', color: colors.text },
  modalItemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
