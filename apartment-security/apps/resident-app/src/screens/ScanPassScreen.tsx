import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Button } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { useData, Pass } from '../context/DataContext';
import { CameraView, useCameraPermissions } from 'expo-camera';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ScanPass'>;

export default function ScanPassScreen({ navigation }: { navigation: NavigationProp }) {
  const { passes, addScanRequest, addAlert, addEntry } = useData();
  const [passId, setPassId] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  
  // Step 2 State
  const [scannedPass, setScannedPass] = useState<Pass | null>(null);
  const [walkInName, setWalkInName] = useState<string | null>(null);

  const handleLookup = (data?: string) => {
    let pId = data || passId.trim();
    let name = visitorName.trim();

    if (pId) {
      const foundPass = passes.find(p => p.id === pId || p.id.includes(pId));
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
      alert("Pass not found. Please try again or enter name for Walk-in.");
      setScanned(false);
    } else {
      alert("Please enter a Pass ID or Visitor Name");
    }
  };

  const confirmAction = () => {
    if (scannedPass) {
      if (scannedPass.status === 'Active') {
        // Direct Entry
        addEntry({
          id: Math.random().toString(36).substr(2, 9),
          name: scannedPass.name,
          initials: scannedPass.name.charAt(0).toUpperCase(),
          color: scannedPass.color,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Entered',
          method: 'QR scan',
          gate: 'Main Gate',
          statusColor: colors.success,
          date: 'TODAY'
        });
        alert('Entry Logged Successfully!');
        navigation.goBack();
      } else {
        // Pass is suspended or expired, request approval anyway
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
    
    // Simulate push notification to resident
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Method</Text>
                  <Text style={styles.detailValue}>Walk-in</Text>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.scanButton, { marginTop: 24, backgroundColor: (scannedPass && scannedPass.status === 'Active') ? colors.success : colors.primary }]} 
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

const styles = StyleSheet.create({
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
  scannerText: { color: colors.white, fontWeight: 'bold' },
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
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
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsCard: {
    backgroundColor: colors.white,
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
