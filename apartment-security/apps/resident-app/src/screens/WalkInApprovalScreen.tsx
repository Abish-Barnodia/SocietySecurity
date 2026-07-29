import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

export default function WalkInApprovalScreen({ route, navigation }: { route: any; navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { requestId } = route.params || {};
  const { pendingWalkIns, respondWalkIn } = useData();
  const [timeLeft, setTimeLeft] = useState(47);
  const [submitting, setSubmitting] = useState(false);

  const request = pendingWalkIns.find(r => r.id === requestId);
  const visitorName = request ? request.visitorName : 'Unknown Visitor';

  const handleAction = async (action: 'APPROVED' | 'DENIED') => {
    if (!requestId || submitting) {
      navigation.goBack();
      return;
    }
    setSubmitting(true);
    try {
      await respondWalkIn(requestId, action);
    } catch {
      Alert.alert('Error', 'Failed to send your response. Please try again.');
      setSubmitting(false);
      return;
    }
    navigation.goBack();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (request) {
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
            <Text style={styles.detailLabel}>Method</Text>
            <Text style={styles.detailValue}>Walk-in</Text>
          </View>
          {!!request?.purpose && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Purpose</Text>
              <Text style={styles.detailValue}>{request.purpose}</Text>
            </View>
          )}
        </View>

        <Text style={styles.timerText}>
          Auto-deny in <Text style={styles.timerNumber}>{timeLeft}s</Text>
        </Text>

      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.denyButton, submitting && { opacity: 0.6 }]} onPress={() => handleAction('DENIED')} disabled={submitting}>
          <Text style={styles.denyButtonText}>✕ Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.approveButton, submitting && { opacity: 0.6 }]} onPress={() => handleAction('APPROVED')} disabled={submitting}>
          <Text style={styles.approveButtonText}>✓ Approve</Text>
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 4,
    borderColor: '#bfdbfe',
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
    backgroundColor: colors.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  denyButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: 'bold',
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  approveButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
