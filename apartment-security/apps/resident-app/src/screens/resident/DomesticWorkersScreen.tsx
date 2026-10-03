import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDomesticWorkers, DomesticWorker } from '../../context/DomesticWorkersContext';
import { useTheme } from '../../context/ThemeContext';
import { workerTypeMeta, formatWorkingDays } from '../../constants/domesticWorkers';

export default function DomesticWorkersScreen() {
  const navigation = useNavigation<any>();
  const { workers, loading, error, fetchWorkers, deleteWorker, lastFetchedAt } = useDomesticWorkers();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchedAt.current > 30000) fetchWorkers();
    }, [fetchWorkers, lastFetchedAt])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchWorkers();
    setRefreshing(false);
  };

  const handleDelete = (worker: DomesticWorker) => {
    Alert.alert('Remove Worker', `Are you sure you want to remove ${worker.name} from your registered staff?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteWorker(worker.id).catch(() => Alert.alert('Error', 'Failed to remove worker.')),
      },
    ]);
  };

  const renderItem = ({ item }: { item: DomesticWorker }) => {
    const meta = workerTypeMeta(item.type);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('WorkerForm', { workerId: item.id })}
      >
        <View style={styles.cardHeader}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarBox}>
              <Ionicons name={meta.icon as any} size={22} color={colors.text} />
            </View>
          )}
          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{meta.label}</Text>
            </View>
            <Text style={styles.cardMeta}>{item.phone}</Text>
            <Text style={styles.cardMeta}>{formatWorkingDays(item.workingDays)} · {item.entryTime}–{item.exitTime}</Text>
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
          <Text style={styles.headerTitle}>Daily Help & Staff</Text>
          <Text style={styles.headerSubtitle}>Housekeeping, cooks, drivers, and gardeners</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('WorkerForm', {})}>
          <Ionicons name="add" size={22} color={isDark ? '#000' : '#fff'} />
        </TouchableOpacity>
      </View>

      {loading && workers.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchWorkers()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="people-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Staff Registered</Text>
              <Text style={styles.emptyText}>Register domestic help, drivers, or tutors for fast gate verification.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('WorkerForm', {})}>
                <Text style={styles.primaryBtnText}>Add Domestic Worker</Text>
              </TouchableOpacity>
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
    addButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
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
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
    avatarBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 14,
      marginRight: 14,
      backgroundColor: colors.border,
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    typeBadge: {
      alignSelf: 'flex-start',
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 4,
      marginBottom: 6,
    },
    typeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    deleteButton: { padding: 4 },

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
    emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 16 },
    primaryBtn: {
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    primaryBtnText: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700', fontSize: 14 },
    errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 12 },
    retryButton: {
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
    },
    retryButtonText: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },
  });
