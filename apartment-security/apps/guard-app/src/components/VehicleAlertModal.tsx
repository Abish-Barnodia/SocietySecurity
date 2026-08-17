import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../utils/api';
import { getCached } from '../utils/cachedFetch';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemeColors } from '../theme/colors';

export default function VehicleAlertModal({ visible, onClose, onSent }: {
  visible: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [residentCount, setResidentCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);

  useEffect(() => {
    if (!visible) return;
    getCached('units', () => api.get('/entries/units').then((res) => res.data.data ?? []))
      .then((units: { _count?: { residents: number } }[]) => {
        setResidentCount(units.reduce((sum, u) => sum + (u._count?.residents ?? 0), 0));
      })
      .catch(() => setResidentCount(null));
  }, [visible]);

  const reset = () => {
    setPhotoBase64(null);
    setPlateNumber('');
    setVehicleDetails('');
    setLocation('');
    setNotes('');
  };

  const handleCameraPress = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(t('walkin_permissionRequiredTitle'), t('vehicle_permissionRequiredMsg'));
        return;
      }
    }
    setIsCameraOpen(true);
  };

  const takePicture = async () => {
    if (!cameraRef) return;
    try {
      const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.5 });
      if (photo?.base64) {
        setPhotoBase64(photo.base64);
        setIsCameraOpen(false);
      }
    } catch {
      Alert.alert(t('common_error'), t('walkin_cameraFailedMsg'));
    }
  };

  const canSubmit = !!photoBase64 && plateNumber.trim() && vehicleDetails.trim() && location.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/alerts/vehicle', {
        photoBase64,
        plateNumber: plateNumber.trim(),
        vehicleDetails: vehicleDetails.trim(),
        location: location.trim(),
        notes: notes.trim() || undefined,
      });
      reset();
      onSent();
    } catch (error: any) {
      Alert.alert(t('common_error'), error.response?.data?.message ?? t('vehicle_sendFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isCameraOpen) {
    return (
      <Modal visible transparent={false} animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <CameraView style={{ flex: 1 }} facing="back" ref={(ref) => setCameraRef(ref)}>
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
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('vehicle_title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.description}>{t('vehicle_description')}</Text>

            <Text style={styles.label}>{t('vehicle_photo')} <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.photoBox} onPress={handleCameraPress}>
              {photoBase64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={styles.photoPreview} />
              ) : (
                <>
                  <View style={styles.photoIconCircle}>
                    <Ionicons name="camera-outline" size={22} color={colors.card} />
                  </View>
                  <Text style={styles.photoBoxText}>{t('vehicle_tapCapture')}</Text>
                  <Text style={styles.photoBoxSub}>{t('vehicle_photoRequired')}</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>{t('vehicle_plateNumber')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('vehicle_platePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={plateNumber}
              onChangeText={setPlateNumber}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>{t('vehicle_details')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('vehicle_detailsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={vehicleDetails}
              onChangeText={setVehicleDetails}
            />

            <Text style={styles.label}>{t('vehicle_location')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('vehicle_locationPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />

            <Text style={styles.label}>{t('vehicle_notes')}</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder={t('vehicle_notesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <View style={styles.residentBanner}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.residentBannerTitle}>
                  {residentCount === null ? t('vehicle_broadcastingToUnknown') : t('vehicle_broadcastingTo', { count: residentCount })}
                </Text>
                <Text style={styles.residentBannerSub}>{t('vehicle_everyoneReceives')}</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={16} color={colors.white} />
                <Text style={styles.submitButtonText}>{t('vehicle_broadcastButton')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  content: { padding: 20, paddingBottom: 40 },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 20 },

  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 16 },
  required: { color: colors.danger },

  photoBox: {
    backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 16, padding: 28, alignItems: 'center', justifyContent: 'center', minHeight: 160,
  },
  photoIconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  photoBoxText: { fontSize: 15, fontWeight: '700', color: colors.text },
  photoBoxSub: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  photoPreview: { width: '100%', height: 140, borderRadius: 12 },

  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, fontSize: 15, color: colors.text,
  },

  residentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primaryLight, borderRadius: 14, padding: 14, marginTop: 20,
  },
  residentBannerTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  residentBannerSub: { fontSize: 12, color: colors.primaryDark, marginTop: 2 },

  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  submitButton: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.danger, padding: 16,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  submitButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },

  cameraControls: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32,
  },
  cameraCancel: { padding: 16 },
  cameraCapture: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraCaptureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
});
