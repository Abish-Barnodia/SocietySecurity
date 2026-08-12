import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useMaintenance, Invoice, InvoiceStatus } from '../../context/MaintenanceContext';
import { useTheme } from '../../context/ThemeContext';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const formatAmount = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATUS_STYLE: Record<InvoiceStatus, { key: 'success' | 'warning' | 'danger' | 'textMuted'; label: string }> = {
  PAID: { key: 'success', label: 'Paid' },
  PENDING: { key: 'warning', label: 'Pending' },
  OVERDUE: { key: 'danger', label: 'Overdue' },
  CANCELLED: { key: 'textMuted', label: 'Cancelled' },
};

export default function MaintenanceScreen() {
  const { invoices, loading, fetchInvoices, payInvoice } = useMaintenance();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchInvoices();
    }, [fetchInvoices])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  const handlePay = async (invoice: Invoice) => {
    setPayingId(invoice.id);
    try {
      await payInvoice(invoice.id);
      Alert.alert('Payment successful', `${formatAmount(invoice.amount)} paid for ${invoice.description}.`);
    } catch (error: any) {
      Alert.alert('Payment failed', error.response?.data?.message ?? 'Please try again.');
    } finally {
      setPayingId(null);
    }
  };

  const totalDue = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((sum, i) => sum + i.amount, 0);

  const renderItem = ({ item }: { item: Invoice }) => {
    const status = STATUS_STYLE[item.status];
    const statusColor = colors[status.key];
    const payable = item.status === 'PENDING' || item.status === 'OVERDUE';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.description}</Text>
            <Text style={styles.cardMeta}>Due {formatDate(item.dueDate)}</Text>
          </View>
          <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
        </View>
        <View style={styles.footerRow}>
          <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{status.label}</Text>
          </View>
          {payable && (
            <TouchableOpacity style={styles.payButton} onPress={() => handlePay(item)} disabled={payingId === item.id}>
              {payingId === item.id ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.payButtonText}>Pay Now</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maintenance</Text>
        {totalDue > 0 && <Text style={styles.dueSummary}>{formatAmount(totalDue)} due</Text>}
      </View>

      {loading && invoices.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No invoices yet</Text>
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
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    dueSummary: { fontSize: 13, fontWeight: '700', color: colors.danger },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    loader: { marginTop: 60 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    cardMeta: { fontSize: 12, color: colors.textMuted },
    amount: { fontSize: 16, fontWeight: '800', color: colors.text },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    payButton: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, minWidth: 84, alignItems: 'center' },
    payButtonText: { color: colors.card, fontSize: 13, fontWeight: '700' },
    centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyText: { color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  });
