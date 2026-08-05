import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import { ThemeColors } from '../theme/colors';
import GuardProfileModal, { GuardMe } from '../components/GuardProfileModal';
import EntryDetailModal, { EntryDetail } from '../components/EntryDetailModal';

type RecentEntry = EntryDetail;

type Tab = 'scan' | 'walkin' | 'handover' | 'alerts';

type Tint = 'primary' | 'success' | 'warning' | 'danger';

type Stats = { walkInApprovals: number; openIncidents: number; unackedAlerts: number };

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'home_greetingMorning' as const;
  if (hour < 17) return 'home_greetingAfternoon' as const;
  return 'home_greetingEvening' as const;
}

export default function HomeScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { guardProfile, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);

  const TINTS: Record<Tint, { bg: string; fg: string }> = {
    primary: { bg: colors.primaryLight, fg: colors.primary },
    success: { bg: colors.successLight, fg: colors.success },
    warning: { bg: colors.warningLight, fg: colors.warning },
    danger: { bg: colors.dangerLight, fg: colors.danger },
  };

  const QUICK_ACTIONS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; tint: Tint }[] = [
    { key: 'scan', icon: 'scan-outline', title: t('home_scanPassTitle'), subtitle: t('home_scanPassSubtitle'), tint: 'primary' },
    { key: 'handover', icon: 'swap-horizontal-outline', title: t('home_handoverTitle'), subtitle: t('home_handoverSubtitle'), tint: 'primary' },
    { key: 'walkin', icon: 'person-add-outline', title: t('home_logVisitorTitle'), subtitle: t('home_logVisitorSubtitle'), tint: 'primary' },
    { key: 'alerts', icon: 'warning-outline', title: t('home_raiseAlertTitle'), subtitle: t('home_raiseAlertSubtitle'), tint: 'danger' },
  ];

  const STAT_TILES: { key: keyof Stats; icon: keyof typeof Ionicons.glyphMap; label: string; tint: Tint }[] = [
    { key: 'walkInApprovals', icon: 'person-add-outline', label: t('home_walkInApprovals'), tint: 'primary' },
    { key: 'openIncidents', icon: 'alert-circle-outline', label: t('home_openIncidents'), tint: 'primary' },
    { key: 'unackedAlerts', icon: 'notifications-outline', label: t('home_unackedAlerts'), tint: 'primary' },
  ];

  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [guardMe, setGuardMe] = useState<GuardMe | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RecentEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEntries();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
            <TouchableOpacity onPress={logout} hitSlop={8}>
              <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.greeting}>{t(greetingKey())}, {guardProfile?.name}</Text>
        <Text style={styles.property}>{guardProfile?.propertyName}</Text>
      </View>

      <GuardProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} profile={guardMe} />

      {stats && (
        <View style={styles.statsRow}>
          {STAT_TILES.map((stat) => (
            <View key={stat.key} style={styles.statTile}>
              <View style={[styles.statIcon, { backgroundColor: TINTS[stat.tint].bg }]}>
                <Ionicons name={stat.icon} size={18} color={TINTS[stat.tint].fg} />
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stats[stat.key]}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('home_quickActions')}</Text>
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.tile}
            activeOpacity={0.8}
            onPress={() => onNavigate(action.key)}
          >
            <View style={[styles.tileIcon, { backgroundColor: TINTS[action.tint].bg }]}>
              <Ionicons name={action.icon} size={24} color={TINTS[action.tint].fg} />
            </View>
            <Text style={styles.tileTitle}>{action.title}</Text>
            <Text style={styles.tileSubtitle}>{action.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>{t('home_recentClearances')}</Text>
        <TouchableOpacity onPress={() => onNavigate('scan')}>
          <Text style={styles.scanNew}>{t('home_scanNew')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loadingSpinner} />
      ) : entries.length === 0 ? (
        <Text style={styles.emptyText}>{t('home_noClearances')}</Text>
      ) : (
        entries.map((entry) => (
          <TouchableOpacity key={entry.id} style={styles.entryRow} activeOpacity={0.7} onPress={() => setSelectedEntry(entry)}>
            <View style={styles.entryCheck}>
              <Ionicons name="checkmark" size={16} color={colors.success} />
            </View>
            <View style={styles.entryInfo}>
              <Text style={styles.entryName}>{entry.visitorName}</Text>
              <Text style={styles.entryMeta}>
                {entry.unit.tower ? `Tower ${entry.unit.tower} - ` : ''}{entry.unit.unitNumber} — {entry.entryPoint.name}
              </Text>
            </View>
            <Text style={styles.entryTime}>
              {new Date(entry.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <EntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  header: {
    backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 24,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  themeToggle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  greeting: { fontSize: 18, fontWeight: '800', color: colors.text },
  property: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24, paddingHorizontal: 20 },
  statTile: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 12,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 12, paddingHorizontal: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingHorizontal: 20 },
  scanNew: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8, paddingHorizontal: 20 },
  tile: {
    width: '47%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 16,
  },
  tileIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  tileSubtitle: { fontSize: 12, color: colors.textMuted },

  loadingSpinner: { marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 10, marginHorizontal: 20,
  },
  entryCheck: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.successLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '700', color: colors.text },
  entryMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  entryTime: { fontSize: 12, color: colors.textMuted },
});
