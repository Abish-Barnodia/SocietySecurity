import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Button, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../context/ThemeContext';
import { useData, Pass } from '../context/DataContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../utils/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ScanPass'>;

type EntryPoint = { id: string; name: string };
type UnitOption = { id: string; unitNumber: string; tower: string | null };

export default function ScanPassScreen({ navigation }: { navigation: NavigationProp }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { passes, addScanRequest } = useData();
  const [passId, setPassId] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [submitting, setSubmitting] = useState(false);

  // Step 2 State
  const [scannedPass, setScannedPass] = useState<Pass | null>(null);
  const [walkInName, setWalkInName] = useState<string | null>(null);

  // Gate + destination unit — needed to log an entry / raise a walk-in request against the live backend
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [towers, setTowers] = useState<string[]>([]);
  const [selectedTower, setSelectedTower] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/entries/entry-points').then((res) => setEntryPoints(res.data.data ?? [])).catch(() => {});
    api.get('/residents/towers').then((res) => setTowers(res.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTower) {
      setUnits([]);
      setSelectedUnitId(null);
      return;
    }
    api.get('/residents/units', { params: { tower: selectedTower } })
      .then((res) => setUnits(res.data.data ?? []))
      .catch(() => setUnits([]));
    setSelectedUnitId(null);
  }, [selectedTower]);

  const handleLookup = (data?: string) => {
    let pId = data || passId.trim();
    let name = visitorName.trim();

    if (pId) {
      // Issue 11 fix: strict equality — no fuzzy UUID matching
      const foundPass = passes.find(p => p.id === pId);
      if (foundPass) {
        setScannedPass(foundPass);
        return;
      }
    }

    if (name) {
      setWalkInName(name);
      return;
    }

    if (pId && !name) {
      Alert.alert('Not found', 'Pass not found. Please try again or enter name for Walk-in.');
      setScanned(false);
    } else {
      Alert.alert('Missing details', 'Please enter a Pass ID or Visitor Name');
    }
  };

  const confirmAction = async () => {
    if (submitting) return;
    if (scannedPass) {
      if (scannedPass.status === 'Active') {
        if (!entryPoints[0]) {
          Alert.alert('No gate configured', 'No entry point is configured for this property yet.');
          return;
        }
        setSubmitting(true);
        try {
          await api.post('/entries', {
            unitId: scannedPass.unitId,
            entryPointId: entryPoints[0].id,
            method: 'QR_SCAN',
            visitorName: scannedPass.name,
            qrPayload: scannedPass.qrPayload,
          });
          Alert.alert('Entry Logged', 'Entry logged successfully.');
          navigation.goBack();
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.message ?? 'Failed to log entry.');
        } finally {
          setSubmitting(false);
        }
      } else {
        // Pass is suspended or expired — the pass already tells us which unit it belongs to
        sendApprovalRequest(scannedPass.name, scannedPass.unitId);
      }
    } else if (walkInName) {
      if (!selectedUnitId) {
        Alert.alert('Select destination', 'Please select the tower and flat this visitor is going to.');
        return;
      }
      sendApprovalRequest(walkInName, selectedUnitId);
    }
  };

  const sendApprovalRequest = async (name: string, unitId: string) => {
    if (!entryPoints[0]) {
      Alert.alert('No gate configured', 'No entry point is configured for this property yet.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.post('/walkin/request', {
        unitId,
        entryPointId: entryPoints[0].id,
        visitorName: name,
      });
      const entry = response.data.data;
      addScanRequest({
        id: entry.id,
        visitorName: name,
        status: 'PENDING',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      Alert.alert('Request sent', 'The resident has been notified and will respond shortly.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to send the approval request.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetScanner = () => {
    setScannedPass(null);
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          
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
                    <View style={[styles.statusBadge, { backgroundColor: scannedPass.status === 'Active' ? colors.success + '20' : colors.danger + '20' }]}>
                      <Text style={[styles.statusText, { color: scannedPass.status === 'Active' ? colors.success : colors.danger }]}>{scannedPass.status}</Text>
                    </View>
                  </View>
                </>
              )}

              {!scannedPass && walkInName && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Method</Text>
                    <Text style={styles.detailValue}>Walk-in</Text>
                  </View>

                  <Text style={[styles.label, { marginTop: 16 }]}>Tower</Text>
                  <View style={styles.chipRow}>
                    {towers.map((tower) => (
                      <TouchableOpacity
                        key={tower}
                        style={[styles.chip, selectedTower === tower && styles.chipActive]}
                        onPress={() => setSelectedTower(tower)}
                      >
                        <Text style={[styles.chipText, selectedTower === tower && styles.chipTextActive]}>{tower}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedTower && (
                    <>
                      <Text style={styles.label}>Flat</Text>
                      <View style={styles.chipRow}>
                        {units.length === 0 ? (
                          <Text style={{ color: colors.textMuted }}>No flats found in {selectedTower}.</Text>
                        ) : (
                          units.map((unit) => (
                            <TouchableOpacity
                              key={unit.id}
                              style={[styles.chip, selectedUnitId === unit.id && styles.chipActive]}
                              onPress={() => setSelectedUnitId(unit.id)}
                            >
                              <Text style={[styles.chipText, selectedUnitId === unit.id && styles.chipTextActive]}>{unit.unitNumber}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    </>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[styles.scanButton, { marginTop: 24, backgroundColor: (scannedPass && scannedPass.status === 'Active') ? colors.success : colors.primary, opacity: submitting ? 0.6 : 1 }]}
                onPress={confirmAction}
                disabled={submitting}
              >
                <Text style={styles.scanButtonText}>
                  {submitting ? 'Please wait…' : (scannedPass && scannedPass.status === 'Active') ? 'Allow Entry' : 'Request Resident Approval'}
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
                    handleLookup(data);
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
                  value={passId}
                  onChangeText={setPassId}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Walk-in Visitor Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul Sharma"
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

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  content: {
    padding: 24,
  },
  scannerBox: {
    height: 300,
    backgroundColor: '#000',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scannerCornerTL: { position: 'absolute', top: 40, left: 40, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: colors.primary },
  scannerCornerTR: { position: 'absolute', top: 40, right: 40, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: colors.primary },
  scannerCornerBL: { position: 'absolute', bottom: 40, left: 40, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: colors.primary },
  scannerCornerBR: { position: 'absolute', bottom: 40, right: 40, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: colors.primary },
  scannerText: { color: colors.card, fontWeight: 'bold' },
  scannerTextActive: { color: colors.success, fontWeight: 'bold', marginTop: 10, fontSize: 18 },
  
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.card,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  scanButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  scanButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsCard: {
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailsHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  resetButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  resetButtonText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});
