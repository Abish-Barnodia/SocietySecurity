import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useDomesticWorkers, WorkerType, DayOfWeek } from '../../context/DomesticWorkersContext';
import { useTheme } from '../../context/ThemeContext';
import { WORKER_TYPE_OPTIONS, DAY_OPTIONS } from '../../constants/domesticWorkers';

const parseTime = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  return d;
};

const formatTime24 = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

const formatTime12 = (d: Date) => {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export default function WorkerFormScreen({ navigation }: { navigation: any }) {
  const route = useRoute<any>();
  const workerId: string | undefined = route.params?.workerId;
  const { workers, createWorker, updateWorker, deleteWorker, uploadWorkerPhoto } = useDomesticWorkers();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();

  const existing = useMemo(() => workers.find((w) => w.id === workerId), [workers, workerId]);
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [type, setType] = useState<WorkerType>(existing?.type ?? 'MAID');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(existing?.photoUrl);
  const [govtIdType, setGovtIdType] = useState(existing?.govtIdType ?? '');
  const [govtIdNumber, setGovtIdNumber] = useState(existing?.govtIdNumber ?? '');
  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>(existing?.workingDays ?? ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
  const [entryTime, setEntryTime] = useState(parseTime(existing?.entryTime ?? '09:00'));
  const [exitTime, setExitTime] = useState(parseTime(existing?.exitTime ?? '11:00'));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showPicker, setShowPicker] = useState<'entry' | 'exit' | null>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (day: DayOfWeek) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const url = await uploadWorkerPhoto(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? `worker-${Date.now()}.jpg`);
      setPhotoUrl(url);
    } catch {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 6 && workingDays.length > 0 && !uploadingPhoto && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        phone: phone.trim(),
        type,
        address: address.trim() || undefined,
        photoUrl,
        govtIdType: govtIdType.trim() || undefined,
        govtIdNumber: govtIdNumber.trim() || undefined,
        workingDays,
        entryTime: formatTime24(entryTime),
        exitTime: formatTime24(exitTime),
        notes: notes.trim() || undefined,
      };
      if (isEdit && existing) {
        await updateWorker(existing.id, input);
      } else {
        await createWorker(input);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save worker details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Remove Worker', `Remove ${existing.name} from your registered staff?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorker(existing.id);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Failed to remove worker.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Worker' : 'Add Daily Help'}</Text>
          <Text style={styles.headerSubtitle}>{isEdit ? 'Update worker details and schedule' : 'Register housekeeping, maid, cook, driver'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} disabled={uploadingPhoto}>
              {uploadingPhoto ? (
                <ActivityIndicator color={colors.text} />
              ) : photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoImage} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="camera-outline" size={26} color={colors.text} />
                  <Text style={styles.photoPickerText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>FULL NAME *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.sectionLabel}>MOBILE NUMBER *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. +91 98765 43210"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.sectionLabel}>ROLE / TYPE</Text>
          <View style={styles.chipGrid}>
            {WORKER_TYPE_OPTIONS.map((option) => {
              const active = type === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setType(option.value)}
                >
                  <Ionicons name={option.icon as any} size={16} color={active ? (isDark ? '#0f172a' : '#ffffff') : colors.text} />
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="Worker's home address"
            placeholderTextColor={colors.textMuted}
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.sectionLabel}>GOVERNMENT ID (OPTIONAL)</Text>
          <View style={styles.rowGap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="ID Type (e.g. Aadhaar)"
              placeholderTextColor={colors.textMuted}
              value={govtIdType}
              onChangeText={setGovtIdType}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="ID Number"
              placeholderTextColor={colors.textMuted}
              value={govtIdNumber}
              onChangeText={setGovtIdNumber}
            />
          </View>

          <Text style={styles.sectionLabel}>WORKING DAYS</Text>
          <View style={styles.daysRow}>
            {DAY_OPTIONS.map((day) => (
              <TouchableOpacity
                key={day.value}
                style={[styles.dayButton, workingDays.includes(day.value) && styles.dayButtonActive]}
                onPress={() => toggleDay(day.value)}
              >
                <Text style={[styles.dayText, workingDays.includes(day.value) && styles.dayTextActive]}>{day.short}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>WORKING HOURS</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity style={[styles.input, styles.timeInput]} onPress={() => setShowPicker('entry')}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{formatTime12(entryTime)}</Text>
            </TouchableOpacity>
            <Text style={styles.toText}>to</Text>
            <TouchableOpacity style={[styles.input, styles.timeInput]} onPress={() => setShowPicker('exit')}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{formatTime12(exitTime)}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>NOTES / REMARKS</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Special instructions or notes..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          {isEdit && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={styles.deleteBtnText}>Remove this worker</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {showPicker && (
          <DateTimePicker
            value={showPicker === 'entry' ? entryTime : exitTime}
            mode="time"
            display="default"
            onChange={(_event, selected) => {
              setShowPicker(null);
              if (!selected) return;
              if (showPicker === 'entry') setEntryTime(selected);
              else setExitTime(selected);
            }}
          />
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={isDark ? '#000' : '#fff'} />
            ) : (
              <Text style={styles.submitButtonText}>{isEdit ? 'Save Changes' : 'Register Staff'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0f172a' : '#f5f3ef' },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    content: { padding: 20, paddingBottom: 30 },

    photoPicker: {
      width: 90,
      height: 90,
      borderRadius: 24,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    photoImage: { width: '100%', height: '100%' },
    photoPickerText: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontWeight: '600' },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 14,
    },
    input: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
    },
    textArea: { height: 90 },
    rowGap: { flexDirection: 'row', gap: 10 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
    },
    typeChipActive: { backgroundColor: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#ffffff' : '#0f172a' },
    typeChipText: { fontSize: 13, color: colors.text, marginLeft: 8, fontWeight: '600' },
    typeChipTextActive: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },

    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayButtonActive: { backgroundColor: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#ffffff' : '#0f172a' },
    dayText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    dayTextActive: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },

    timeRow: { flexDirection: 'row', alignItems: 'center' },
    timeInput: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    toText: { marginHorizontal: 12, color: colors.textMuted, fontWeight: '600' },

    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
      paddingVertical: 12,
    },
    deleteBtnText: { color: '#ef4444', fontWeight: '700', marginLeft: 6, fontSize: 14 },

    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    submitButton: {
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: isDark ? '#0f172a' : '#ffffff', fontSize: 15, fontWeight: '700' },
  });
