import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useCommunity } from '../../context/CommunityContext';

export default function CreatePollModal({
  visible,
  onClose,
  replyToId,
}: {
  visible: boolean;
  onClose: () => void;
  replyToId?: string;
}) {
  const { createPoll } = useCommunity();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  const handleCreate = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await createPoll(question, options, allowMultiple, replyToId);
      close();
    } catch (error) {
      Alert.alert('Error', 'Failed to create poll. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Create a poll</Text>
            <TouchableOpacity onPress={close}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text style={styles.label}>Question</Text>
            <TextInput
              style={styles.input}
              placeholder="Ask something…"
              value={question}
              onChangeText={setQuestion}
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Options</Text>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <TextInput
                  style={[styles.input, styles.optionInput]}
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChangeText={(v) => updateOption(index, v)}
                  placeholderTextColor="#9ca3af"
                />
                {options.length > 2 && (
                  <TouchableOpacity onPress={() => removeOption(index)} style={styles.removeButton}>
                    <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {options.length < 10 && (
              <TouchableOpacity onPress={addOption} style={styles.addOption}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.addOptionText}>Add option</Text>
              </TouchableOpacity>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow multiple answers</Text>
              <Switch
                value={allowMultiple}
                onValueChange={setAllowMultiple}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.white}
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.createButtonText}>{submitting ? 'Creating…' : 'Create poll'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  scroll: { maxHeight: 380 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  optionInput: { flex: 1, marginBottom: 0 },
  removeButton: { marginLeft: 8 },
  addOption: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  addOptionText: { color: colors.primary, fontWeight: '600', marginLeft: 4 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  switchLabel: { fontSize: 14, color: colors.text },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
