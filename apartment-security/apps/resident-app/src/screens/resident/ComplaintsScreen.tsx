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
import { categoryMeta, statusLabel, priorityLabel, STATUS_OPTIONS } from '../../constants/complaints';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

export default function ComplaintsScreen({ navigation }: { navigation: any }) {
  const { complaints, loading, error, fetchComplaints, lastFetchedAt } = useComplaints();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

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

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ComplaintDetail', { complaintId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIconBox}>
            <Ionicons name={category.icon as any} size={22} color={colors.text} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.cardMeta}>{category.label} · {formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{priorityLabel(item.priority)} Priority</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Helpdesk & Complaints</Text>
          <Text style={styles.headerSubtitle}>Raise tickets, report issues, and track resolutions</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CreateComplaint')}>
          <Ionicons name="add" size={22} color={isDark ? '#000' : '#fff'} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets, issues..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
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
      </View>

      {loading && complaints.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="chatbox-ellipses-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Complaints Found</Text>
              <Text style={styles.emptyText}>
                {complaints.length === 0 ? 'No complaints have been filed yet.' : 'No tickets match your filter criteria.'}
              </Text>
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
      paddingBottom: 14,
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
    addButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    searchContainer: {
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: colors.text },
    filterSection: { marginBottom: 12 },
    filterRow: { paddingHorizontal: 20, gap: 8 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#ffffff' : '#0f172a' },
    filterChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    filterChipTextActive: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },
    filterChipCount: {
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      marginLeft: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipCountActive: { backgroundColor: isDark ? '#e2e8f0' : '#334155' },
    filterChipCountText: { fontSize: 11, fontWeight: '700', color: colors.text },
    filterChipCountTextActive: { color: isDark ? '#0f172a' : '#ffffff' },

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
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
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
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
    badgeRow: { flexDirection: 'row', gap: 8, paddingTop: 4 },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.text },

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
    errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 12 },
    retryButton: {
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
    },
    retryButtonText: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },
  });
