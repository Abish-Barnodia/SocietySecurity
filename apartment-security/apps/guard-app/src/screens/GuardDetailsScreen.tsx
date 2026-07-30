import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { colors } from '../theme/colors';

type EntryPoint = { id: string; name: string };

const SHIFTS = [
  'Day Shift A (06:00-14:00)',
  'Day Shift B (14:00-22:00)',
  'Night Shift (22:00-06:00)',
];

// ponytail: shift label is picked for the guard's own reference only —
// the Shift model has no "type" field yet, so only entryPointId is sent
// to /guards/shift/start. Persist it if rosters need to read it back later.
export default function GuardDetailsScreen() {
  const { guardProfile, refreshProfile } = useAuth();
  const [step, setStep] = useState<'details' | 'confirm'>('details');

  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [post, setPost] = useState<EntryPoint | null>(null);
  const [postPickerOpen, setPostPickerOpen] = useState(false);

  const [shift, setShift] = useState('');
  const [shiftPickerOpen, setShiftPickerOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await api.get('/entries/entry-points');
        const fetched: EntryPoint[] = response.data.data ?? [];
        setEntryPoints(fetched);
      } catch {
        Alert.alert('Error', 'Could not load the list of gates. Please try again.');
      } finally {
        setLoadingPosts(false);
      }
    };
    loadPosts();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const canContinue = !!post && !!shift;

  const handleStartDuty = async () => {
    if (!post) return;
    setSubmitting(true);
    try {
      await api.post('/guards/shift/start', { entryPointId: post.id });
      await refreshProfile();
    } catch (error: any) {
      const message = error.response?.data?.message ?? 'Failed to start duty. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Sentinel Guard</Text>
        <Text style={styles.subtitle}>Apartment Security Platform</Text>

        <View style={styles.stepper}>
          <View style={styles.stepperItem}>
            <View style={[styles.stepCircle, step === 'details' ? styles.stepCircleActive : styles.stepCircleDone]}>
              <Text style={styles.stepCircleText}>1</Text>
            </View>
            <Text style={styles.stepLabel}>Your Details</Text>
          </View>
          <View style={[styles.stepLine, step === 'confirm' && styles.stepLineActive]} />
          <View style={styles.stepperItem}>
            <View style={[styles.stepCircle, step === 'confirm' ? styles.stepCircleActive : styles.stepCirclePending]}>
              <Text style={[styles.stepCircleText, step === 'details' && styles.stepCircleTextPending]}>2</Text>
            </View>
            <Text style={styles.stepLabel}>Confirm</Text>
          </View>
        </View>

        {step === 'details' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.inputDisabled} value={guardProfile?.name} editable={false} />

            <Text style={styles.label}>Badge / ID Number</Text>
            <TextInput style={styles.inputDisabled} value={guardProfile?.badgeNumber} editable={false} />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.inputDisabled} value={guardProfile?.phone || '—'} editable={false} />

            <Text style={styles.label}>Assigned Post</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setPostPickerOpen(true)} disabled={loadingPosts}>
              {loadingPosts ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.dropdownText, !post && styles.placeholderText]}>
                  {post?.name ?? 'Select your post'}
                </Text>
              )}
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.label}>Shift</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShiftPickerOpen(true)}>
              <Text style={[styles.dropdownText, !shift && styles.placeholderText]}>
                {shift || 'Select your shift'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, !canContinue && styles.buttonDisabled]}
              onPress={() => setStep('confirm')}
              disabled={!canContinue}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Confirm Your Details</Text>
              <SummaryRow label="Name" value={guardProfile?.name ?? ''} />
              <SummaryRow label="Badge" value={guardProfile?.badgeNumber ?? ''} />
              <SummaryRow label="Phone" value={guardProfile?.phone || '—'} />
              <SummaryRow label="Post" value={post?.name ?? ''} />
              <SummaryRow label="Shift" value={shift} />
              <SummaryRow label="Date" value={today} last />
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.backButton} onPress={() => setStep('details')} disabled={submitting}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.startButton} onPress={handleStartDuty} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.startButtonText}>Start Duty</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={postPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPostPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={entryPoints}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setPost(item); setPostPickerOpen(false); }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  {item.id === post?.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={shiftPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShiftPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={SHIFTS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setShift(item); setShiftPickerOpen(false); }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {item === shift && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[summaryRowStyles.row, last && summaryRowStyles.rowLast]}>
      <Text style={summaryRowStyles.label}>{label}</Text>
      <Text style={summaryRowStyles.value}>{value}</Text>
    </View>
  );
}

const summaryRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 14, color: colors.textMuted },
  value: { fontSize: 15, fontWeight: '700', color: colors.text },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 32, alignItems: 'center' },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 28 },

  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, width: '100%', justifyContent: 'center' },
  stepperItem: { alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: colors.primary },
  stepCircleDone: { backgroundColor: colors.primary },
  stepCirclePending: { backgroundColor: colors.border },
  stepCircleText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  stepCircleTextPending: { color: colors.textMuted },
  stepLabel: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  stepLine: { width: 60, height: 2, backgroundColor: colors.border, marginHorizontal: 8, marginBottom: 20 },
  stepLineActive: { backgroundColor: colors.primary },

  form: { width: '100%' },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, letterSpacing: 0.5 },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    color: colors.textMuted,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  dropdownText: { fontSize: 16, color: colors.text },
  placeholderText: { color: colors.textMuted },

  button: { backgroundColor: colors.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#EBE3DB' },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  summaryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },

  confirmActions: { flexDirection: 'row', gap: 12 },
  backButton: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  backButtonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  startButton: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.success,
  },
  startButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%', paddingVertical: 8 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  modalItemText: { fontSize: 16, color: colors.text },
});
