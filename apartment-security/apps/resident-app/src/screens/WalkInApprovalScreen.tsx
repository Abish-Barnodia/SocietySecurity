import { useGuardState, useAlerts, useEntries } from '../context/DomainContexts';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../utils/api';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export default function WalkInApprovalScreen({ route, navigation }: { route: any; navigation: any }) {
  const { requestId } = route.params || {};
  const { scanRequests, updateScanRequestStatus } = useGuardState();
  const { markAlertRead } = useAlerts();
  const { addEntry } = useEntries();
  const [timeLeft, setTimeLeft] = useState(47);

  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  const request = scanRequests.find(r => r.id === requestId);
  const visitorName = request ? request.visitorName : 'Unknown Visitor';

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (request && request.status === 'PENDING') {
            handleAction('DENIED');
          } else {
            navigation.goBack();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [request]);

  const handleAction = async (action: 'APPROVED' | 'DENIED') => {
    if (requestId) {
      const request = scanRequests.find(r => r.id === requestId);
      if (request?.passId) {
        try {
          await api.post(`/walkin/${request.passId}/respond`, { status: action });
        } catch (e: any) {
          console.warn('Walk-in respond API error:', e?.response?.data?.message ?? e.message);
        }
      }

      updateScanRequestStatus(requestId, action);
      markAlertRead(requestId);

      addEntry({
        id: Math.random().toString(36).substr(2, 9),
        name: visitorName,
        initials: visitorName.charAt(0).toUpperCase(),
        color: action === 'APPROVED' ? '#10b981' : colors.danger,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: action === 'APPROVED' ? 'ENTERED' : 'DENIED',
        type: 'Visitor',
        gate: 'Main Gate',
        statusColor: action === 'APPROVED' ? colors.success : colors.danger,
        date: 'TODAY'
      });
    }

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <View style={styles.avatarContainer}>
          <Text style={styles.avatarEmoji}>👨</Text>
        </View>

        <Text style={styles.title}>Visitor at your gate</Text>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue}>{visitorName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pass ID</Text>
            <Text style={styles.detailValue}>{request?.passId || 'Walk-in'}</Text>
          </View>
        </View>

        <Text style={styles.timerText}>
          Auto-deny in <Text style={styles.timerNumber}>{timeLeft}s</Text>
        </Text>

      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.denyButton} onPress={() => handleAction('DENIED')}>
          <Text style={styles.denyButtonText}>✕ Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveButton} onPress={() => handleAction('APPROVED')}>
          <Text style={styles.approveButtonText}>✓ Approve</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDarkMode ? '#262626' : colors.white,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xl,
    borderWidth: 4,
    borderColor: isDarkMode ? colors.primaryLight : '#fef3c7',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarEmoji: {
    fontSize: 64,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 32,
  },
  detailsCard: {
    width: '100%' as const,
    backgroundColor: colors.surface,
    borderRadius: roundness.xl,
    padding: spacing.lg,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    marginBottom: 32,
  },
  detailRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  timerText: {
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  timerNumber: {
    fontWeight: typography.weights.bold,
    color: colors.danger,
    fontSize: typography.sizes.lg,
  },
  footer: {
    flexDirection: 'row' as const,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  denyButton: {
    flex: 1,
    backgroundColor: colors.danger,
    padding: 20,
    borderRadius: roundness.lg,
    alignItems: 'center' as const,
    marginRight: spacing.sm,
  },
  denyButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.success,
    padding: 20,
    borderRadius: roundness.lg,
    alignItems: 'center' as const,
    marginLeft: spacing.sm,
  },
  approveButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
});
