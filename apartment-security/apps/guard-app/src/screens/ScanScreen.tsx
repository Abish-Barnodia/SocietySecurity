import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList,
  ActivityIndicator, Linking, Alert, TextInput, Button,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { getSocket } from '../utils/socket';
import { submitScan, callResident, ScanResult } from '../services/scannerService';
import PassSummary from '../components/PassSummary';
import ClearanceCard, { ClearanceState } from '../components/ClearanceCard';
import { colors } from '../theme/colors';

type EntryPoint = { id: string; name: string };

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [gate, setGate] = useState<EntryPoint | null>(null);
  const [gatePickerOpen, setGatePickerOpen] = useState(false);

  const [mode, setMode] = useState<'qr' | 'otp'>('qr');
  const [otp, setOtp] = useState('');

  const [scanned, setScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [clearance, setClearance] = useState<ClearanceState>('PENDING');
  const [calling, setCalling] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/entries/entry-points').then((res) => setEntryPoints(res.data.data ?? [])).catch(() => {});
  }, []);

  // Live updates for the currently-displayed scan only.
  useEffect(() => {
    if (!result?.id || result.status !== 'PENDING_APPROVAL') return;
    const socket = getSocket();
    if (!socket) return;

    const onResponse = (payload: { entryId: string; status: 'APPROVED' | 'DENIED' }) => {
      if (payload.entryId === result.id) setClearance(payload.status);
    };
    const onTimeout = (payload: { entryId: string }) => {
      if (payload.entryId === result.id) setClearance('TIMEOUT');
    };

    socket.on('visitor_approval_response', onResponse);
    socket.on('visitor_approval_timeout', onTimeout);
    return () => {
      socket.off('visitor_approval_response', onResponse);
      socket.off('visitor_approval_timeout', onTimeout);
    };
  }, [result?.id, result?.status]);

  const handleScan = async (data: string) => {
    if (!gate) return;
    setScanned(true);
    setSubmitting(true);
    try {
      const scan = await submitScan(gate.id, data);
      setResult(scan);
      setClearance(scan.status === 'PENDING_APPROVAL' ? 'PENDING' : (scan.status as ClearanceState));
    } catch (error: any) {
      Alert.alert('Scan failed', error.response?.data?.message ?? 'Could not verify this pass. Check your connection and try again.');
      setScanned(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallResident = async () => {
    if (!result?.id) return;
    const phone = result.residentPhone;
    if (!phone) {
      Alert.alert('No phone on file', "This resident doesn't have a phone number on record.");
      return;
    }
    setCalling(true);
    try {
      await Linking.openURL(`tel:${phone}`);
      await callResident(result.id);
    } catch {
      Alert.alert('Could not call', 'Your device could not open the dialer.');
    } finally {
      setCalling(false);
    }
  };

  const resetScanner = () => {
    setResult(null);
    setScanned(false);
    setClearance('PENDING');
    setOtp('');
  };

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.permissionText}>Camera access is needed to scan visitor passes.</Text>
        <Button onPress={requestPermission} title="Grant permission" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {result ? (
        <View style={styles.content}>
          <PassSummary
            visitorName={result.visitorName ?? 'Unknown visitor'}
            visitorPhoto={result.visitorPhoto}
            visitorPhone={result.visitorPhone}
            vehicleNumber={result.vehicleNumber}
            apartment={result.unit?.unitNumber}
            tower={result.unit?.tower}
            gateName={result.gateName}
          />
          <View style={{ height: 16 }} />
          <ClearanceCard state={clearance} timeoutAt={result.timeoutAt} reason={result.reason} />

          {clearance === 'TIMEOUT' && (
            <TouchableOpacity style={styles.callButton} onPress={handleCallResident} disabled={calling}>
              {calling ? <ActivityIndicator color={colors.white} /> : (
                <Text style={styles.callButtonText}>Call Resident</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={resetScanner}>
            <Text style={styles.resetButtonText}>Scan Next</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <TouchableOpacity style={styles.gatePicker} onPress={() => setGatePickerOpen(true)}>
            <Text style={[styles.gatePickerText, !gate && styles.placeholderText]}>
              {gate?.name ?? 'Select the gate you are scanning at'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {gate ? (
            <View style={{ gap: 16 }}>
              <View style={styles.segmentContainer}>
                <TouchableOpacity 
                  style={[styles.segmentButton, mode === 'qr' && styles.segmentActive]} 
                  onPress={() => setMode('qr')}
                >
                  <Text style={[styles.segmentText, mode === 'qr' && styles.segmentTextActive]}>Scan QR</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.segmentButton, mode === 'otp' && styles.segmentActive]} 
                  onPress={() => setMode('otp')}
                >
                  <Text style={[styles.segmentText, mode === 'otp' && styles.segmentTextActive]}>Enter OTP</Text>
                </TouchableOpacity>
              </View>

              <View style={mode === 'qr' ? styles.scannerBox : styles.simulatedBox}>
                {mode === 'qr' ? (
                  <>
                    <CameraView
                      key={gate.id}
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      onBarcodeScanned={scanned ? undefined : ({ data }) => handleScan(data)}
                      onCameraReady={() => setCameraError(null)}
                      onMountError={(e) => setCameraError(e.message || 'Camera failed to start')}
                    />
                    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
                      {cameraError ? (
                        <Text style={styles.overlayText}>{cameraError}</Text>
                      ) : submitting ? (
                        <ActivityIndicator color={colors.white} size="large" />
                      ) : (
                        <Text style={styles.overlayText}>Align QR code within frame</Text>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <TextInput 
                      style={styles.otpInput} 
                      placeholder="Enter 6-digit OTP" 
                      placeholderTextColor={colors.textMuted}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity 
                      style={[styles.simulateButton, !otp && { opacity: 0.5 }]} 
                      onPress={() => handleScan(`OTP:${otp}`)}
                      disabled={submitting || !otp}
                    >
                      {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.simulateButtonText}>Verify OTP</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.scannerPlaceholder}>
              <Text style={styles.placeholderText}>Pick a gate to start scanning</Text>
            </View>
          )}
        </View>
      )}

      <Modal visible={gatePickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setGatePickerOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={entryPoints}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setGate(item); setGatePickerOpen(false); }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  {item.id === gate?.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  content: { flex: 1, padding: 20 },
  permissionText: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },

  gatePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  gatePickerText: { fontSize: 15, color: colors.text },
  placeholderText: { color: colors.textMuted },

  scannerBox: { height: 340, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  overlayText: { color: colors.white, fontWeight: '700' },

  scannerPlaceholder: {
    height: 340, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  segmentContainer: {
    flexDirection: 'row', backgroundColor: colors.border, borderRadius: 30, padding: 4,
  },
  segmentButton: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 26,
  },
  segmentActive: {
    backgroundColor: colors.primaryDark,
  },
  segmentText: {
    fontSize: 15, fontWeight: '700', color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.white,
  },
  simulatedBox: {
    height: 280, borderRadius: 20, backgroundColor: colors.border, borderWidth: 2,
    borderColor: colors.textMuted, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  iconBox: {
    backgroundColor: colors.primaryLight, padding: 16, borderRadius: 16, marginBottom: 16,
  },
  simulatedText: {
    fontSize: 15, color: colors.textMuted, marginBottom: 24,
  },
  simulateButton: {
    backgroundColor: colors.primaryDark, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 30, width: '80%', alignItems: 'center',
  },
  simulateButtonText: {
    color: colors.white, fontSize: 15, fontWeight: '700',
  },
  otpInput: {
    width: '80%', backgroundColor: colors.white, borderRadius: 12, padding: 16, fontSize: 18, textAlign: 'center', marginBottom: 24, borderWidth: 1, borderColor: colors.border, color: colors.text
  },

  callButton: {
    backgroundColor: colors.danger, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12,
  },
  callButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  resetButton: {
    backgroundColor: '#F5F5F5', borderRadius: 16, padding: 16, alignItems: 'center',
  },
  resetButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%', paddingVertical: 8 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  modalItemText: { fontSize: 16, color: colors.text },
});
