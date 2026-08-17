import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDomesticWorkers, DomesticWorker } from '../../context/DomesticWorkersContext';
import { useTheme } from '../../context/ThemeContext';
import { workerTypeMeta, formatWorkingDays } from '../../constants/domesticWorkers';

export default function DomesticWorkersScreen({ navigation }: { navigation: any }) {
  const { workers, loading, error, fetchWorkers, deleteWorker, lastFetchedAt } = useDomesticWorkers();
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
    Alert.alert('Remove worker', `Remove ${worker.name} from your registered domestic workers?`, [
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
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('WorkerForm', { workerId: item.id })}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Ionicons name={meta.icon} size={22} color={colors.primary} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{meta.label}</Text>
          </View>
          <Text style={styles.cardMeta}>{item.phone}</Text>
          <Text style={styles.cardMeta}>{formatWorkingDays(item.workingDays)} · {item.entryTime}–{item.exitTime}</Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Domestic Workers</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('WorkerForm', {})}>
          <Ionicons name="add" size={22} color={colors.card} />
        </TouchableOpacity>
      </View>

      {loading && workers.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="people-circle-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyText}>No domestic workers registered yet</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => navigation.navigate('WorkerForm', {})}>
                <Text style={styles.retryButtonText}>Register a worker</Text>
              </TouchableOpacity>
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
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    avatarImage: { width: 52, height: 52, borderRadius: 26, marginRight: 12, backgroundColor: colors.border },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    typeBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginBottom: 4,
    },
    typeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    cardMeta: { fontSize: 12, color: colors.textMuted },
    deleteButton: { padding: 8 },
    centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyText: { color: colors.textMuted, marginTop: 12, marginBottom: 16, textAlign: 'center' },
    errorText: { color: colors.danger, textAlign: 'center', marginBottom: 12 },
    retryButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    retryButtonText: { color: colors.card, fontWeight: '700' },
  });
