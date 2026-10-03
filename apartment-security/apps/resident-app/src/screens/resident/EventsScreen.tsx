import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useEvents, EventItem, RsvpStatus } from '../../context/EventsContext';
import { useTheme } from '../../context/ThemeContext';

const formatRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateStr = start.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${startTime} - ${endTime}`;
};

const RSVP_OPTIONS: { value: RsvpStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'GOING', label: 'Going', icon: 'checkmark-circle-outline' },
  { value: 'MAYBE', label: 'Maybe', icon: 'help-circle-outline' },
  { value: 'DECLINED', label: "Can't Go", icon: 'close-circle-outline' },
];

export default function EventsScreen() {
  const navigation = useNavigation();
  const { events, loading, fetchEvents, rsvp, lastFetchedAt } = useEvents();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpingId, setRsvpingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchedAt.current > 30000) fetchEvents();
    }, [fetchEvents, lastFetchedAt])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const handleRsvp = async (eventId: string, status: RsvpStatus) => {
    setRsvpingId(eventId);
    try {
      await rsvp(eventId, status);
    } finally {
      setRsvpingId(null);
    }
  };

  const renderItem = ({ item }: { item: EventItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconBox}>
          <Ionicons name="calendar-outline" size={24} color={colors.text} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>{formatRange(item.startDate, item.endDate)}</Text>
          {!!item.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.locationText}>{item.location}</Text>
            </View>
          )}
        </View>
      </View>

      {!!item.description && <Text style={styles.description}>{item.description}</Text>}

      <View style={styles.rsvpRow}>
        {RSVP_OPTIONS.map((opt) => {
          const active = item.myRsvp === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.rsvpButton, active && styles.rsvpButtonActive]}
              onPress={() => handleRsvp(item.id, opt.value)}
              disabled={rsvpingId === item.id}
            >
              <Ionicons name={opt.icon} size={14} color={active ? (isDark ? '#0f172a' : '#ffffff') : colors.textMuted} />
              <Text style={[styles.rsvpText, active && styles.rsvpTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.rsvpCount}>{item.rsvpCount} resident{item.rsvpCount === 1 ? '' : 's'} attending</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Society Events</Text>
          <Text style={styles.headerSubtitle}>Community gatherings, festivals, and celebrations</Text>
        </View>
      </View>

      {loading && events.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Events Scheduled</Text>
              <Text style={styles.emptyText}>Upcoming society meetings and festivals will appear here.</Text>
            </View>
          }
        />
      )}
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
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    cardIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
    cardMeta: { fontSize: 12, color: colors.textMuted },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    locationText: { fontSize: 12, color: colors.textMuted },
    description: { fontSize: 13, color: colors.text, marginBottom: 12, lineHeight: 18 },

    rsvpRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    rsvpButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    rsvpButtonActive: {
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      borderColor: isDark ? '#ffffff' : '#0f172a',
    },
    rsvpText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    rsvpTextActive: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },
    rsvpCount: { fontSize: 11, color: colors.textMuted, marginTop: 8 },

    centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyIconBox: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  });
