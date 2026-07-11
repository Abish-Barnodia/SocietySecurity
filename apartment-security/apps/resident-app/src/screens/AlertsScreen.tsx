import { useAlerts } from '../context/DomainContexts';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export default function AlertsScreen({ navigation }: { navigation: any }) {
  const { alerts } = useAlerts();
  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
      </View>
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {alerts.length > 0 ? (
          <View style={styles.markReadContainer}>
            <TouchableOpacity>
              <Text style={styles.markReadText}>Mark all as read</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No new alerts</Text>
            <Text style={styles.emptySubtitle}>You're all caught up!</Text>
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
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#262626' : '#f4f4f5' }]}>
                <Text style={styles.alertIcon}>{alert.icon}</Text>
              </View>
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

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  markReadContainer: {
    alignItems: 'flex-end' as const,
    marginBottom: spacing.lg,
  },
  markReadText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center' as const,
    marginTop: 40,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: roundness.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
  },
  alertRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.md,
  },
  alertIcon: {
    fontSize: 24,
  },
  alertContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  alertTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  alertTime: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginTop: 6,
  },
});
