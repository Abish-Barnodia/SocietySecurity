import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
  { value: 'GOING', label: 'Going', icon: 'checkmark-circle' },
  { value: 'MAYBE', label: 'Maybe', icon: 'help-circle' },
  { value: 'DECLINED', label: "Can't go", icon: 'close-circle' },
];

export default function EventsScreen() {
  const { events, loading, fetchEvents, rsvp } = useEvents();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpingId, setRsvpingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
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
        <View style={styles.cardIcon}>
          <Ionicons name="calendar" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>{formatRange(item.startDate, item.endDate)}</Text>
          {!!item.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.cardMeta}>{item.location}</Text>
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
              style={[styles.rsvpButton, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => handleRsvp(item.id, opt.value)}
              disabled={rsvpingId === item.id}
            >
              <Ionicons name={opt.icon} size={14} color={active ? colors.card : colors.textMuted} />
              <Text style={[styles.rsvpText, active && { color: colors.card }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.rsvpCount}>{item.rsvpCount} resident{item.rsvpCount === 1 ? '' : 's'} going</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
      </View>

      {loading && events.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No events scheduled</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    loader: { marginTop: 60 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', marginBottom: 8 },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    cardMeta: { fontSize: 12, color: colors.textMuted },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    description: { fontSize: 13, color: colors.text, marginBottom: 12, lineHeight: 18 },
    rsvpRow: { flexDirection: 'row', gap: 8 },
    rsvpButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    rsvpText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    rsvpCount: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
    centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyText: { color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  });
