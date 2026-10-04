import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Alert, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemeColors } from '../theme/colors';
import { TranslationKey } from '../i18n/translations';
import VehicleAlertModal from '../components/VehicleAlertModal';
import IncidentAlertModal from '../components/IncidentAlertModal';
import { AlertsSkeletonList } from '../components/SkeletonLoader';

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

// ponytail: unified AlertsScreen with clickable full-screen photos, expandable body & resident-app UI theme
export default function AlertsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'ALL', label: t('alerts_filterAll') },
    { key: 'P1', label: 'P1' },
    { key: 'P2', label: 'P2' },
    { key: 'P3', label: 'P3' },
    { key: 'VEHICLE', label: t('alerts_filterVehicle') },
  ];

  const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string; labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap }> = {
    P1: { bg: colors.dangerLight, fg: colors.danger, labelKey: 'alerts_priority1', icon: 'alert-circle-outline' },
    P2: { bg: colors.warningLight, fg: colors.warning, labelKey: 'alerts_priority2', icon: 'warning-outline' },
    P3: { bg: colors.primaryLight, fg: colors.textMuted, labelKey: 'alerts_priority3', icon: 'notifications-outline' },
  };

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  useEffect(() => {
    console.log('🛡️ [Guard Component: AlertsScreen] Mounted');
    loadAlerts();
  }, [loadAlerts]);

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

  const handleIncidentAlertSent = (audience?: string) => {
    setIncidentModalOpen(false);
    let msg = t('incident_sent_msg');
    if (audience === 'MANAGERS') {
      msg = 'The alert has been sent directly to the Manager Portal.';
    } else if (audience === 'RESIDENTS') {
      msg = 'The alert has been sent to all residents.';
    }
    Alert.alert(t('incident_sent_title'), msg);
    loadAlerts();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>{t('alerts_title')}</Text>
            <Text style={styles.headerSubTitle}>
              {unackedCount > 0 ? `${unackedCount} unacknowledged alerts` : 'All caught up'} • {alerts.length} total
            </Text>
          </View>
          {unackedCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unackedCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Quick Action: Log Vehicle Issue Banner */}
      <TouchableOpacity style={styles.vehicleBanner} activeOpacity={0.8} onPress={() => setVehicleModalOpen(true)}>
        <View style={styles.vehicleBannerIcon}>
          <Ionicons name="car-outline" size={20} color={colors.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleBannerText}>{t('alerts_sendVehicleAlert')}</Text>
          <Text style={styles.vehicleBannerSub}>Notify residents about wrong parking or blocking</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.danger} />
      </TouchableOpacity>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}{f.key === 'ALL' ? ` (${counts.ALL})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Alerts List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {loading && !refreshing ? (
          <AlertsSkeletonList count={3} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{t('alerts_noAlerts')}</Text>
            <Text style={styles.emptyText}>All security notices and emergency broadcast logs will appear here.</Text>
          </View>
        ) : (
          filtered.map((alert) => {
            const priorityStyle = PRIORITY_STYLE[alert.priority];
            const acknowledged = !!alert.acknowledgedAt;
            const isExpanded = expandedIds.has(alert.id);
            const isLongMessage = (alert.body && alert.body.length > 70) || (alert.title && alert.title.length > 50);

            return (
              <View
                key={alert.id}
                style={[styles.card, !acknowledged && styles.cardUnread]}
              >
                {/* Top Row: Icon + Priority badge + Time */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => isLongMessage && toggleExpand(alert.id)}
                  style={styles.cardHeaderRow}
                >
                  <View style={styles.cardIconWrap}>
                    <Ionicons name={priorityStyle.icon} size={20} color={priorityStyle.fg} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleLine}>
                      <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
                        <Text style={[styles.priorityBadgeText, { color: priorityStyle.fg }]}>
                          {t(priorityStyle.labelKey)}
                        </Text>
                      </View>
                      <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} style={{ marginRight: 3 }} />
                        <Text style={styles.cardTime}>
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{cleanTitle(alert.title)}</Text>
                  </View>

                  {!acknowledged && <View style={styles.unreadDot} />}
                </TouchableOpacity>

                {/* Body Content: Clickable to expand/collapse whole message */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => toggleExpand(alert.id)}
                  style={styles.bodyTouchable}
                >
                  <Text
                    style={styles.cardBody}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {alert.body}
                  </Text>
                  {isLongMessage && (
                    <View style={styles.expandToggleRow}>
                      <Text style={styles.expandToggleText}>
                        {isExpanded ? t('alerts_showLess') : t('alerts_readMore')}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={13}
                        color={colors.primary}
                        style={{ marginLeft: 3 }}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Image Attachment: Clickable to view full photo */}
                {alert.imageUrl && (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setPreviewImageUrl(alert.imageUrl!)}
                    style={styles.imageWrap}
                  >
                    <Image source={{ uri: alert.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                    <View style={styles.imageOverlayBadge}>
                      <Ionicons name="expand-outline" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.imageOverlayText}>View full photo</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Footer Action */}
                <View style={styles.cardFooter}>
                  {acknowledged ? (
                    <View style={styles.acknowledgedRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 6 }} />
                      <Text style={styles.acknowledgedText}>{t('alerts_acknowledged')}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.ackButton}
                      activeOpacity={0.8}
                      onPress={() => handleAcknowledge(alert.id)}
                      disabled={ackingId === alert.id}
                    >
                      {ackingId === alert.id ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.ackButtonText}>{t('alerts_acknowledge')}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Action Button (+) to Report Incident */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setIncidentModalOpen(true)}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Fullscreen Photo Preview Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.fullImageBackdrop}>
          <SafeAreaView style={styles.fullImageSafeArea}>
            <View style={styles.fullImageTopBar}>
              <View style={styles.fullImageHeaderLeft}>
                <Ionicons name="image-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.fullImageTitle}>Photo Attachment</Text>
              </View>
              <TouchableOpacity
                style={styles.fullImageCloseBtn}
                onPress={() => setPreviewImageUrl(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.fullImageContent}
              activeOpacity={1}
              onPress={() => setPreviewImageUrl(null)}
            >
              {previewImageUrl && (
                <Image
                  source={{ uri: previewImageUrl }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullImageBottomBar}
              activeOpacity={0.8}
              onPress={() => setPreviewImageUrl(null)}
            >
              <Text style={styles.fullImageHint}>Tap anywhere to close</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      <VehicleAlertModal
        visible={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        onSent={handleVehicleAlertSent}
      />

      <IncidentAlertModal
        visible={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        onSent={handleIncidentAlertSent}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubTitle: { fontSize: 12, color: colors.textMuted, fontWeight: '500', marginTop: 2 },
  headerBadge: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },

  vehicleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: isDark ? colors.border : '#FEE2E2',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  vehicleBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleBannerText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  vehicleBannerSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  filterRow: { marginTop: 12, flexGrow: 0 },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white, fontWeight: '700' },

  list: { flex: 1, marginTop: 10 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24, gap: 8 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardUnread: {
    borderColor: isDark ? '#475569' : '#cbd5e1',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  cardTime: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 20 },

  bodyTouchable: {
    marginBottom: 10,
  },
  cardBody: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  expandToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  imageWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    position: 'relative',
  },
  cardImage: { width: '100%', height: 160 },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  fullImageBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullImageSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  fullImageTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  fullImageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullImageTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  fullImageCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImageContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fullImageBottomBar: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImageHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: isDark ? '#334155' : '#f1f5f9',
    paddingTop: 10,
    marginTop: 2,
  },
  ackButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  ackButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  acknowledgedRow: { flexDirection: 'row', alignItems: 'center' },
  acknowledgedText: { fontSize: 12, fontWeight: '700', color: colors.success },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginTop: 4,
  },
});
