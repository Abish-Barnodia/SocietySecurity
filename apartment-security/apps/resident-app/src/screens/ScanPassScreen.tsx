import { useGuardState, useAlerts, useEntries } from '../context/DomainContexts';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Button, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../utils/api';
import { useTheme } from '../theme/ThemeContext';
import { Pass } from '../context/DataContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ScanPass'>;

export default function ScanPassScreen({ navigation }: { navigation: NavigationProp }) {
  const { addScanRequest } = useGuardState();
  const { addAlert } = useAlerts();
  const { addEntry } = useEntries();
  const [passId, setPassId] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  // Step 2 State
  const [scannedPass, setScannedPass] = useState<Pass | null>(null);
  const [scannedQrPayload, setScannedQrPayload] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState<string | null>(null);

  const mapPass = (p: any): Pass => {
    let typeStr = 'One-time visitor';
    if (p.type === 'RECURRING') typeStr = 'Recurring';
    if (p.type === 'DELIVERY') typeStr = 'Delivery / service';
    if (p.type === 'CONTRACTOR') typeStr = 'Contractor';

    let statusStr: 'Active' | 'Suspended' | 'Expired' = 'Active';
    if (p.status === 'SUSPENDED') statusStr = 'Suspended';
    if (p.status !== 'ACTIVE' && p.status !== 'SUSPENDED') statusStr = 'Expired';

    return {
      id: p.id,
      name: p.visitorName || 'Unknown',
      type: typeStr,
      status: statusStr,
      time: p.validFrom,
      purpose: p.purpose || 'Visit',
      color: statusStr === 'Active' ? '#10b981' : '#f43f5e',
      created: p.createdAt,
      gate: p.unitId,
      qrPayload: p.qrPayload
    };
  };

  const handleQrScan = async (data: string) => {
    setScannedQrPayload(data);
    try {
      const base64Part = data.split('.')[0];
      const parsed = JSON.parse(atob(base64Part));
      
      const response = await api.get(`/passes/verify/${parsed.passId}`);
      setScannedPass(mapPass(response.data.data));
      return;
    } catch (error) { 
      console.log('Error verifying QR pass', error);
    }
    
    alert("Pass not found or invalid QR code.");
    setScanned(false);
  };

  const handleLookup = async (pId?: string) => {
    const id = pId || passId.trim();
    const name = visitorName.trim();

    if (id) {
      try {
        const response = await api.get(`/passes/verify/${id}`);
        setScannedPass(mapPass(response.data.data));
        return;
      } catch (err) {
        alert("Pass not found. Please try again or enter name for Walk-in.");
        setScanned(false);
        return;
      }
    }

    if (name) {
      setWalkInName(name);
      return;
    }

    alert("Please enter a Pass ID or Visitor Name");
  };

  const confirmAction = async () => {
    if (scannedPass) {
      if (scannedPass.status === 'Active') {
        try {
          await api.post('/entries', {
            unitId: scannedPass.gate ?? null,
            method: 'QR_SCAN',
            visitorName: scannedPass.name,
            qrPayload: scannedPass.qrPayload ?? scannedQrPayload ?? scannedPass.id,
          });
          Alert.alert('Entry Logged', 'Entry logged successfully.');
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.message ?? 'Failed to log entry.');
          return;
        }
        navigation.goBack();
      } else {
        sendApprovalRequest(scannedPass.name, scannedPass.id);
      }
    } else if (walkInName) {
      sendApprovalRequest(walkInName, undefined);
    }
  };

  const sendApprovalRequest = (name: string, pId?: string) => {
    const reqId = Math.random().toString(36).substr(2, 9);
    addScanRequest({
      id: reqId,
      passId: pId,
      visitorName: name,
      status: 'PENDING',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    addAlert({
      id: reqId,
      title: 'Walk-in approval requested',
      subtitle: `Guard requested entry for ${name} at Main Gate`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon: '🔔',
      unread: true,
    });

    import('../utils/notifications').then(({ scheduleLocalNotification }) => {
      scheduleLocalNotification(
        'Walk-in approval requested',
        `Guard requested entry for ${name} at Main Gate`
      );
    });

    alert('Approval request sent to Resident!');
    navigation.goBack();
  };

  const resetScanner = () => {
    setScannedPass(null);
    setScannedQrPayload(null);
    setWalkInName(null);
    setScanned(false);
    setPassId('');
    setVisitorName('');
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {scannedPass || walkInName ? (
            <View style={styles.detailsCard}>
              <Text style={styles.detailsHeader}>Visitor Details</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{scannedPass ? scannedPass.name : walkInName}</Text>
              </View>

              {scannedPass && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pass Type</Text>
                    <Text style={styles.detailValue}>{scannedPass.type}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Purpose</Text>
                    <Text style={styles.detailValue}>{scannedPass.purpose}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[styles.statusBadge, { backgroundColor: scannedPass.status === 'Active' ? (isDarkMode ? '#052e16' : colors.success + '20') : (isDarkMode ? '#450a0a' : colors.danger + '20') }]}>
                      <Text style={[styles.statusText, { color: scannedPass.status === 'Active' ? colors.success : colors.danger }]}>{scannedPass.status}</Text>
                    </View>
                  </View>
                </>
              )}

              {!scannedPass && walkInName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Method</Text>
                  <Text style={styles.detailValue}>Walk-in</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.scanButton, { marginTop: spacing.xl, backgroundColor: (scannedPass && scannedPass.status === 'Active') ? colors.success : colors.primary }]}
                onPress={confirmAction}
              >
                <Text style={styles.scanButtonText}>
                  {(scannedPass && scannedPass.status === 'Active') ? 'Allow Entry' : 'Request Resident Approval'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.resetButton} onPress={resetScanner}>
                <Text style={styles.resetButtonText}>Cancel & Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.scannerBox}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : ({ data }) => {
                    setScanned(true);
                    handleQrScan(data);
                  }}
                >
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerCornerTL} />
                    <View style={styles.scannerCornerTR} />
                    <View style={styles.scannerCornerBL} />
                    <View style={styles.scannerCornerBR} />
                    <Text style={styles.scannerText}>Align QR Code</Text>
                  </View>
                </CameraView>
              </View>

              <Text style={styles.title}>Manual Entry</Text>
              <Text style={styles.subtitle}>Enter a valid pass code or visitor name</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pass ID (if known)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 123456"
                  placeholderTextColor={colors.textMuted}
                  value={passId}
                  onChangeText={setPassId}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Walk-in Visitor Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={colors.textMuted}
                  value={visitorName}
                  onChangeText={setVisitorName}
                />
              </View>

              <TouchableOpacity style={styles.scanButton} onPress={() => handleLookup()}>
                <Text style={styles.scanButtonText}>Search & Verify</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  permissionText: {
    textAlign: 'center' as const,
    marginBottom: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  scannerBox: {
    height: 300,
    backgroundColor: '#000',
    borderRadius: roundness.xl,
    overflow: 'hidden' as const,
    marginBottom: spacing.xxl,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    position: 'relative' as const,
  },
  scannerCornerTL: { position: 'absolute' as const, top: 40, left: 40, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: colors.primary },
  scannerCornerTR: { position: 'absolute' as const, top: 40, right: 40, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: colors.primary },
  scannerCornerBL: { position: 'absolute' as const, bottom: 40, left: 40, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: colors.primary },
  scannerCornerBR: { position: 'absolute' as const, bottom: 40, right: 40, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: colors.primary },
  scannerText: { color: colors.white, fontWeight: typography.weights.bold },
  
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    borderRadius: roundness.lg,
    padding: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  scanButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: roundness.lg,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  scanButtonText: {
    color: isDarkMode ? colors.white : colors.text, // Assuming black text for contrast in light mode on golden mustard
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: roundness.xl,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailsHeader: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center' as const,
  },
  detailRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
  },
  detailValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: roundness.md,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  resetButton: {
    padding: 16,
    borderRadius: roundness.lg,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  resetButtonText: {
    color: colors.textMuted,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
