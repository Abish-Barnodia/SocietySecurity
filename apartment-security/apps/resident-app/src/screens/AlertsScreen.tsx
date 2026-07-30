import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useData, Alert } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function AlertsScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { alerts, markAllAlertsRead, markAlertRead, fetchAlerts, claimVehicleAlert } = useData();
  const { userId } = useAuth();
  const [claimingId, setClaimingId] = useState<string | null>(null);

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
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>No new alerts</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>You're all caught up!</Text>
          </View>
        )}

        {alerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={styles.card}
            activeOpacity={alert.entryId ? 0.7 : 1}
            onPress={() => {
              if (alert.entryId) {
                navigation.navigate('WalkInApproval', { requestId: alert.entryId });
              }
            }}
          >
            <View style={styles.alertRow}>
              <Text style={styles.alertIcon}>{alert.icon}</Text>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertSubtitle}>{alert.subtitle}</Text>
                <Text style={styles.alertTime}>{alert.time}</Text>
              </View>
              {alert.unread && <View style={styles.unreadDot} />}
            </View>

            {alert.imageUrl && (
              <>
                <Image source={{ uri: alert.imageUrl }} style={styles.vehicleImage} />
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
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  alertSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
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
});
