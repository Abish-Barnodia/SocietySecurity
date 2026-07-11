import { useGuardState } from '../context/DomainContexts';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GuardTabs'>;

export default function GuardHomeScreen({ navigation }: { navigation: NavigationProp }) {
  const { userEmail, logout } = useAuth();
  const { scanRequests } = useGuardState();

  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Security Dashboard</Text>
            <Text style={styles.subtitle}>Logged in as {userEmail}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Expected Visitors</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{scanRequests.length}</Text>
            <Text style={styles.statLabel}>Total Requests</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ScanPass')}>
          <Ionicons name="qr-code-outline" size={32} color={isDarkMode ? colors.white : colors.text} />
          <Text style={styles.actionText}>Scan Entry Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success }]} onPress={() => navigation.navigate('ScanPass')}>
          <Ionicons name="person-add-outline" size={32} color={colors.white} />
          <Text style={[styles.actionText, { color: colors.white }]}>Walk-in Entry</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Recent Requests</Text>
        {scanRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={{ color: colors.textMuted, fontSize: typography.sizes.md, fontWeight: typography.weights.medium }}>No recent scan requests.</Text>
          </View>
        ) : (
          scanRequests.map(req => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestName}>{req.visitorName}</Text>
                  <Text style={styles.requestTime}>{req.time}</Text>
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: req.status === 'APPROVED' ? (isDarkMode ? '#052e16' : '#dcfce7') : 
                                   req.status === 'DENIED' ? (isDarkMode ? '#450a0a' : '#fee2e2') : 
                                   (isDarkMode ? '#422006' : '#fef9c3')
                }]}>
                  <Text style={[styles.statusText, {
                    color: req.status === 'APPROVED' ? colors.success : 
                           req.status === 'DENIED' ? colors.danger : colors.warning
                  }]}>{req.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xxl,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  logoutBtn: {
    padding: spacing.sm,
    backgroundColor: isDarkMode ? '#450a0a' : colors.dangerLight,
    borderRadius: roundness.lg,
  },
  statsContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.xxl,
  },
  statCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: roundness.xl,
    width: '48%' as const,
    alignItems: 'center' as const,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.extrabold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase' as const,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  actionButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 24,
    borderRadius: roundness.xl,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  actionText: {
    color: isDarkMode ? colors.white : colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.xxl,
    borderRadius: roundness.xl,
    alignItems: 'center' as const,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
  },
  requestCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: roundness.lg,
    marginBottom: spacing.sm,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
  },
  requestRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  requestName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  requestTime: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: roundness.full,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
