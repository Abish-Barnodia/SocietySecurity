import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import { ThemeColors } from '../theme/colors';

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
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);
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
        Alert.alert(t('details_loadPostsErrorTitle'), t('details_loadPostsErrorMsg'));
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
      Alert.alert(t('common_error'), message);
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
        <Text style={styles.title}>{t('details_appName')}</Text>
        <Text style={styles.subtitle}>{t('details_subtitle')}</Text>

        <View style={styles.stepper}>
          <View style={styles.stepperItem}>
            <View style={[styles.stepCircle, step === 'details' ? styles.stepCircleActive : styles.stepCircleDone]}>
              <Text style={styles.stepCircleText}>1</Text>
            </View>
            <Text style={styles.stepLabel}>{t('details_stepDetails')}</Text>
          </View>
          <View style={[styles.stepLine, step === 'confirm' && styles.stepLineActive]} />
          <View style={styles.stepperItem}>
            <View style={[styles.stepCircle, step === 'confirm' ? styles.stepCircleActive : styles.stepCirclePending]}>
              <Text style={[styles.stepCircleText, step === 'details' && styles.stepCircleTextPending]}>2</Text>
            </View>
            <Text style={styles.stepLabel}>{t('details_stepConfirm')}</Text>
          </View>
        </View>

        {step === 'details' ? (
          <View style={styles.form}>
            <Text style={styles.label}>{t('details_fullName')}</Text>
            <TextInput style={styles.inputDisabled} value={guardProfile?.name} editable={false} />

            <Text style={styles.label}>{t('details_badgeId')}</Text>
            <TextInput style={styles.inputDisabled} value={guardProfile?.badgeNumber} editable={false} />

            <Text style={styles.label}>{t('details_phoneNumber')}</Text>
            <TextInput style={styles.inputDisabled} value={guardProfile?.phone || '—'} editable={false} />

            <Text style={styles.label}>{t('details_assignedPost')}</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setPostPickerOpen(true)} disabled={loadingPosts}>
              {loadingPosts ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.dropdownText, !post && styles.placeholderText]}>
                  {post?.name ?? t('details_selectPost')}
                </Text>
              )}
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.label}>{t('details_shift')}</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShiftPickerOpen(true)}>
              <Text style={[styles.dropdownText, !shift && styles.placeholderText]}>
                {shift || t('details_selectShift')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, !canContinue && styles.buttonDisabled]}
              onPress={() => setStep('confirm')}
              disabled={!canContinue}
            >
              <Text style={styles.buttonText}>{t('details_continue')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{t('details_confirmTitle')}</Text>
              <SummaryRow styles={styles} label={t('details_fullName')} value={guardProfile?.name ?? ''} />
              <SummaryRow styles={styles} label={t('details_badgeId')} value={guardProfile?.badgeNumber ?? ''} />
              <SummaryRow styles={styles} label={t('details_phoneNumber')} value={guardProfile?.phone || '—'} />
              <SummaryRow styles={styles} label={t('details_assignedPost')} value={post?.name ?? ''} />
              <SummaryRow styles={styles} label={t('details_shift')} value={shift} />
              <SummaryRow styles={styles} label={t('details_date')} value={today} last />
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.backButton} onPress={() => setStep('details')} disabled={submitting}>
                <Text style={styles.backButtonText}>{t('details_back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.startButton} onPress={handleStartDuty} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.startButtonText}>{t('details_startDuty')}</Text>
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

function SummaryRow({ styles, label, value, last }: { styles: ReturnType<typeof getStyles>; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.summaryRow, last && styles.summaryRowLast]}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: colors.border,
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
    backgroundColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  dropdownText: { fontSize: 16, color: colors.text },
  placeholderText: { color: colors.textMuted },

  button: { backgroundColor: colors.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: colors.border },
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryRowLabel: { fontSize: 14, color: colors.textMuted },
  summaryRowValue: { fontSize: 15, fontWeight: '700', color: colors.text },

  confirmActions: { flexDirection: 'row', gap: 12 },
  backButton: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.border,
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
