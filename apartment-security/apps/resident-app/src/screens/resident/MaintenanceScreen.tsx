import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useMaintenance, Invoice, InvoiceStatus } from '../../context/MaintenanceContext';
import { useTheme } from '../../context/ThemeContext';
import { downloadInvoicePdf } from '../../utils/invoicePdf';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const formatAmount = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PAID: { label: 'Paid', icon: 'checkmark-circle-outline' },
  PENDING: { label: 'Pending', icon: 'time-outline' },
  OVERDUE: { label: 'Overdue', icon: 'alert-circle-outline' },
  CANCELLED: { label: 'Cancelled', icon: 'close-circle-outline' },
};

export default function MaintenanceScreen() {
  const navigation = useNavigation();
  const { invoices, loading, fetchInvoices, payInvoice, lastFetchedAt } = useMaintenance();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchedAt.current > 30000) fetchInvoices();
    }, [fetchInvoices, lastFetchedAt])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      await downloadInvoicePdf(invoice);
    } catch (err: any) {
      Alert.alert('Download Error', 'Could not generate invoice PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePay = async (invoice: Invoice) => {
    setPayingId(invoice.id);
    try {
      await payInvoice(invoice.id);
      Alert.alert(
        'Payment Successful 🎉',
        `${formatAmount(invoice.amount)} paid successfully for ${invoice.description}.`,
        [
          { text: 'Done', style: 'cancel' },
          {
            text: 'Download Receipt',
            onPress: () => {
              const updatedInv: Invoice = { ...invoice, status: 'PAID', paidAt: new Date().toISOString() };
              handleDownloadInvoice(updatedInv);
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Payment Failed', error.response?.data?.message ?? 'Please try again.');
    } finally {
      setPayingId(null);
    }
  };

  const pendingInvoices = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE');
  const totalDue = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);

  const renderHeader = () => (
    <View style={styles.summaryBanner}>
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryIconBox}>
          <Ionicons name="receipt-outline" size={22} color={colors.text} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.summaryLabel}>Outstanding Dues</Text>
          <Text style={styles.summaryAmount}>{formatAmount(totalDue)}</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>{pendingInvoices.length} Pending</Text>
        </View>
      </View>
      <Text style={styles.summarySub}>
        {totalDue > 0 ? 'Please clear all pending society dues before the due date to avoid late fees.' : 'All society bills and maintenance dues are cleared.'}
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: Invoice }) => {
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const payable = item.status === 'PENDING' || item.status === 'OVERDUE';
    const isPaid = item.status === 'PAID';
    const isOverdue = item.status === 'OVERDUE';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconBox}>
            <Ionicons name={statusCfg.icon} size={22} color={colors.text} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.description}</Text>
            <Text style={styles.cardMeta}>Due {formatDate(item.dueDate)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
            <View style={[styles.badge, isPaid && styles.badgePaid, isOverdue && styles.badgeOverdue]}>
              <Text style={[styles.badgeText, isPaid && styles.badgeTextPaid, isOverdue && styles.badgeTextOverdue]}>{statusCfg.label}</Text>
            </View>
          </View>
        </View>

        {payable && (
          <View style={[styles.actionRow, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
            <TouchableOpacity
              style={styles.downloadOutlineBtn}
              onPress={() => handleDownloadInvoice(item)}
              disabled={downloadingId === item.id}
              activeOpacity={0.7}
            >
              {downloadingId === item.id ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <View style={styles.btnInner}>
                  <Ionicons name="receipt-outline" size={16} color={colors.text} />
                  <Text style={styles.downloadOutlineText} numberOfLines={1}>View Bill</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.payButton}
              onPress={() => handlePay(item)}
              disabled={payingId === item.id}
              activeOpacity={0.8}
            >
              {payingId === item.id ? (
                <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
              ) : (
                <View style={styles.btnInner}>
                  <Ionicons name="card-outline" size={16} color={isDark ? '#000' : '#fff'} />
                  <Text style={styles.payButtonText} numberOfLines={1}>Pay ({formatAmount(item.amount)})</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isPaid && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownloadInvoice(item)}
              disabled={downloadingId === item.id}
            >
              {downloadingId === item.id ? (
                <ActivityIndicator size="small" color="#15803d" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color="#15803d" style={{ marginRight: 6 }} />
                  <Text style={styles.downloadButtonText}>Download Receipt & Invoice (PDF)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
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
          <Text style={styles.headerTitle}>Maintenance & Bills</Text>
          <Text style={styles.headerSubtitle}>Society dues, invoices, and payment receipts</Text>
        </View>
      </View>

      {loading && invoices.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="receipt-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Invoices Found</Text>
              <Text style={styles.emptyText}>You do not have any pending or past maintenance invoices.</Text>
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

    summaryBanner: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    summaryIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    summaryAmount: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 1 },
    summaryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    summaryBadgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
    summarySub: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },

    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    cardIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    amount: { fontSize: 16, fontWeight: '800', color: colors.text },
    badge: {
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
    badgePaid: {
      backgroundColor: isDark ? 'rgba(22, 163, 74, 0.2)' : '#dcfce7',
    },
    badgeTextPaid: {
      color: isDark ? '#4ade80' : '#15803d',
    },
    badgeOverdue: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
    },
    badgeTextOverdue: {
      color: '#ef4444',
    },

    actionRow: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#f1f5f9',
    },
    btnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    payButton: {
      flex: 1.1,
      minHeight: 44,
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payButtonText: {
      color: isDark ? '#0f172a' : '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    downloadButton: {
      flexDirection: 'row',
      minHeight: 44,
      backgroundColor: isDark ? 'rgba(22, 163, 74, 0.15)' : '#f0fdf4',
      borderWidth: 1,
      borderColor: isDark ? '#166534' : '#bbf7d0',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    downloadButtonText: {
      color: isDark ? '#4ade80' : '#15803d',
      fontSize: 13,
      fontWeight: '700',
    },
    downloadOutlineBtn: {
      flex: 0.9,
      minHeight: 44,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    downloadOutlineText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },

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
