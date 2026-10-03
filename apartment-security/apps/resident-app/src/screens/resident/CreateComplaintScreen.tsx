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
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useComplaints, ComplaintCategory, ComplaintPriority } from '../../context/ComplaintsContext';
import { useTheme } from '../../context/ThemeContext';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '../../constants/complaints';

type Attachment = { url: string; localUri?: string; isImage: boolean; name: string };

export default function CreateComplaintScreen({ navigation }: { navigation: any }) {
  const { createComplaint, uploadAttachment } = useComplaints();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<ComplaintCategory>('MAINTENANCE');
  const [priority, setPriority] = useState<ComplaintPriority>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewItem, setPreviewItem] = useState<Attachment | null>(null);

  const canSubmit = !uploading && !submitting;

  const handleAddPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`;

    setUploading(true);
    try {
      const serverUrl = await uploadAttachment(asset.uri, asset.mimeType ?? 'image/jpeg', fileName);
      setAttachments((prev) => [...prev, { url: serverUrl, localUri: asset.uri, isImage: true, name: fileName }]);
    } catch {
      setAttachments((prev) => [...prev, { url: asset.uri, localUri: asset.uri, isImage: true, name: fileName }]);
    } finally {
      setUploading(false);
    }
  };

  const handleAddFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const isImg = asset.mimeType?.startsWith('image/') ?? false;

    setUploading(true);
    try {
      const serverUrl = await uploadAttachment(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name);
      setAttachments((prev) => [...prev, { url: serverUrl, localUri: asset.uri, isImage: isImg, name: asset.name }]);
    } catch {
      setAttachments((prev) => [...prev, { url: asset.uri, localUri: asset.uri, isImage: isImg, name: asset.name }]);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url: string) => setAttachments((prev) => prev.filter((a) => a.url !== url));

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your complaint.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please enter a description for your complaint.');
      return;
    }

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
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>New Complaint</Text>
          <Text style={styles.headerSubtitle}>Submit an issue or service request</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>CATEGORY</Text>
          <View style={styles.chipGrid}>
            {CATEGORY_OPTIONS.map((option) => {
              const active = category === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setCategory(option.value)}
                >
                  <Ionicons name={option.icon as any} size={16} color={active ? (isDark ? '#0f172a' : '#ffffff') : colors.text} />
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>PRIORITY LEVEL</Text>
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

          <Text style={styles.sectionLabel}>TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of the issue"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
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

          <Text style={styles.sectionLabel}>ATTACHMENTS (OPTIONAL)</Text>
          <View style={styles.attachmentGrid}>
            {attachments.map((a) => (
              <View key={a.url} style={styles.attachmentPreview}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setPreviewItem(a)}>
                  {a.isImage ? (
                    <Image source={{ uri: a.localUri ?? a.url }} style={styles.attachmentImage} />
                  ) : (
                    <View style={styles.fileAttachment}>
                      <Ionicons name="document-text-outline" size={22} color={colors.text} />
                      <Text style={styles.fileAttachmentName} numberOfLines={1}>{a.name}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeAttachmentButton} onPress={() => removeAttachment(a.url)}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addAttachmentButton} onPress={handleAddPhoto} disabled={uploading}>
              <Ionicons name="camera-outline" size={22} color={colors.text} />
              <Text style={styles.addAttachmentText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addAttachmentButton} onPress={handleAddFile} disabled={uploading}>
              <Ionicons name="document-attach-outline" size={22} color={colors.text} />
              <Text style={styles.addAttachmentText}>Doc</Text>
            </TouchableOpacity>
            {uploading && <ActivityIndicator color={colors.text} style={{ marginLeft: 8 }} />}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={isDark ? '#000' : '#fff'} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Complaint</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!previewItem} transparent animationType="fade" onRequestClose={() => setPreviewItem(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPreviewItem(null)}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          {previewItem?.isImage ? (
            <Image source={{ uri: previewItem.localUri ?? previewItem.url }} style={styles.fullImagePreview} resizeMode="contain" />
          ) : (
            <View style={styles.fullFilePreview}>
              <Ionicons name="document-text" size={64} color={colors.text} />
              <Text style={styles.fullFileName}>{previewItem?.name}</Text>
            </View>
          )}
        </View>
      </Modal>
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
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 14,
      marginBottom: 8,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
    },
    categoryChipActive: { backgroundColor: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#ffffff' : '#0f172a' },
    categoryChipText: { fontSize: 13, color: colors.text, marginLeft: 8, fontWeight: '600' },
    categoryChipTextActive: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },
    priorityRow: { flexDirection: 'row', gap: 8 },
    priorityChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
    },
    priorityChipActive: { backgroundColor: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#ffffff' : '#0f172a' },
    priorityChipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
    priorityChipTextActive: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700' },
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
    textArea: { height: 110 },
    attachmentGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    attachmentPreview: { position: 'relative' },
    attachmentImage: { width: 68, height: 68, borderRadius: 14, backgroundColor: colors.border },
    fileAttachment: {
      width: 68,
      height: 68,
      borderRadius: 14,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    fileAttachmentName: { fontSize: 9, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
    removeAttachmentButton: { position: 'absolute', top: -6, right: -6, backgroundColor: isDark ? '#1e293b' : '#ffffff', borderRadius: 10 },
    addAttachmentButton: {
      width: 68,
      height: 68,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addAttachmentText: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCloseButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      zIndex: 10,
      padding: 8,
    },
    fullImagePreview: {
      width: '100%',
      height: '80%',
      borderRadius: 16,
    },
    fullFilePreview: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      padding: 32,
      borderRadius: 20,
      alignItems: 'center',
    },
    fullFileName: {
      marginTop: 16,
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
    },
  });
