import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemeColors } from '../theme/colors';
import { TranslationKey } from '../i18n/translations';
import VehicleAlertModal from '../components/VehicleAlertModal';

type Priority = 'P1' | 'P2' | 'P3';

type AlertItem = {
  id: string;
  priority: Priority;
  title: string;
  body: string;
  status: 'SENT' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';
  acknowledgedAt: string | null;
  createdAt: string;
  imageUrl?: string | null;
};

type FilterKey = 'ALL' | Priority | 'VEHICLE';

// Alert has no dedicated "vehicle" category — a vehicle incident is just a
// SECURITY_BREACH alert whose text mentions a vehicle, so filter on that.
const isVehicleAlert = (a: AlertItem) => /vehicle/i.test(a.title) || /vehicle/i.test(a.body);

const cleanTitle = (title: string) => title.replace(/^\[[A-Z_]+\]\s*/, '');

export default function AlertsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'ALL', label: t('alerts_filterAll') },
    { key: 'P1', label: 'P1' },
    { key: 'P2', label: 'P2' },
    { key: 'P3', label: 'P3' },
    { key: 'VEHICLE', label: t('alerts_filterVehicle') },
  ];

  const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string; labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap }> = {
    P1: { bg: colors.dangerLight, fg: colors.danger, labelKey: 'alerts_priority1', icon: 'alert-circle' },
    P2: { bg: colors.warningLight, fg: colors.warning, labelKey: 'alerts_priority2', icon: 'warning' },
    P3: { bg: colors.primaryLight, fg: colors.primary, labelKey: 'alerts_priority3', icon: 'notifications-outline' },
  };

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [ackingId, setAckingId] = useState<string | null>(null);

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data.data ?? []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const unackedCount = useMemo(() => alerts.filter((a) => !a.acknowledgedAt).length, [alerts]);

  const counts = useMemo(() => ({
    ALL: alerts.length,
  }), [alerts]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return alerts;
    if (filter === 'VEHICLE') return alerts.filter(isVehicleAlert);
    return alerts.filter((a) => a.priority === filter);
  }, [alerts, filter]);

  const handleAcknowledge = async (id: string) => {
    setAckingId(id);
    const prev = alerts;
    setAlerts((cur) => cur.map((a) => (a.id === id ? { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date().toISOString() } : a)));
    try {
      await api.put(`/alerts/${id}/acknowledge`);
    } catch (error) {
      setAlerts(prev);
      Alert.alert(t('common_error'), t('alerts_ackFailedMsg'));
    } finally {
      setAckingId(null);
    }
  };

  const handleVehicleAlertSent = () => {
    setVehicleModalOpen(false);
    Alert.alert(t('alerts_vehicleSentTitle'), t('alerts_vehicleSentMsg'));
    loadAlerts();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('alerts_title')}</Text>
        {unackedCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{unackedCount}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.vehicleBanner} activeOpacity={0.85} onPress={() => setVehicleModalOpen(true)}>
        <View style={styles.vehicleBannerIcon}>
          <Ionicons name="car-outline" size={20} color={colors.danger} />
        </View>
        <Text style={styles.vehicleBannerText}>{t('alerts_sendVehicleAlert')}</Text>
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}{f.key === 'ALL' ? ` (${counts.ALL})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('alerts_noAlerts')}</Text>
          </View>
        ) : (
          filtered.map((alert) => {
            const style = PRIORITY_STYLE[alert.priority];
            const acknowledged = !!alert.acknowledgedAt;
            return (
              <View key={alert.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: style.fg }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardIconWrap, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon} size={20} color={style.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.cardPriority, { color: style.fg }]}>{t(style.labelKey)}</Text>
                      <Text style={styles.cardTime}>
                        {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.cardTitle}>{cleanTitle(alert.title)}</Text>
                  </View>
                  {!acknowledged && <View style={[styles.unreadDot, { backgroundColor: style.fg }]} />}
                </View>
                <Text style={styles.cardBody}>{alert.body}</Text>
                {alert.imageUrl && (
                  <Image source={{ uri: alert.imageUrl }} style={styles.cardImage} />
                )}

                {acknowledged ? (
                  <View style={styles.acknowledgedRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 6 }} />
                    <Text style={styles.acknowledgedText}>{t('alerts_acknowledged')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.ackButton, { backgroundColor: style.fg + '22' }]}
                    onPress={() => handleAcknowledge(alert.id)}
                    disabled={ackingId === alert.id}
                  >
                    {ackingId === alert.id ? (
                      <ActivityIndicator color={style.fg} size="small" />
                    ) : (
                      <Text style={[styles.ackButtonText, { color: style.fg }]}>{t('alerts_acknowledge')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <VehicleAlertModal
        visible={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        onSent={handleVehicleAlertSent}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 10 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  headerBadge: { backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  headerBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  vehicleBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger + '33',
    borderRadius: 16, padding: 14, marginHorizontal: 20, marginTop: 14,
  },
  vehicleBannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  vehicleBannerText: { flex: 1, color: colors.danger, fontSize: 14, fontWeight: '700' },

  filterRow: { marginTop: 14, flexGrow: 0 },
  chip: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },

  list: { flex: 1, marginTop: 14 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },

  emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14 },

  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 12, backgroundColor: colors.card },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  cardIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 6, flexShrink: 0 },
  cardPriority: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  cardTime: { fontSize: 12, color: colors.textMuted, marginLeft: 'auto' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4, lineHeight: 20 },
  cardBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 12 },
  cardImage: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  ackButton: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ackButtonText: { fontSize: 14, fontWeight: '700' },
  acknowledgedRow: { flexDirection: 'row', alignItems: 'center' },
  acknowledgedText: { fontSize: 13, fontWeight: '600', color: colors.success },
});
