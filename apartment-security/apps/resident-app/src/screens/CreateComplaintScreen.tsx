import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useComplaints, ComplaintCategory, ComplaintPriority } from '../context/ComplaintsContext';
import { useTheme } from '../context/ThemeContext';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '../constants/complaints';

type Attachment = { url: string; isImage: boolean; name: string };

export default function CreateComplaintScreen({ navigation }: { navigation: any }) {
  const { createComplaint, uploadAttachment } = useComplaints();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [category, setCategory] = useState<ComplaintCategory>('MAINTENANCE');
  const [priority, setPriority] = useState<ComplaintPriority>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 5 && !uploading && !submitting;

  const handleAddPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await uploadAttachment(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? `photo-${Date.now()}.jpg`);
      setAttachments((prev) => [...prev, { url, isImage: true, name: asset.fileName ?? 'photo.jpg' }]);
    } catch {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await uploadAttachment(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name);
      setAttachments((prev) => [...prev, { url, isImage: false, name: asset.name }]);
    } catch {
      Alert.alert('Error', 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url: string) => setAttachments((prev) => prev.filter((a) => a.url !== url));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createComplaint({
        category,
        priority,
        title: title.trim(),
        description: description.trim(),
        attachmentUrls: attachments.map((a) => a.url),
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipGrid}>
          {CATEGORY_OPTIONS.map((option) => {
            const active = category === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategory(option.value)}
              >
                <Ionicons name={option.icon} size={16} color={active ? colors.card : colors.primary} />
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITY_OPTIONS.map((option) => {
            const active = priority === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.priorityChip, active && styles.priorityChipActive]}
                onPress={() => setPriority(option.value)}
              >
                <Text style={[styles.priorityChipText, active && styles.priorityChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief summary of the issue"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the issue in detail..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Attachments</Text>
        <View style={styles.attachmentGrid}>
          {attachments.map((a) => (
            <View key={a.url} style={styles.attachmentPreview}>
              {a.isImage ? (
                <Image source={{ uri: a.url }} style={styles.attachmentImage} />
              ) : (
                <View style={styles.fileAttachment}>
                  <Ionicons name="document-text" size={20} color={colors.primary} />
                  <Text style={styles.fileAttachmentName} numberOfLines={1}>{a.name}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.removeAttachmentButton} onPress={() => removeAttachment(a.url)}>
                <Ionicons name="close-circle" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addAttachmentButton} onPress={handleAddPhoto} disabled={uploading}>
            <Ionicons name="camera" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addAttachmentButton} onPress={handleAddFile} disabled={uploading}>
            <Ionicons name="document-attach" size={20} color={colors.primary} />
          </TouchableOpacity>
          {uploading && <ActivityIndicator color={colors.primary} style={{ marginLeft: 8 }} />}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.card} /> : <Text style={styles.submitButtonText}>Submit complaint</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 24 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 16 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryChip: {
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
    categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryChipText: { fontSize: 13, color: colors.text, marginLeft: 6, fontWeight: '600' },
    categoryChipTextActive: { color: colors.card },
    priorityRow: { flexDirection: 'row', gap: 8 },
    priorityChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginRight: 8,
    },
    priorityChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    priorityChipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
    priorityChipTextActive: { color: colors.card },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    textArea: { height: 120 },
    attachmentGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    attachmentPreview: { position: 'relative', marginRight: 10, marginBottom: 10 },
    attachmentImage: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.border },
    fileAttachment: {
      width: 64,
      height: 64,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    fileAttachmentName: { fontSize: 9, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
    removeAttachmentButton: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.background, borderRadius: 10 },
    addAttachmentButton: {
      width: 64,
      height: 64,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      marginBottom: 10,
    },
    footer: { padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
    submitButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: { color: colors.card, fontSize: 16, fontWeight: 'bold' },
  });
