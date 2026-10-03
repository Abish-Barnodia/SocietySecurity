import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
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
  vehicleNumber?: string;
  visitorPhone?: string;
  entryAt?: string;
};

export default function WalkInApprovalScreen({ route, navigation }: { route: any; navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { requestId } = route.params || {};
  const { pendingWalkIns, respondWalkIn } = useData();

  const [loading, setLoading] = useState(true);
  const [remoteEntry, setRemoteEntry] = useState<RemoteEntry | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);

  const liveRequest = pendingWalkIns.find((r) => r.id === requestId);

  const load = useCallback(async () => {
    if (!requestId || liveRequest) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/walkins/${requestId}`);
      setRemoteEntry(res.data.data);
    } catch {
      // not found or unauthorized
    } finally {
      setLoading(false);
    }
  }, [requestId, liveRequest]);

  useEffect(() => {
    load();
  }, [load]);

  const effectiveTimeoutAt: string | undefined =
    liveRequest?.timeoutAt ?? remoteEntry?.walkinApproval?.timeoutAt;

  const visitorName = liveRequest?.visitorName ?? remoteEntry?.visitorName ?? 'Visitor';
  const purpose = liveRequest?.purpose ?? remoteEntry?.notes ?? 'Personal Visit';
  const vehicleNumber = liveRequest?.vehicleNumber ?? remoteEntry?.vehicleNumber ?? 'Pedestrian / No Vehicle';
  const gatePhotoUrl = liveRequest?.gatePhotoUrl ?? liveRequest?.visitorPhoto ?? remoteEntry?.gatePhotoUrl ?? undefined;
  const gateName = liveRequest?.gateName ?? remoteEntry?.entryPoint?.name ?? 'Gate 1 (Main Entrance)';
  const destinationUnit =
    liveRequest?.tower && liveRequest?.apartment
      ? `Tower ${liveRequest.tower} • Flat ${liveRequest.apartment}`
      : remoteEntry?.unit?.unitNumber
      ? `${remoteEntry.unit.tower ? `Tower ${remoteEntry.unit.tower} • ` : ''}Flat ${remoteEntry.unit.unitNumber}`
      : 'Resident Flat';
  const arrivalTime = liveRequest?.time || (remoteEntry?.entryAt ? new Date(remoteEntry.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now');

  const serverStatus = remoteEntry?.status;
  const isAlreadyResolved = serverStatus != null && serverStatus !== 'PENDING_APPROVAL';

  const handleAction = async (action: 'APPROVED' | 'DENIED') => {
    if (!requestId || submitting || expired || isAlreadyResolved) return;
    setSubmitting(true);
    navigation.goBack();
    try {
      await respondWalkIn(requestId, action);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to send your response.');
    }
  };

  useEffect(() => {
    if (!effectiveTimeoutAt) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round((new Date(effectiveTimeoutAt).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
      if (remaining <= 0) setExpired(true);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [effectiveTimeoutAt]);

  useEffect(() => {
    if (requestId && liveRequest && !pendingWalkIns.find((r) => r.id === requestId) && expired) {
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
        <View style={styles.quickActionIconBox}>
          <Ionicons name="help-circle-outline" size={32} color={colors.text} />
        </View>
        <Text style={styles.notFoundTitle}>Request Not Found</Text>
        <Text style={styles.notFoundSub}>This visitor gate request has already been processed or expired.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Return to Activities</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const buttonsDisabled = submitting || expired || isAlreadyResolved;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeHeaderBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gate Approval</Text>
          <Text style={styles.subTitle}>Security Guard Station • Entry Verification</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* VISITOR CARD */}
        <View style={styles.card}>
          <View style={styles.visitorRow}>
            <View style={styles.quickActionIconBox}>
              <Ionicons name="person-outline" size={28} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.visitorName}>{visitorName}</Text>
              <Text style={styles.methodText}>
                {effectiveTimeoutAt ? 'QR Scan Check-in' : 'Gate Walk-in Entry'}
              </Text>
            </View>
            <View style={styles.pendingBadge}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingBadgeText}>PENDING</Text>
            </View>
          </View>

          {/* GATE PHOTO (IF AVAILABLE) */}
          {!!gatePhotoUrl && (
            <View style={styles.photoWrap}>
              <RemoteImage
                uri={gatePhotoUrl}
                style={styles.photo}
                resizeMode="cover"
                colors={colors}
              />
              <View style={styles.photoOverlayBadge}>
                <Ionicons name="camera-outline" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.photoOverlayText}>Gate Camera Capture</Text>
              </View>
            </View>
          )}

          {/* CHECKPOINT DETAILS GRID */}
          <View style={styles.detailsGrid}>
            <View style={styles.gridItem}>
              <View style={styles.gridIconRow}>
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
                <Text style={styles.gridLabel}>Entry Checkpoint</Text>
              </View>
              <Text style={styles.gridValue} numberOfLines={1}>{gateName}</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.gridIconRow}>
                <Ionicons name="home-outline" size={14} color={colors.textMuted} />
                <Text style={styles.gridLabel}>Destination</Text>
              </View>
              <Text style={styles.gridValue} numberOfLines={1}>{destinationUnit}</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.gridIconRow}>
                <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                <Text style={styles.gridLabel}>Purpose</Text>
              </View>
              <Text style={styles.gridValue} numberOfLines={1}>{purpose}</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.gridIconRow}>
                <Ionicons name="car-outline" size={14} color={colors.textMuted} />
                <Text style={styles.gridLabel}>Vehicle / Mode</Text>
              </View>
              <Text style={styles.gridValue} numberOfLines={1}>{vehicleNumber}</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.gridIconRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.gridLabel}>Arrival Time</Text>
              </View>
              <Text style={styles.gridValue} numberOfLines={1}>{arrivalTime}</Text>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.gridIconRow}>
                <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.gridLabel}>Verification Station</Text>
              </View>
              <Text style={styles.gridValue} numberOfLines={1}>Gate Guard Post</Text>
            </View>
          </View>
        </View>

        {/* SECURITY GUARD NOTICE CALLOUT */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeIconWrap}>
            <Ionicons name="shield-outline" size={20} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Security Guard Station Verification</Text>
            <Text style={styles.noticeBody}>
              The security guard at the gate is awaiting your live authorization to allow {visitorName} inside the premises.
            </Text>
          </View>
        </View>

        {/* AUTO-DECLINE COUNTDOWN BAR */}
        {effectiveTimeoutAt && !isAlreadyResolved && (
          <View style={styles.timerCard}>
            <Ionicons name="time-outline" size={18} color="#ef4444" />
            <Text style={styles.timerText}>
              Auto-declines in <Text style={styles.timerNumber}>{timeLeft}s</Text> if no action is taken
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FOOTER ACTIONS */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.denyBtn, buttonsDisabled && { opacity: 0.5 }]}
          onPress={() => handleAction('DENIED')}
          disabled={buttonsDisabled}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={18} color="#ef4444" style={{ marginRight: 6 }} />
          <Text style={styles.denyBtnText}>Deny Entry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.approveBtn, buttonsDisabled && { opacity: 0.5 }]}
          onPress={() => handleAction('APPROVED')}
          disabled={buttonsDisabled}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark" size={18} color={isDark ? '#0f172a' : '#ffffff'} style={{ marginRight: 6 }} />
          <Text style={styles.approveBtnText}>Approve Entry</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      gap: 12,
    },
    closeHeaderBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subTitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    visitorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    quickActionIconBox: {
      width: 54,
      height: 54,
      borderRadius: 16,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    visitorName: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    methodText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
      fontWeight: '500',
    },
    pendingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#3b2812' : '#fefce8',
      borderColor: isDark ? '#784e1b' : '#fef08a',
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      gap: 5,
    },
    pendingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#eab308',
    },
    pendingBadgeText: {
      color: '#eab308',
      fontSize: 11,
      fontWeight: '800',
    },
    photoWrap: {
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 16,
      position: 'relative',
    },
    photo: {
      width: '100%',
      height: 180,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    photoOverlayBadge: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    photoOverlayText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '600',
    },
    detailsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 10,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#f1f5f9',
    },
    gridItem: {
      width: '48%',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    gridIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 4,
    },
    gridLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    gridValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    noticeCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      alignItems: 'center',
    },
    noticeIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    noticeBody: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16,
    },
    timerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    timerText: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
    },
    timerNumber: {
      fontWeight: '800',
      color: '#ef4444',
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    denyBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#381313' : '#fef2f2',
      borderWidth: 1,
      borderColor: isDark ? '#7f1d1d' : '#fecaca',
      paddingVertical: 14,
      borderRadius: 14,
    },
    denyBtnText: {
      color: '#ef4444',
      fontSize: 14,
      fontWeight: '800',
    },
    approveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingVertical: 14,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    approveBtnText: {
      color: isDark ? '#0f172a' : '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
    notFoundTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginTop: 14,
    },
    notFoundSub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 20,
    },
    backBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    backBtnText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 14,
    },
  });
