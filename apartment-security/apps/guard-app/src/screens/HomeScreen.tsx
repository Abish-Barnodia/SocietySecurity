import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { colors } from '../theme/colors';

type RecentEntry = {
  id: string;
  visitorName: string;
  entryAt: string;
  unit: { unitNumber: string; tower: string | null };
  entryPoint: { name: string };
};

type Tab = 'scan' | 'walkin' | 'directory' | 'alerts';

const QUICK_ACTIONS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; tint: 'primary' | 'success' | 'warning' | 'danger' }[] = [
  { key: 'scan', icon: 'scan-outline', title: 'Scan Pass', subtitle: 'Verify visitor QR or OTP', tint: 'primary' },
  { key: 'directory', icon: 'id-card-outline', title: 'Look Up Resident', subtitle: 'Search directory', tint: 'success' },
  { key: 'walkin', icon: 'person-add-outline', title: 'Log Visitor', subtitle: 'Walk-in registration', tint: 'warning' },
  { key: 'alerts', icon: 'warning-outline', title: 'Raise Alert', subtitle: 'Report incident', tint: 'danger' },
];

const TINTS = {
  primary: { bg: colors.primaryLight, fg: colors.primary },
  success: { bg: colors.successLight, fg: colors.success },
  warning: { bg: colors.warningLight, fg: colors.warning },
  danger: { bg: colors.dangerLight, fg: colors.danger },
};

type Stats = { walkInApprovals: number; openIncidents: number; unackedAlerts: number };

const STAT_TILES: { key: keyof Stats; icon: keyof typeof Ionicons.glyphMap; label: string; tint: 'primary' | 'danger' }[] = [
  { key: 'walkInApprovals', icon: 'person-add-outline', label: 'Walk-In Approvals', tint: 'primary' },
  { key: 'openIncidents', icon: 'alert-circle-outline', label: 'Open Incidents', tint: 'danger' },
  { key: 'unackedAlerts', icon: 'warning-outline', label: "Unack'd Alerts", tint: 'danger' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { guardProfile, logout } = useAuth();
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEntries = useCallback(async () => {
    try {
      const [entriesRes, walkinRes, incidentsRes, alertsRes] = await Promise.all([
        api.get('/entries/recent'),
        api.get('/walkins/pending'),
        api.get('/incidents'),
        api.get('/alerts'),
      ]);
      setEntries(entriesRes.data.data ?? []);
      const incidents: { status: string }[] = incidentsRes.data.data ?? [];
      const alerts: { status: string }[] = alertsRes.data.data ?? [];
      setStats({
        walkInApprovals: (walkinRes.data.data ?? []).length,
        openIncidents: incidents.filter((i) => i.status === 'OPEN').length,
        unackedAlerts: alerts.filter((a) => a.status === 'SENT').length,
      });
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
        <View>
          <Text style={styles.greeting}>{greeting()}, {guardProfile?.name}</Text>
          <Text style={styles.property}>{guardProfile?.propertyName}</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.dutyPill}>
            <View style={styles.dutyDot} />
            <Text style={styles.dutyPillText}>On duty</Text>
          </View>
          <TouchableOpacity onPress={logout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

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

      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
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
        <Text style={styles.sectionLabel}>RECENT CLEARANCES</Text>
        <TouchableOpacity onPress={() => onNavigate('scan')}>
          <Text style={styles.scanNew}>Scan New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loadingSpinner} />
      ) : entries.length === 0 ? (
        <Text style={styles.emptyText}>No clearances yet on this shift.</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.entryRow}>
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
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 18, fontWeight: '800', color: colors.text },
  property: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dutyPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successLight,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  dutyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 6 },
  dutyPillText: { fontSize: 12, fontWeight: '700', color: colors.success },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statTile: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 12,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  scanNew: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  tile: {
    width: '47%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 16,
  },
  tileIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  tileSubtitle: { fontSize: 12, color: colors.textMuted },

  loadingSpinner: { marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 16 },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 10,
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
