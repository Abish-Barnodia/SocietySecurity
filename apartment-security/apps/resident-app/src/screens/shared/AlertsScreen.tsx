import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert as RNAlert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useData, Alert } from '../../context/DataContext';
import { useAuth } from '@apartment-security/shared-auth';
import RemoteImage from '../../components/RemoteImage';

// Maps backend priority key to Ionicons name + color
function AlertIcon({ priority, colors }: { priority: string; colors: any }) {
  let iconName: keyof typeof Ionicons.glyphMap = 'notifications-outline';
  let iconColor = colors.primary;
  let bgColor = colors.primaryLight;

  if (priority === 'P1') {
    iconName = 'alert-circle';
    iconColor = colors.danger;
    bgColor = colors.dangerLight;
  } else if (priority === 'P2') {
    iconName = 'warning';
    iconColor = '#D97706'; // amber
    bgColor = '#FEF3C7';
  } else if (priority === 'P3') {
    iconName = 'notifications-outline';
    iconColor = colors.primary;
    bgColor = colors.primaryLight;
  } else if (priority === 'VEHICLE') {
    iconName = 'car-outline';
    iconColor = '#7C3AED';
    bgColor = '#EDE9FE';
  } else if (priority === 'VISITOR') {
    iconName = 'person-outline';
    iconColor = colors.primary;
    bgColor = colors.primaryLight;
  }

  return (
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
      <Ionicons name={iconName} size={22} color={iconColor} />
    </View>
  );
}


export default function AlertsScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { alerts, markAllAlertsRead, markAlertRead, fetchAlerts, claimVehicleAlert } = useData();
  const { userId } = useAuth();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Alerts otherwise only ever come from the one-time fetch at login plus
  // whatever arrives live over the socket while this screen happens to be
  // mounted — if the resident wasn't connected at the exact moment a visitor
  // scanned in, the alert exists in the DB but never shows up. Refetch on
  // every focus so opening this tab is always a reliable way to see it.
  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
    }, [fetchAlerts])
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
      </View>
      <ScrollView contentContainerStyle={styles.listContent}>
        {alerts.length > 0 ? (
          <View style={styles.markReadContainer}>
            <TouchableOpacity onPress={markAllAlertsRead}>
              <Text style={styles.markReadText}>Mark all as read</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ padding: 24, alignItems: 'center', marginTop: 40 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="notifications-off-outline" size={36} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>No new alerts</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>You're all caught up!</Text>
          </View>
        )}

        {alerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={styles.card}
            activeOpacity={alert.entryId || alert.imageUrl ? 0.7 : 1}
            onPress={() => {
              if (alert.entryId) {
                navigation.navigate('WalkInApproval', { requestId: alert.entryId });
              } else if (alert.imageUrl) {
                setSelectedAlert(alert);
              }
            }}
          >
            <View style={styles.alertRow}>
              <AlertIcon priority={alert.icon} colors={colors} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <ScrollView style={styles.subtitleScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                  <Text style={styles.alertSubtitle}>{alert.subtitle}</Text>
                </ScrollView>
                <Text style={styles.alertTime}>{alert.time}</Text>
              </View>
              {alert.unread && <View style={styles.unreadDot} />}
            </View>

            {!!alert.imageUrl && (
              <View>
                <RemoteImage uri={alert.imageUrl} style={styles.vehicleImage} colors={colors} />
                {!alert.entryId && (
                  <>
                    {alert.claimedByUserId ? (
                      <Text style={styles.claimStatus}>
                        {alert.claimedByUserId === userId ? 'You confirmed this is your vehicle' : `Claimed by ${alert.claimedByName ?? 'another resident'}`}
                      </Text>
                    ) : (
                      <View style={styles.claimActions}>
                        <TouchableOpacity
                          style={styles.notMineButton}
                          onPress={() => markAlertRead(alert.id)}
                        >
                          <Text style={styles.notMineText}>Not mine</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.claimButton}
                          onPress={() => handleClaim(alert)}
                          disabled={claimingId === alert.id}
                        >
                          {claimingId === alert.id ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.claimButtonText}>This is my vehicle</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Full screen modal for unknown vehicle / alert details */}
      <Modal visible={!!selectedAlert} transparent animationType="fade" onRequestClose={() => setSelectedAlert(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedAlert(null)}>
              <Ionicons name="close-circle" size={28} color={colors.textMuted} />
            </TouchableOpacity>
            
            {selectedAlert && (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View style={styles.alertRow}>
                  <AlertIcon priority={selectedAlert.icon} colors={colors} />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>{selectedAlert.title}</Text>
                    <Text style={styles.alertTime}>{selectedAlert.time}</Text>
                  </View>
                </View>
                <Text style={[styles.alertSubtitle, { marginTop: 12, fontSize: 16 }]}>{selectedAlert.subtitle}</Text>
                
                {selectedAlert.imageUrl && (
                  <RemoteImage uri={selectedAlert.imageUrl} style={styles.fullImage} resizeMode="contain" colors={colors} />
                )}

                {selectedAlert.imageUrl && (
                  <View style={{ marginTop: 24 }}>
                    {selectedAlert.claimedByUserId ? (
                      <Text style={[styles.claimStatus, { textAlign: 'center' }]}>
                        {selectedAlert.claimedByUserId === userId ? 'You confirmed this is your vehicle' : `Claimed by ${selectedAlert.claimedByName ?? 'another resident'}`}
                      </Text>
                    ) : (
                      <View style={styles.claimActions}>
                        <TouchableOpacity
                          style={[styles.notMineButton, { paddingVertical: 16 }]}
                          onPress={() => {
                            markAlertRead(selectedAlert.id);
                            setSelectedAlert(null);
                          }}
                        >
                          <Text style={styles.notMineText}>Not mine</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.claimButton, { paddingVertical: 16 }]}
                          onPress={() => {
                            handleClaim(selectedAlert);
                            setSelectedAlert(null);
                          }}
                        >
                          <Text style={styles.claimButtonText}>This is my vehicle</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  markReadContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  markReadText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  alertContent: {
    flex: 1,
    marginRight: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  // Caps a single alert card's message at ~4 lines and scrolls internally
  // past that — a long broadcast used to stretch the card to fit the whole
  // message, forcing a long scroll down the entire list just to get past it.
  subtitleScroll: {
    maxHeight: 84,
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  alertTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  vehicleImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 12,
  },
  claimActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  notMineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notMineText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  claimButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  claimButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  claimStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginTop: 20,
    backgroundColor: '#000',
  },
});
