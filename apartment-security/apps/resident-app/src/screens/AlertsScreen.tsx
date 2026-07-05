import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { colors } from '../theme/colors';
import { useData } from '../context/DataContext';

export default function AlertsScreen({ navigation }: { navigation: any }) {
  const { alerts } = useData();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
      </View>
      <ScrollView contentContainerStyle={styles.listContent}>
        {alerts.length > 0 ? (
          <View style={styles.markReadContainer}>
            <TouchableOpacity>
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
            onPress={() => {
              // Pass the request ID to WalkInApproval to approve/deny
              navigation.navigate('WalkInApproval', { requestId: alert.id });
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
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
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
});
