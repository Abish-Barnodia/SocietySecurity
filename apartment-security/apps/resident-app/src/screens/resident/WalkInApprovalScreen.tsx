import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useData, PendingWalkIn } from '../../context/DataContext';
import api from '../../utils/api';
import RemoteImage from '../../components/RemoteImage';

type RemoteEntry = {
  id: string;
  visitorName: string;
  status: string;
  walkinApproval?: { timeoutAt?: string; decision?: string } | null;
  unit?: { unitNumber?: string; tower?: string };
  entryPoint?: { name?: string };
  notes?: string;
  gatePhotoUrl?: string;
};

export default function WalkInApprovalScreen({ route, navigation }: { route: any; navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { requestId } = route.params || {};
  const { pendingWalkIns, respondWalkIn } = useData();

  const [loading, setLoading] = useState(true);
  const [remoteEntry, setRemoteEntry] = useState<RemoteEntry | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);

  // Prefer in-memory live request; fall back to API fetch
  const liveRequest = pendingWalkIns.find(r => r.id === requestId);

  const load = useCallback(async () => {
    if (!requestId) { setLoading(false); return; }
    try {
      const res = await api.get(`/walkins/${requestId}`);
      setRemoteEntry(res.data.data);
    } catch {
      // entry not found or unauthorized — leave remoteEntry null
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  // Derive the effective data: live socket state takes priority (has more fields)
  const effectiveTimeoutAt: string | undefined =
    liveRequest?.timeoutAt ??
    remoteEntry?.walkinApproval?.timeoutAt;

  const visitorName =
    liveRequest?.visitorName ??
    remoteEntry?.visitorName ??
    'Unknown Visitor';

  const purpose =
    liveRequest?.purpose ??
    remoteEntry?.notes ??
    undefined;

  const vehicleNumber = liveRequest?.vehicleNumber ?? undefined;
  const expectedTime  = liveRequest?.expectedTime  ?? undefined;
  const gatePhotoUrl  = liveRequest?.gatePhotoUrl ?? remoteEntry?.gatePhotoUrl ?? undefined;

  // Determine if already resolved on server (not pending)
  const serverStatus = remoteEntry?.status;
  const isAlreadyResolved =
    serverStatus != null &&
    serverStatus !== 'PENDING_APPROVAL';

  const handleAction = async (action: 'APPROVED' | 'DENIED') => {
    if (!requestId || submitting || expired || isAlreadyResolved) return;
    setSubmitting(true);
    try {
      await respondWalkIn(requestId, action);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to send your response. Please try again.');
      setSubmitting(false);
      return;
    }
    navigation.goBack();
  };

  // Countdown from server deadline
  useEffect(() => {
    if (!effectiveTimeoutAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((new Date(effectiveTimeoutAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) setExpired(true);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [effectiveTimeoutAt]);

  // If the live request disappears (server timeout fired), go back
  useEffect(() => {
    if (requestId && liveRequest && !pendingWalkIns.find(r => r.id === requestId) && expired) {
      navigation.goBack();
    }
  }, [pendingWalkIns, requestId, expired, liveRequest]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!remoteEntry && !liveRequest) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <Ionicons name="help-circle-outline" size={48} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
          Request not found
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
          This request may have already expired or been removed.
        </Text>
        <TouchableOpacity style={[styles.approveButton, { marginTop: 24 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.approveButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const buttonsDisabled = submitting || expired || isAlreadyResolved;

  const statusLabel = (() => {
    if (isAlreadyResolved) return `Already ${serverStatus?.toLowerCase()}`;
    if (expired) return 'Approval expired';
    if (!effectiveTimeoutAt) return null;
    return (
      <>Auto-deny in <Text style={styles.timerNumber}>{timeLeft}s</Text></>
    );
  })();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>

        <Text style={styles.title}>Visitor at your gate</Text>

        <View style={styles.detailsCard}>
          <RemoteImage
            uri={gatePhotoUrl}
            style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 16 }}
            resizeMode="cover"
            colors={colors}
          />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue}>{visitorName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Method</Text>
            <Text style={styles.detailValue}>{effectiveTimeoutAt ? 'QR scan' : 'Walk-in'}</Text>
          </View>
          {!!purpose && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Purpose</Text>
              <Text style={styles.detailValue}>{purpose}</Text>
            </View>
          )}
          {!!vehicleNumber && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vehicle</Text>
              <Text style={styles.detailValue}>{vehicleNumber}</Text>
            </View>
          )}
          {!!expectedTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expected until</Text>
              <Text style={styles.detailValue}>
                {new Date(expectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        {statusLabel != null && (
          <Text style={styles.timerText}>{statusLabel}</Text>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.denyButton, buttonsDisabled && { opacity: 0.5 }]}
          onPress={() => handleAction('DENIED')}
          disabled={buttonsDisabled}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.denyButtonText}>Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.approveButton, buttonsDisabled && { opacity: 0.5 }]}
          onPress={() => handleAction('APPROVED')}
          disabled={buttonsDisabled}
        >
          <Ionicons name="checkmark" size={18} color={colors.card} style={{ marginRight: 6 }} />
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 32,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  timerText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  timerNumber: {
    fontWeight: 'bold',
    color: colors.danger,
    fontSize: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    paddingBottom: 40,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  denyButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  approveButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
});
