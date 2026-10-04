import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert as RNAlert,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useData, Alert } from '../../context/DataContext';
import { useAuth } from '@apartment-security/shared-auth';
import RemoteImage from '../../components/RemoteImage';
import { AlertsSkeletonList } from '../../components/SkeletonLoader';

// Checks if an alert is specifically an unknown vehicle alert that residents can claim
function isVehicleAlert(alert: { title?: string; subtitle?: string; icon?: string }): boolean {
  const t = (alert.title || '').toLowerCase();
  const s = (alert.subtitle || '').toLowerCase();
  return (
    t.includes('vehicle') ||
    t.includes('parking') ||
    alert.icon === 'VEHICLE' ||
    s.includes('spotted at') ||
    s.includes('plate ')
  );
}

// Maps alert icon/priority to monochrome Iconify/QuickActions style icon
function getAlertIcon(priority: string, title?: string): keyof typeof Ionicons.glyphMap {
  const t = (title || '').toLowerCase();
  if (t.includes('accident')) return 'warning-outline';
  if (t.includes('fire')) return 'flame-outline';
  if (t.includes('medical')) return 'medkit-outline';
  if (t.includes('complaint')) return 'chatbox-ellipses-outline';
  if (t.includes('vehicle') || t.includes('parking') || priority === 'VEHICLE') return 'car-outline';
  if (t.includes('overstay') || t.includes('guard') || t.includes('security') || priority === 'P1') return 'shield-checkmark-outline';
  if (t.includes('visitor') || t.includes('guest') || t.includes('walk-in') || priority === 'VISITOR') return 'person-outline';
  if (t.includes('delivery') || t.includes('courier')) return 'bicycle-outline';
  if (t.includes('bill') || t.includes('maintenance') || t.includes('payment')) return 'construct-outline';
  if (priority === 'P2') return 'warning-outline';
  return 'notifications-outline';
}

