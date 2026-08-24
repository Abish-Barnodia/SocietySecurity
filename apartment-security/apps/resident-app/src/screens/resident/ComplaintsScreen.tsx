import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useComplaints, Complaint, ComplaintStatus } from '../../context/ComplaintsContext';
import { useTheme } from '../../context/ThemeContext';
import { categoryMeta, statusLabel, priorityLabel, STATUS_COLOR_KEY, PRIORITY_COLOR_KEY, STATUS_OPTIONS } from '../../constants/complaints';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

export default function ComplaintsScreen({ navigation }: { navigation: any }) {
  const { complaints, loading, error, fetchComplaints, lastFetchedAt } = useComplaints();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchedAt.current > 30000) fetchComplaints();
    }, [fetchComplaints, lastFetchedAt])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchComplaints();
    setRefreshing(false);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of complaints) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [complaints]);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [complaints, statusFilter, query]);

  const renderItem = ({ item }: { item: Complaint }) => {
    const category = categoryMeta(item.category);
    const statusColor = colors[STATUS_COLOR_KEY[item.status]];
    const priorityColor = colors[PRIORITY_COLOR_KEY[item.priority]];

    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ComplaintDetail', { complaintId: item.id })}>
        <View style={styles.cardIcon}>
          <Ionicons name={category.icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta}>{category.label} · {formatDate(item.createdAt)}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel(item.status)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${priorityColor}22` }]}>
              <Text style={[styles.badgeText, { color: priorityColor }]}>{priorityLabel(item.priority)}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complaints</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CreateComplaint')}>
          <Ionicons name="add" size={22} color={colors.card} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search complaints"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_OPTIONS}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const active = statusFilter === item.value;
          const count = statusCounts[item.value] ?? 0;
          return (
            <TouchableOpacity
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(active ? null : item.value)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
              <View style={[styles.filterChipCount, active && styles.filterChipCountActive]}>
                <Text style={[styles.filterChipCountText, active && styles.filterChipCountTextActive]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {loading && complaints.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchComplaints()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="chatbox-ellipses-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {complaints.length === 0 ? 'No complaints yet' : 'No complaints match your search'}
              </Text>
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      marginHorizontal: 16,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text },
    filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    filterChipTextActive: { color: colors.card },
    filterChipCount: {
      backgroundColor: colors.background,
      borderRadius: 8,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      marginLeft: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
    filterChipCountText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
    filterChipCountTextActive: { color: colors.card },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    loader: { marginTop: 60 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
    badgeRow: { flexDirection: 'row', gap: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyText: { color: colors.textMuted, marginTop: 12, textAlign: 'center' },
    errorText: { color: colors.danger, textAlign: 'center', marginBottom: 12 },
    retryButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    retryButtonText: { color: colors.card, fontWeight: '700' },
  });
