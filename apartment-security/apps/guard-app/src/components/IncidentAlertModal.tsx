import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemeColors } from '../theme/colors';

type IncidentCategory = 'ACCIDENT' | 'SECURITY_BREACH' | 'FIRE' | 'MEDICAL' | 'MAINTENANCE' | 'COMPLAINT' | 'GENERAL_NOTICE';
type PriorityLevel = 'P1' | 'P2' | 'P3';
type TargetAudience = 'ALL' | 'MANAGERS' | 'RESIDENTS';

export default function IncidentAlertModal({
  visible,
  onClose,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  onSent: (audience?: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);

  const [category, setCategory] = useState<IncidentCategory>('ACCIDENT');
  const [priority, setPriority] = useState<PriorityLevel>('P2');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('ALL');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);

  const reset = () => {
    setCategory('ACCIDENT');
    setPriority('P2');
    setTargetAudience('ALL');
    setTitle('');
    setLocation('');
    setDetails('');
    setPhotoBase64(null);
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

  const canSubmit = title.trim().length >= 3 && details.trim().length >= 3;

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert(t('common_error'), 'Please enter a title and description for the incident.');
      return;
    }

    let targetRoles: string[] = ['RESIDENT', 'MANAGER', 'COMMITTEE'];
    if (targetAudience === 'MANAGERS') {
      targetRoles = ['MANAGER', 'COMMITTEE'];
    } else if (targetAudience === 'RESIDENTS') {
      targetRoles = ['RESIDENT'];
    }

    setSubmitting(true);
    try {
      await api.post('/alerts/broadcast', {
        type: category,
        priority,
        severity: priority === 'P1' ? 'CRITICAL' : priority === 'P2' ? 'HIGH' : 'MEDIUM',
        title: title.trim(),
        message: details.trim(),
        location: location.trim() || undefined,
        photoBase64: photoBase64 || undefined,
        targetRoles,
      });

      const audience = targetAudience;
      reset();
      onSent(audience);
    } catch (error: any) {
      console.error('Failed to broadcast incident alert:', error);
      Alert.alert(t('common_error'), error.response?.data?.message ?? 'Failed to send incident alert.');
    } finally {
      setSubmitting(false);
    }
  };

  const CATEGORIES: { id: IncidentCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'ACCIDENT', label: t('incident_type_accident'), icon: 'warning-outline' },
    { id: 'SECURITY_BREACH', label: t('incident_type_security'), icon: 'shield-outline' },
    { id: 'FIRE', label: t('incident_type_fire'), icon: 'flame-outline' },
    { id: 'MEDICAL', label: t('incident_type_medical'), icon: 'medkit-outline' },
    { id: 'MAINTENANCE', label: t('incident_type_maintenance'), icon: 'construct-outline' },
    { id: 'COMPLAINT', label: t('incident_type_complaint'), icon: 'chatbox-ellipses-outline' },
    { id: 'GENERAL_NOTICE', label: t('incident_type_notice'), icon: 'information-circle-outline' },
  ];

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
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('incident_title')}</Text>
            <Text style={styles.headerSubtitle}>{t('incident_subtitle')}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* 1. Category Selection */}
            <Text style={styles.label}>{t('incident_type')} <Text style={styles.required}>*</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Ionicons name={cat.icon} size={15} color={active ? colors.white : colors.primary} />
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 2. Target Audience Selector */}
            <Text style={styles.label}>{t('incident_sendTo')} <Text style={styles.required}>*</Text></Text>
            <View style={styles.audienceContainer}>
              <TouchableOpacity
                style={[styles.audienceOption, targetAudience === 'ALL' && styles.audienceOptionActive]}
                onPress={() => setTargetAudience('ALL')}
              >
                <Ionicons name="people" size={16} color={targetAudience === 'ALL' ? colors.primary : colors.textMuted} />
                <Text style={[styles.audienceText, targetAudience === 'ALL' && styles.audienceTextActive]}>
                  {t('incident_sendTo_all')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.audienceOption, targetAudience === 'MANAGERS' && styles.audienceOptionActive]}
                onPress={() => setTargetAudience('MANAGERS')}
              >
                <Ionicons name="briefcase" size={16} color={targetAudience === 'MANAGERS' ? colors.primary : colors.textMuted} />
                <Text style={[styles.audienceText, targetAudience === 'MANAGERS' && styles.audienceTextActive]}>
                  {t('incident_sendTo_managers')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.audienceOption, targetAudience === 'RESIDENTS' && styles.audienceOptionActive]}
                onPress={() => setTargetAudience('RESIDENTS')}
              >
                <Ionicons name="home" size={16} color={targetAudience === 'RESIDENTS' ? colors.primary : colors.textMuted} />
                <Text style={[styles.audienceText, targetAudience === 'RESIDENTS' && styles.audienceTextActive]}>
                  {t('incident_sendTo_residents')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 3. Priority Level */}
            <Text style={styles.label}>{t('incident_priority')}</Text>
            <View style={styles.priorityRow}>
              {(['P1', 'P2', 'P3'] as PriorityLevel[]).map((p) => {
                const active = priority === p;
                const pColors = p === 'P1'
                  ? { bg: colors.dangerLight, fg: colors.danger, border: colors.danger }
                  : p === 'P2'
                  ? { bg: colors.warningLight, fg: colors.warning, border: colors.warning }
                  : { bg: colors.primaryLight, fg: colors.primary, border: colors.primary };

                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      active && { backgroundColor: pColors.bg, borderColor: pColors.border, borderWidth: 2 },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.priorityText, { color: active ? pColors.fg : colors.textMuted }]}>
                      {p === 'P1' ? 'P1 (Critical)' : p === 'P2' ? 'P2 (High)' : 'P3 (Normal)'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 4. Title Input */}
            <Text style={styles.label}>{t('incident_headline')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('incident_headline_ph')}
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {/* 5. Location Input */}
            <Text style={styles.label}>{t('incident_location')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('incident_location_ph')}
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />

            {/* 6. Description / Details */}
            <Text style={styles.label}>{t('incident_details')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('incident_details_ph')}
              placeholderTextColor={colors.textMuted}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={4}
            />

            {/* 7. Photo Capture (Optional) */}
            <Text style={styles.label}>{t('incident_photo')}</Text>
            <TouchableOpacity style={styles.photoBox} onPress={handleCameraPress}>
              {photoBase64 ? (
                <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      setPhotoBase64(null);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoBoxContent}>
                  <View style={styles.photoIconCircle}>
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.photoBoxText}>{t('incident_tapCapture')}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Target Audience Summary Note */}
            <View style={styles.broadcastInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.broadcastInfoText}>
                {targetAudience === 'ALL'
                  ? 'This alert will immediately ping all residents and appear on the Manager Dashboard.'
                  : targetAudience === 'MANAGERS'
                  ? 'This alert will be delivered only to the Society Manager Portal and Committee members.'
                  : 'This alert will be broadcasted to all residents in the society.'}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>{t('incident_submit')}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 20, backgroundColor: colors.background },

  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 14 },
  required: { color: colors.danger },

  chipsScroll: { marginBottom: 6 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  categoryChipTextActive: { color: colors.white, fontWeight: '700' },

  audienceContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  audienceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audienceOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  audienceText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  audienceTextActive: { color: colors.text, fontWeight: '700' },

  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityText: { fontSize: 12, fontWeight: '700' },

  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 10,
  },

  photoBox: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoBoxContent: { alignItems: 'center', gap: 6 },
  photoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBoxText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  photoPreview: { width: '100%', height: '100%', borderRadius: 12 },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    padding: 6,
    borderRadius: 16,
  },

  broadcastInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    marginTop: 18,
    marginBottom: 8,
  },
  broadcastInfoText: { flex: 1, fontSize: 12, color: colors.primary, lineHeight: 16, fontWeight: '500' },

  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },

  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  cameraCancel: { width: 60, alignItems: 'center' },
  cameraCapture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCaptureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'black',
    backgroundColor: 'white',
  },
});