export default function AlertsScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { alerts, markAllAlertsRead, markAlertRead, fetchAlerts, claimVehicleAlert } = useData();
  const { userId } = useAuth();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      if (alerts.length === 0) setLoading(true);
      fetchAlerts().finally(() => {
        if (isCurrent) setLoading(false);
      });
      return () => {
        isCurrent = false;
      };
    }, [fetchAlerts, alerts.length])
  );

  const unreadCount = useMemo(() => alerts.filter((a) => a.unread).length, [alerts]);

  const handleClaim = async (alert: Alert) => {
    setClaimingId(alert.id);
    try {
      await claimVehicleAlert(alert.id);
    } catch (error: any) {
      RNAlert.alert('Error', error.response?.data?.message ?? 'Failed to record your response');
    } finally {
      setClaimingId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER (Matching Entries & Home Design) */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>Alerts</Text>
            <Text style={styles.subTitle}>
              {unreadCount > 0 ? `${unreadCount} unread notices` : 'All caught up'} • {alerts.length} total
            </Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllReadBtn}
              onPress={markAllAlertsRead}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done-outline" size={15} color={colors.primary} />
              <Text style={styles.markAllReadText}>Mark read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {loading && !refreshing ? (
          <AlertsSkeletonList count={3} />
        ) : alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={38} color={colors.text} />
            </View>
            <Text style={styles.emptyTitle}>No Alerts Right Now</Text>
            <Text style={styles.emptySub}>
              Security gate entries, guest arrivals, and notices will appear here in real-time.
            </Text>
          </View>
        ) : (
          alerts.map((alert) => {
            const iconName = getAlertIcon(alert.icon, alert.title);

            return (
              <TouchableOpacity
                key={alert.id}
                style={[styles.card, alert.unread && styles.cardUnread]}
                activeOpacity={0.8}
                onPress={() => {
                  if (alert.entryId) {
                    navigation.navigate('WalkInApproval', { requestId: alert.entryId });
                  } else {
                    setSelectedAlert(alert);
                  }
                }}
              >
                {/* TOP ROW: QuickActions Style Monochrome Icon Box + Title + Time + Unread Pill */}
                <View style={styles.cardTopRow}>
                  {/* Monochrome Icon Box */}
                  <View style={styles.quickActionIconBox}>
                    <Ionicons name={iconName} size={22} color={colors.text} />
                  </View>

                  <View style={styles.cardInfoCol}>
                    <View style={styles.titleRow}>
                      <Text style={styles.alertTitle} numberOfLines={1}>
                        {alert.title}
                      </Text>
                      {alert.unread && <View style={styles.unreadPill} />}
                    </View>

                    <Text style={styles.alertSubtitle} numberOfLines={2}>
                      {alert.subtitle}
                    </Text>

                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.alertTime}>{alert.time || 'Recently'}</Text>
                    </View>
                  </View>
                </View>

                {/* VEHICLE / VISITOR ATTACHMENT IMAGE */}
                {!!alert.imageUrl && (
                  <View style={styles.imageWrap}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={(e) => {
                        e.stopPropagation();
                        setPreviewImageUrl(alert.imageUrl!);
                      }}
                    >
                      <RemoteImage uri={alert.imageUrl} style={styles.vehicleImage} colors={colors} />
                      <View style={styles.imageOverlayBadge}>
                        <Ionicons name="expand-outline" size={12} color="#ffffff" style={{ marginRight: 3 }} />
                        <Text style={styles.imageOverlayText}>View full photo</Text>
                      </View>
                    </TouchableOpacity>
                    {isVehicleAlert(alert) && !alert.entryId && (
                      <View style={styles.claimSection}>
                        {alert.claimedByUserId ? (
                          <View style={styles.claimedBadge}>
                            <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                            <Text style={styles.claimedText}>
                              {alert.claimedByUserId === userId
                                ? 'You confirmed this vehicle'
                                : `Claimed by ${alert.claimedByName ?? 'another resident'}`}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.claimActionsRow}>
                            <TouchableOpacity
                              style={styles.notMineBtn}
                              onPress={() => markAlertRead(alert.id)}
                            >
                              <Text style={styles.notMineText}>Not mine</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.claimBtn}
                              onPress={() => handleClaim(alert)}
                              disabled={claimingId === alert.id}
                            >
                              {claimingId === alert.id ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text style={styles.claimBtnText}>This is my vehicle</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FULL DETAIL MODAL */}
      <Modal
        visible={!!selectedAlert}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAlert(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedAlert(null)}
        >
          <TouchableOpacity
            style={styles.modalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalCardTitle}>Alert Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedAlert(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedAlert && (
              <ScrollView style={{ maxHeight: 380, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={styles.quickActionIconBox}>
                    <Ionicons
                      name={getAlertIcon(selectedAlert.icon, selectedAlert.title)}
                      size={22}
                      color={colors.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalAlertTitle}>{selectedAlert.title}</Text>
                    <Text style={styles.modalAlertTime}>{selectedAlert.time}</Text>
                  </View>
                </View>

                <View style={styles.modalTextBox}>
                  <Text style={styles.modalAlertSubtitle}>{selectedAlert.subtitle}</Text>
                </View>

                {selectedAlert.imageUrl && (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setPreviewImageUrl(selectedAlert.imageUrl!)}
                  >
                    <RemoteImage
                      uri={selectedAlert.imageUrl}
                      style={styles.modalFullImage}
                      resizeMode="cover"
                      colors={colors}
                    />
                    <View style={styles.imageOverlayBadge}>
                      <Ionicons name="expand-outline" size={12} color="#ffffff" style={{ marginRight: 3 }} />
                      <Text style={styles.imageOverlayText}>Tap for full screen</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {selectedAlert.imageUrl && isVehicleAlert(selectedAlert) && !selectedAlert.entryId && (
                  <View style={{ marginTop: 16 }}>
                    {selectedAlert.claimedByUserId ? (
                      <Text style={[styles.claimedText, { textAlign: 'center' }]}>
                        {selectedAlert.claimedByUserId === userId
                          ? 'You confirmed this vehicle'
                          : `Claimed by ${selectedAlert.claimedByName ?? 'another resident'}`}
                      </Text>
                    ) : (
                      <View style={styles.claimActionsRow}>
                        <TouchableOpacity
                          style={styles.notMineBtn}
                          onPress={() => {
                            markAlertRead(selectedAlert.id);
                            setSelectedAlert(null);
                          }}
                        >
                          <Text style={styles.notMineText}>Not mine</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.claimBtn}
                          onPress={() => {
                            handleClaim(selectedAlert);
                            setSelectedAlert(null);
                          }}
                        >
                          <Text style={styles.claimBtnText}>This is my vehicle</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedAlert(null)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Photo Preview Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.fullImageBackdrop}>
          <SafeAreaView style={styles.fullImageSafeArea}>
            <View style={styles.fullImageTopBar}>
              <View style={styles.fullImageHeaderLeft}>
                <Ionicons name="image-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.fullImageTitle}>Photo Attachment</Text>
              </View>
              <TouchableOpacity
                style={styles.fullImageCloseBtn}
                onPress={() => setPreviewImageUrl(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.fullImageContent}
              activeOpacity={1}
              onPress={() => setPreviewImageUrl(null)}
            >
              {previewImageUrl && (
                <RemoteImage
                  uri={previewImageUrl}
                  style={styles.fullImage}
                  resizeMode="contain"
                  colors={colors}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullImageBottomBar}
              activeOpacity={0.8}
              onPress={() => setPreviewImageUrl(null)}
            >
              <Text style={styles.fullImageHint}>Tap anywhere to close</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
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
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
    },
    subTitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    markAllReadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      gap: 4,
    },
    markAllReadText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },

    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },

    // CARD DESIGN (Matching Entries & Quick Actions Box)
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    cardUnread: {
      borderColor: isDark ? '#3b82f6' : '#bfdbfe',
      backgroundColor: isDark ? '#172554' : '#ffffff',
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    quickActionIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    cardInfoCol: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    alertTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    unreadPill: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#3b82f6',
      marginLeft: 8,
    },
    alertSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginTop: 4,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    alertTime: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },

    // IMAGE SECTION
    imageWrap: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#f1f5f9',
    },
    vehicleImage: {
      width: '100%',
      height: 150,
      borderRadius: 12,
      backgroundColor: '#f1f5f9',
    },
    claimSection: {
      marginTop: 10,
    },
    claimedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#f0fdf4',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#bbf7d0',
    },
    claimedText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#16a34a',
    },
    claimActionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    notMineBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    notMineText: {
      color: colors.textMuted,
      fontWeight: '700',
      fontSize: 12,
    },
    claimBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    claimBtnText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 12,
    },

    // EMPTY STATE
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 24,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    emptySub: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 18,
    },

    // MODAL
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalCardTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    modalAlertTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    modalAlertTime: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    modalTextBox: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    modalAlertSubtitle: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 19,
    },
    modalFullImage: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      backgroundColor: '#000',
    },
    modalCloseBtn: {
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 14,
    },
    modalCloseBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    imageOverlayBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    imageOverlayText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
    },
    fullImageBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    fullImageSafeArea: {
      flex: 1,
      justifyContent: 'space-between',
    },
    fullImageTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    fullImageHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fullImageTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    fullImageCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullImageContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
    fullImage: {
      width: '100%',
      height: '100%',
    },
    fullImageBottomBar: {
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullImageHint: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 12,
      fontWeight: '500',
    },
  });
