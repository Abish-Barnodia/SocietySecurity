import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../utils/api';
import { colors } from '../theme/colors';

type Unit = { id: string; unitNumber: string; residents: { name: string }[] };
type RecentVisitor = { visitorName: string; vehicleNumber: string | null };

export default function WalkInScreen({ navigation }: any) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [entryPoints, setEntryPoints] = useState<{ id: string; name: string }[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<RecentVisitor[]>([]);
  
  const [visitorName, setVisitorName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [blockInput, setBlockInput] = useState('');
  const [flatInput, setFlatInput] = useState('');
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const [flatPickerOpen, setFlatPickerOpen] = useState(false);
  const [selectedGateId, setSelectedGateId] = useState('');
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Ponytail: load everything at once, minimum boilerplate
    Promise.all([
      api.get('/entries/entry-points'),
      api.get('/entries/units'),
      api.get('/entries/frequent-visitors')
    ]).then(([gatesRes, unitsRes, visRes]) => {
      const gates = gatesRes.data.data ?? [];
      setEntryPoints(gates);
      if (gates.length > 0) setSelectedGateId(gates[0].id);
      
      setUnits(unitsRes.data.data ?? []);
      setRecentVisitors(visRes.data.data ?? []);
    }).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!visitorName.trim() || !flatInput.trim()) {
      Alert.alert('Missing Fields', 'Please fill in visitor name and flat number.');
      return;
    }
    if (!selectedGateId) {
      Alert.alert('System Error', 'No gate selected. Are gates configured for this property?');
      return;
    }
    
    // Find the unit ID from the pre-loaded units list
    const unit = units.find(u => 
      (u.tower || '').toLowerCase() === blockInput.trim().toLowerCase() && 
      u.unitNumber.toLowerCase() === flatInput.trim().toLowerCase()
    );
    
    if (!unit) {
      Alert.alert('Unit Not Found', 'Could not find a flat matching that block and flat number.');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post('/walkins/request', {
        unitId: unit.id,
        entryPointId: selectedGateId,
        visitorName,
        vehicleNumber,
        purpose,
        visitorPhone: '0000000000',
        gatePhotoBase64: photoBase64,
      });
      Alert.alert('Success', 'Approval request sent to resident!', [
        { text: 'OK', onPress: () => {
          setVisitorName(''); setVehicleNumber(''); setPurpose(''); 
          setBlockInput(''); setFlatInput(''); setPhotoBase64(null);
          navigation.goBack();
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  const autofill = (v: RecentVisitor) => {
    setVisitorName(v.visitorName);
    if (v.vehicleNumber) setVehicleNumber(v.vehicleNumber);
  };

  const handleCameraPress = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission required', 'Camera permission is needed to take photos.');
        return;
      }
    }
    setIsCameraOpen(true);
  };

  const takePicture = async () => {
    if (cameraRef) {
      try {
        const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.5 });
        if (photo?.base64) {
          setPhotoBase64(photo.base64);
          setIsCameraOpen(false);
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };

  if (isCameraOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView style={{ flex: 1 }} facing="back" ref={ref => setCameraRef(ref)}>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraCancel} onPress={() => setIsCameraOpen(false)}>
              <Text style={{ color: 'white', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCapture} onPress={takePicture}>
              <View style={styles.cameraCaptureInner} />
            </TouchableOpacity>
            <View style={{ width: 60 }} />
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Walk-In Visitor</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          
          {recentVisitors.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Recent Visitors (Tap to auto-fill)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {recentVisitors.map((v, i) => (
                  <TouchableOpacity key={i} style={styles.chip} onPress={() => autofill(v)}>
                    <Text style={styles.chipText}>{v.visitorName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.label}>Visitor Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Full name of the visitor"
            value={visitorName}
            onChangeText={setVisitorName}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Vehicle Number (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. MH-02-AB-1234"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Visiting Resident</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setBlockPickerOpen(true)}>
              <Text style={{ color: blockInput ? colors.text : colors.textMuted }}>
                {blockInput || 'Block / Tower'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => {
              const hasBlocks = units.some(u => u.tower && u.tower.trim() !== '');
              if (!blockInput && hasBlocks) {
                Alert.alert('Select Block', 'Please select a block first.');
                return;
              }
              setFlatPickerOpen(true);
            }}>
              <Text style={{ color: flatInput ? colors.text : colors.textMuted }}>
                {flatInput || 'Flat no.'}
              </Text>
            </TouchableOpacity>
          </View>
          {units.length === 0 && <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>Loading flats in background...</Text>}

          <Text style={styles.label}>Purpose of Visit</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="e.g. Food delivery, guest, maintenance..."
            value={purpose}
            onChangeText={setPurpose}
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.label}>Visitor Photo (optional)</Text>
          <TouchableOpacity style={styles.photoBox} onPress={handleCameraPress}>
            {photoBase64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={{ width: 100, height: 100, borderRadius: 8 }} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                <Text style={styles.photoBoxText}>Tap to capture photo</Text>
                <Text style={styles.photoBoxSub}>Uses device camera</Text>
              </>
            )}
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.submitButtonText}>Send Approval Request</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={blockPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setBlockPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={Array.from(new Set(units.map(u => u.tower || ''))).sort()}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setBlockInput(item); setFlatInput(''); setBlockPickerOpen(false); }}
                >
                  <Text style={styles.modalItemText}>{item || '(No Block)'}</Text>
                  {item === blockInput && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={flatPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFlatPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={units.filter(u => (u.tower || '') === blockInput).sort((a,b) => a.unitNumber.localeCompare(b.unitNumber))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setFlatInput(item.unitNumber); setFlatPickerOpen(false); }}
                >
                  <Text style={styles.modalItemText}>{item.unitNumber}</Text>
                  {item.unitNumber === flatInput && <Ionicons name="checkmark" size={20} color={colors.primary} />}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
  },
  photoBox: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  photoBoxText: { fontSize: 16, fontWeight: '600', color: colors.textMuted, marginTop: 8 },
  photoBoxSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  footer: { padding: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: { color: colors.card, fontSize: 18, fontWeight: 'bold' },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipText: { color: colors.text, fontSize: 14 },
  unitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unitChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  unitChipText: { color: colors.text, fontSize: 14 },
  unitChipTextSelected: { color: colors.primary, fontWeight: 'bold' },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  cameraCancel: {
    padding: 16,
  },
  cameraCapture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCaptureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%', paddingVertical: 8 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  modalItemText: { fontSize: 16, color: colors.text }
});
