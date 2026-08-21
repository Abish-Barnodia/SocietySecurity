import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Modal, FlatList
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../utils/api';
import { getCached } from '../../utils/cachedFetch';
import { queueWalkin } from '../../services/syncService';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/colors';

type Unit = { id: string; unitNumber: string; tower: string | null; residents: { name: string }[] };
type RecentVisitor = { visitorName: string; vehicleNumber: string | null };
type DomesticWorker = { id: string; name: string; type: string; entryTime: string; exitTime: string };

export default function WalkInScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();

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
  const [loadError, setLoadError] = useState(false);

  const [domesticWorkers, setDomesticWorkers] = useState<DomesticWorker[]>([]);
  const [clearingWorkerId, setClearingWorkerId] = useState<string | null>(null);

  const loadPrefetch = () => {
    setLoadError(false);
    // Ponytail: load everything at once, minimum boilerplate
    Promise.all([
      getCached('entry-points', () => api.get('/entries/entry-points').then((res) => res.data.data ?? [])),
      getCached('units', () => api.get('/entries/units').then((res) => res.data.data ?? [])),
      api.get('/entries/frequent-visitors'),
    ]).then(([gates, unitsData, visRes]) => {
      setEntryPoints(gates);
      if (gates.length > 0) setSelectedGateId(gates[0].id);

      setUnits(unitsData);
      setRecentVisitors(visRes.data.data ?? []);
    }).catch((error) => {
      console.error(error);
      setLoadError(true);
    });
  };

  useEffect(() => {
    loadPrefetch();
  }, []);

  // Once the guard has picked a specific flat, show that unit's registered
  // staff so a routine daily arrival doesn't need the full walk-in form.
  useEffect(() => {
    const unit = units.find(u => (u.tower || '') === blockInput && u.unitNumber === flatInput);
    if (!unit) { setDomesticWorkers([]); return; }
    api.get(`/domestic-workers/unit/${unit.id}`)
      .then((res) => setDomesticWorkers(res.data.data ?? []))
      .catch(() => setDomesticWorkers([]));
  }, [blockInput, flatInput, units]);

  const handleClearWorker = async (worker: DomesticWorker) => {
    if (!selectedGateId) {
      Alert.alert(t('walkin_systemErrorTitle'), t('walkin_systemErrorMsg'));
      return;
    }
    setClearingWorkerId(worker.id);
    try {
      await api.post('/domestic-workers/entries', { domesticWorkerId: worker.id, entryPointId: selectedGateId });
      Alert.alert(t('walkin_staffCleared'), `${worker.name} ${t('walkin_staffClearedMsg')}`);
    } catch (error: any) {
      Alert.alert(t('common_error'), error.response?.data?.message ?? t('walkin_errorMsg'));
    } finally {
      setClearingWorkerId(null);
    }
  };

  const handleSubmit = async () => {
    if (!visitorName.trim() || !flatInput.trim()) {
      Alert.alert(t('walkin_missingFieldsTitle'), t('walkin_missingFieldsMsg'));
      return;
    }
    if (!selectedGateId) {
      Alert.alert(t('walkin_systemErrorTitle'), t('walkin_systemErrorMsg'));
      return;
    }

    // Find the unit ID from the pre-loaded units list
    const unit = units.find(u =>
      (u.tower || '').toLowerCase() === blockInput.trim().toLowerCase() &&
      u.unitNumber.toLowerCase() === flatInput.trim().toLowerCase()
    );

    if (!unit) {
      Alert.alert(t('walkin_unitNotFoundTitle'), t('walkin_unitNotFoundMsg'));
      return;
    }

    const payload = {
      unitId: unit.id,
      entryPointId: selectedGateId,
      visitorName,
      vehicleNumber,
      purpose,
      gatePhotoBase64: photoBase64,
    };

    const resetForm = () => {
      setVisitorName(''); setVehicleNumber(''); setPurpose('');
      setBlockInput(''); setFlatInput(''); setPhotoBase64(null);
      navigation.goBack();
    };

    setSubmitting(true);
    try {
      await api.post('/walkins/request', payload);
      Alert.alert(t('walkin_successTitle'), t('walkin_successMsg'), [
        { text: t('common_ok'), onPress: resetForm }
      ]);
    } catch (error: any) {
      if (!error.response) {
        // no network -- keep the entry locally and sync it once we reconnect
        await queueWalkin(payload);
        Alert.alert(t('walkin_offlineSavedTitle'), t('walkin_offlineSavedMsg'), [
          { text: t('common_ok'), onPress: resetForm }
        ]);
      } else {
        Alert.alert(t('common_error'), error.response?.data?.message ?? t('walkin_errorMsg'));
      }
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
        Alert.alert(t('walkin_permissionRequiredTitle'), t('walkin_permissionRequiredMsg'));
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
        Alert.alert(t('common_error'), t('walkin_cameraFailedMsg'));
      }
    }
  };

  if (isCameraOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView style={{ flex: 1 }} facing="back" ref={ref => setCameraRef(ref)}>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraCancel} onPress={() => setIsCameraOpen(false)}>
              <Text style={{ color: 'white', fontSize: 16 }}>{t('common_cancel')}</Text>
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
        <Text style={styles.headerTitle}>{t('walkin_headerTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {loadError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{t('common_loadFailed')}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadPrefetch}>
                <Text style={styles.retryButtonText}>{t('common_retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {recentVisitors.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>{t('walkin_recentVisitors')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {recentVisitors.map((v, i) => (
                  <TouchableOpacity key={i} style={styles.chip} onPress={() => autofill(v)}>
                    <Text style={styles.chipText}>{v.visitorName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.label}>{t('walkin_visitorName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('walkin_visitorNamePlaceholder')}
            value={visitorName}
            onChangeText={setVisitorName}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>{t('walkin_vehicleNumber')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('walkin_vehicleNumberPlaceholder')}
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>{t('walkin_visitingResident')}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setBlockPickerOpen(true)}>
              <Text style={{ color: blockInput ? colors.text : colors.textMuted }}>
                {blockInput || t('walkin_blockTower')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => {
              const hasBlocks = units.some(u => u.tower && u.tower.trim() !== '');
              if (!blockInput && hasBlocks) {
                Alert.alert(t('walkin_selectBlockTitle'), t('walkin_selectBlockMsg'));
                return;
              }
              setFlatPickerOpen(true);
            }}>
              <Text style={{ color: flatInput ? colors.text : colors.textMuted }}>
                {flatInput || t('walkin_flatNo')}
              </Text>
            </TouchableOpacity>
          </View>
          {units.length === 0 && <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>{t('walkin_loadingFlats')}</Text>}

          {domesticWorkers.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>{t('walkin_registeredStaff')}</Text>
              {domesticWorkers.map((worker) => (
                <View key={worker.id} style={styles.workerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>{worker.name}</Text>
                    <Text style={styles.workerMeta}>{worker.type} · {worker.entryTime}–{worker.exitTime}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.clearInButton, clearingWorkerId === worker.id && { opacity: 0.6 }]}
                    onPress={() => handleClearWorker(worker)}
                    disabled={clearingWorkerId === worker.id}
                  >
                    {clearingWorkerId === worker.id ? (
                      <ActivityIndicator color={colors.card} size="small" />
                    ) : (
                      <Text style={styles.clearInButtonText}>{t('walkin_clearIn')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>{t('walkin_purposeOfVisit')}</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder={t('walkin_purposePlaceholder')}
            value={purpose}
            onChangeText={setPurpose}
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.label}>{t('walkin_visitorPhoto')}</Text>
          <TouchableOpacity style={styles.photoBox} onPress={handleCameraPress}>
            {photoBase64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={{ width: 100, height: 100, borderRadius: 8 }} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                <Text style={styles.photoBoxText}>{t('walkin_tapToCapture')}</Text>
                <Text style={styles.photoBoxSub}>{t('walkin_usesCamera')}</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.submitButtonText}>{t('walkin_sendRequest')}</Text>
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
                  <Text style={styles.modalItemText}>{item || t('walkin_noBlock')}</Text>
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

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.dangerLight, borderRadius: 12, padding: 12, marginBottom: 16, gap: 12,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '600' },
  retryButton: { backgroundColor: colors.danger, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  workerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  workerMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  clearInButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 76,
    alignItems: 'center',
  },
  clearInButtonText: { color: colors.card, fontSize: 13, fontWeight: '700' },
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
