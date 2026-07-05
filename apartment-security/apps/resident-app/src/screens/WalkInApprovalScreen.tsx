import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { colors } from '../theme/colors';
import { useData } from '../context/DataContext';

export default function WalkInApprovalScreen({ route, navigation }: { route: any; navigation: any }) {
  const { requestId } = route.params || {};
  const { scanRequests, updateScanRequestStatus, markAlertRead, addEntry } = useData();
  const [timeLeft, setTimeLeft] = useState(47);

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

  const handleAction = (action: 'APPROVED' | 'DENIED') => {
    if (requestId) {
      updateScanRequestStatus(requestId, action);
      markAlertRead(requestId);

      addEntry({
        id: Math.random().toString(36).substr(2, 9),
        name: visitorName,
        initials: visitorName.charAt(0).toUpperCase(),
        color: action === 'APPROVED' ? colors.primary : colors.danger,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: action === 'APPROVED' ? 'Entered' : 'Denied',
        method: request?.passId ? 'QR scan' : 'Walk-in',
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
    color: colors.white,
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
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
