import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import { getSocket } from '../utils/socket';
import { ThemeColors } from '../theme/colors';
import GuardProfileModal, { GuardMe } from '../components/GuardProfileModal';
import EntryDetailModal, { EntryDetail } from '../components/EntryDetailModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { GuardHomeSkeleton } from '../components/SkeletonLoader';

type RecentEntry = EntryDetail;

type Tab = 'scan' | 'walkin' | 'handover' | 'alerts' | 'chat';

type Tint = 'primary' | 'success' | 'warning' | 'danger';

type Stats = { walkInApprovals: number; openIncidents: number; unackedAlerts: number };

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'home_greetingMorning' as const;
  if (hour < 17) return 'home_greetingAfternoon' as const;
  return 'home_greetingEvening' as const;
}

// ponytail: unified Quick Actions and Recent Activity with resident-app design language
export default function HomeScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { guardProfile, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);

  useEffect(() => {
    console.log('🛡️ [Guard Component: HomeScreen] Mounted for guard:', guardProfile?.name ?? 'Guard');
  }, [guardProfile]);

  const QUICK_ACTIONS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; title: string }[] = [
    { key: 'scan', icon: 'scan-outline', title: t('home_scanPassTitle') },
    { key: 'chat', icon: 'chatbubbles-outline', title: t('home_residentChatTitle') },
    { key: 'walkin', icon: 'person-add-outline', title: t('home_logVisitorTitle') },
    { key: 'alerts', icon: 'warning-outline', title: t('home_raiseAlertTitle') },
    { key: 'handover', icon: 'swap-horizontal-outline', title: t('home_handoverTitle') },
  ];

  const STAT_TILES: { key: keyof Stats; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'walkInApprovals', icon: 'person-add-outline', label: t('home_walkInApprovals') },
    { key: 'openIncidents', icon: 'alert-circle-outline', label: t('home_openIncidents') },
    { key: 'unackedAlerts', icon: 'notifications-outline', label: t('home_unackedAlerts') },
  ];

  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [guardMe, setGuardMe] = useState<GuardMe | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RecentEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  const fetchUnreadDmCount = useCallback(async () => {
    try {
      const res = await api.get('/community/dm/summary/conversations');
      if (res.data?.data?.totalUnreadCount !== undefined) {
        setUnreadDmCount(res.data.data.totalUnreadCount);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUnreadDmCount();
    const interval = setInterval(fetchUnreadDmCount, 3000);
    return () => clearInterval(interval);
  }, [fetchUnreadDmCount]);

  useEffect(() => {
    let attachedSocket: any = null;
    const handleDmUpdate = () => {
      fetchUnreadDmCount();
    };

    const attach = () => {
      const socket = getSocket();
      if (socket && socket !== attachedSocket) {
        if (attachedSocket) {
          attachedSocket.off('dm:message', handleDmUpdate);
          attachedSocket.off('dm:read', handleDmUpdate);
          attachedSocket.off('dm:delete', handleDmUpdate);
        }
        attachedSocket = socket;
        socket.on('dm:message', handleDmUpdate);
        socket.on('dm:read', handleDmUpdate);
        socket.on('dm:delete', handleDmUpdate);
      }
    };

    attach();
    const checkInterval = setInterval(attach, 1000);

    return () => {
      clearInterval(checkInterval);
      if (attachedSocket) {
        attachedSocket.off('dm:message', handleDmUpdate);
        attachedSocket.off('dm:read', handleDmUpdate);
        attachedSocket.off('dm:delete', handleDmUpdate);
      }
    };
  }, [fetchUnreadDmCount]);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await logout();
    } finally {
      setIsLoggingOut(false);
      setLogoutModalVisible(false);
    }
  };

  const loadEntries = useCallback(async () => {
    try {
      const [entriesRes, walkinRes, incidentsRes, alertsRes, meRes] = await Promise.all([
        api.get('/entries/recent'),
        api.get('/walkins/pending'),
        api.get('/incidents'),
        api.get('/alerts'),
        api.get('/guards/me'),
      ]);
      setEntries(entriesRes.data.data ?? []);
      const incidents: { status: string }[] = incidentsRes.data.data ?? [];
      const alerts: { status: string }[] = alertsRes.data.data ?? [];
      setStats({
        walkInApprovals: (walkinRes.data.data ?? []).length,
        openIncidents: incidents.filter((i) => i.status === 'OPEN').length,
        unackedAlerts: alerts.filter((a) => a.status === 'SENT').length,
      });
      setGuardMe(meRes.data.data ?? null);
      setLoadError(false);
    } catch (error) {
      console.error(error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    fetchUnreadDmCount();
  }, [loadEntries, fetchUnreadDmCount]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEntries();
    fetchUnreadDmCount();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.profileChip} activeOpacity={0.7} onPress={() => setProfileOpen(true)}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>{(guardProfile?.name ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <View style={styles.dutyRow}>
                <View style={[styles.dutyDot, { backgroundColor: guardProfile?.isOnDuty ? colors.success : colors.textMuted }]} />
                <Text style={[styles.dutyPillText, { color: guardProfile?.isOnDuty ? colors.success : colors.textMuted }]}>
                  {guardProfile?.isOnDuty ? t('home_onDuty') : t('home_offDuty')}
                </Text>
              </View>
              <Text style={styles.postText}>{guardMe?.currentPostName ?? guardProfile?.propertyName}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme} hitSlop={8}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={isDark ? colors.text : colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLogoutModalVisible(true)} hitSlop={8}>
              <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.greeting}>{t(greetingKey())}, {guardProfile?.name}</Text>
        <Text style={styles.property}>{guardProfile?.propertyName}</Text>
      </View>

      <GuardProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} />

      <LogoutConfirmModal
        visible={logoutModalVisible}
        loading={isLoggingOut}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={handleConfirmLogout}
      />

      {loading && !refreshing ? (
        <GuardHomeSkeleton />
      ) : (
        <>
          {stats && (
            <View style={styles.metricsRow}>
              {STAT_TILES.map((stat, index) => (
                <React.Fragment key={stat.key}>
                  {index > 0 && <View style={styles.metricDivider} />}
                  <View style={styles.metricItem}>
                    <View style={styles.metricIconWrap}>
                      <Ionicons name={stat.icon} size={16} color={colors.text} />
                    </View>
                    <Text style={styles.metricNumber}>{stats[stat.key]}</Text>
                    <Text style={styles.metricLabel} numberOfLines={1}>{stat.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Quick Actions (matching resident app UI) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home_quickActions')}</Text>
          </View>

          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => {
              const isChat = action.key === 'chat';
              return (
                <TouchableOpacity
                  key={action.key}
                  style={styles.quickActionTile}
                  activeOpacity={0.75}
                  onPress={() => onNavigate(action.key)}
                >
                  {isChat && unreadDmCount > 0 && (
                    <View style={styles.quickActionBadgePillRed}>
                      <Text style={styles.quickActionBadgeText}>
                        {unreadDmCount > 99 ? '99+' : unreadDmCount}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.quickActionIconBox, isChat && unreadDmCount > 0 && { backgroundColor: isDark ? '#0284c725' : '#e0f2fe' }]}>
                    <Ionicons
                      name={action.icon}
                      size={24}
                      color={isChat && unreadDmCount > 0 ? colors.primary : colors.text}
                    />
                  </View>
                  <Text
                    style={[
                      styles.quickActionLabel,
                      isChat && unreadDmCount > 0 && { color: colors.primary, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {action.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Recent Activity Card with People in Row & Column */}
          <View style={[styles.sectionHeader, { marginTop: 10 }]}>
            <View style={styles.sectionHeaderTitleRow}>
              <Ionicons name="notifications-outline" size={17} color={colors.text} />
              <Text style={styles.sectionTitle}>{t('home_recentClearances')}</Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('scan')} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>{t('home_scanNew')} &gt;</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityCard}>
            {loadError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{t('common_loadFailed')}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadEntries}>
                  <Text style={styles.retryButtonText}>{t('common_retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : entries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('home_noClearances')}</Text>
              </View>
            ) : (
              <View style={styles.peopleGrid}>
                {entries.map((entry, index) => {
                  const avatarBg = ['#FEF3C7', '#E0F2FE', '#F3E8FF', '#DCFCE7', '#FEE2E2'][index % 5];
                  const avatarTextColor = ['#B45309', '#0284C7', '#7E22CE', '#15803D', '#B91C1C'][index % 5];
                  const initial = entry.visitorName ? entry.visitorName.charAt(0).toUpperCase() : 'V';

                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.personTile}
                      activeOpacity={0.7}
                      onPress={() => setSelectedEntry(entry)}
                    >
                      <View style={styles.avatarCircleWrapper}>
                        <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
                          <Text style={[styles.avatarInitials, { color: avatarTextColor }]}>{initial}</Text>
                        </View>
                        <View style={styles.avatarStatusDot} />
                      </View>
                      <View style={styles.personInfo}>
                        <Text style={styles.personName} numberOfLines={1}>{entry.visitorName}</Text>
                        <Text style={styles.personMeta} numberOfLines={1}>
                          {entry.unit.tower ? `T-${entry.unit.tower} • ` : ''}{entry.unit.unitNumber}
                        </Text>
                        <Text style={styles.personTime} numberOfLines={1}>
                          {new Date(entry.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      <EntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 12, paddingBottom: 36 },
  header: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  profileChip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSmall: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmallText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  dutyRow: { flexDirection: 'row', alignItems: 'center' },
  dutyDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  dutyPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  postText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeToggle: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? '#334155' : '#f1f5f9',
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  greeting: { fontSize: 20, fontWeight: '800', color: colors.text },
  property: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  metricDivider: { width: 1, height: 30, backgroundColor: colors.border },
  metricIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  metricNumber: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 },
  metricLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  seeAllText: { color: colors.text, fontSize: 13, fontWeight: '700' },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    rowGap: 14,
  },
  quickActionTile: {
    width: '23%',
    alignItems: 'center',
    position: 'relative',
  },
  quickActionBadgePillRed: {
    position: 'absolute',
    top: -6,
    right: 6,
    zIndex: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  quickActionBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },
  quickActionIconBox: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  personTile: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  avatarCircleWrapper: { position: 'relative' },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: { fontSize: 14, fontWeight: '800' },
  avatarStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: colors.card,
  },
  personInfo: { flex: 1 },
  personName: { fontSize: 13, fontWeight: '700', color: colors.text },
  personMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  personTime: { fontSize: 10, color: colors.textMuted, marginTop: 1, fontWeight: '600' },

  loadingSpinner: { marginVertical: 20 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.dangerLight, borderRadius: 12, padding: 12, gap: 12,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '600' },
  retryButton: { backgroundColor: colors.danger, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  retryButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});

