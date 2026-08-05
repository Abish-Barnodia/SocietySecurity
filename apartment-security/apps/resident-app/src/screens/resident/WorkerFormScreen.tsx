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
  const { colors } = useTheme();
  const styles = getStyles(colors);

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

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Worker' : 'Add Worker' });
  }, [isEdit, navigation]);

  const toggleDay = (day: DayOfWeek) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library permission is required.');
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
      Alert.alert('Error', 'Failed to save worker. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Remove worker', `Remove ${existing.name} from your registered domestic workers?`, [
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} disabled={uploadingPhoto}>
          {uploadingPhoto ? (
            <ActivityIndicator color={colors.primary} />
          ) : photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photoImage} />
          ) : (
            <>
              <Ionicons name="camera" size={26} color={colors.primary} />
              <Text style={styles.photoPickerText}>Add photo</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Full name *</Text>
        <TextInput style={styles.input} placeholder="Enter full name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

        <Text style={styles.label}>Mobile number *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. +91 98765 43210"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.label}>Worker type</Text>
        <View style={styles.chipGrid}>
          {WORKER_TYPE_OPTIONS.map((option) => {
            const active = type === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => setType(option.value)}
              >
                <Ionicons name={option.icon} size={15} color={active ? colors.card : colors.primary} />
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} placeholder="Worker's home address" placeholderTextColor={colors.textMuted} value={address} onChangeText={setAddress} />

        <Text style={styles.label}>Government ID (optional)</Text>
        <View style={styles.rowGap}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="ID type (e.g. Aadhaar)"
            placeholderTextColor={colors.textMuted}
            value={govtIdType}
            onChangeText={setGovtIdType}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="ID number"
            placeholderTextColor={colors.textMuted}
            value={govtIdNumber}
            onChangeText={setGovtIdNumber}
          />
        </View>

        <Text style={styles.label}>Working days</Text>
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

        <Text style={styles.label}>Working hours</Text>
        <View style={styles.timeRow}>
          <TouchableOpacity style={[styles.input, styles.timeInput]} onPress={() => setShowPicker('entry')}>
            <Text style={{ color: colors.text }}>{formatTime12(entryTime)}</Text>
          </TouchableOpacity>
          <Text style={styles.toText}>to</Text>
          <TouchableOpacity style={[styles.input, styles.timeInput]} onPress={() => setShowPicker('exit')}>
            <Text style={{ color: colors.text }}>{formatTime12(exitTime)}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Anything else worth noting..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />

        {isEdit && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteButtonText}>Remove this worker</Text>
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

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.card} /> : <Text style={styles.submitButtonText}>{isEdit ? 'Save changes' : 'Register worker'}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 24 },
    photoPicker: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      overflow: 'hidden',
    },
    photoImage: { width: '100%', height: '100%' },
    photoPickerText: { fontSize: 11, color: colors.primary, marginTop: 4, fontWeight: '600' },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 16 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    textArea: { height: 90 },
    rowGap: { flexDirection: 'row', gap: 10 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginRight: 8,
      marginBottom: 8,
    },
    typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeChipText: { fontSize: 13, color: colors.text, marginLeft: 6, fontWeight: '600' },
    typeChipTextActive: { color: colors.card },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
    dayTextActive: { color: colors.card },
    timeRow: { flexDirection: 'row', alignItems: 'center' },
    timeInput: { flex: 1, justifyContent: 'center' },
    toText: { marginHorizontal: 16, color: colors.textMuted },
    deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28 },
    deleteButtonText: { color: colors.danger, fontWeight: '700', marginLeft: 6 },
    footer: { padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
    submitButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: colors.card, fontSize: 16, fontWeight: 'bold' },
  });
