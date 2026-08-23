import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/colors';
import { TranslationKey } from '../../i18n/translations';
import api from '../../utils/api';
import PassSummary from './PassSummary';

export type EntryDetail = {
  id: string;
  visitorName: string;
  visitorPhone: string | null;
  vehicleNumber: string | null;
  gatePhotoUrl: string | null;
  notes: string | null;
  method: 'QR_SCAN' | 'OTP' | 'MANUAL_GUARD' | 'VEHICLE_ANPR';
  entryAt: string;
  exitAt: string | null;
  unit: { unitNumber: string; tower: string | null };
  entryPoint: { name: string };
};

const METHOD_LABEL_KEY: Record<EntryDetail['method'], TranslationKey> = {
  QR_SCAN: 'handover_methodQrScan',
  OTP: 'handover_methodOtp',
  MANUAL_GUARD: 'handover_methodWalkin',
  VEHICLE_ANPR: 'handover_methodVehicle',
};

export default function EntryDetailModal({ entry, onClose, onExited }: {
  entry: EntryDetail | null;
  onClose: () => void;
  // Lets the caller (e.g. HomeScreen's Recent Clearances) refresh its list
  // after a successful exit instead of showing stale "Still inside" data.
  onExited?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);
  const [markingExit, setMarkingExit] = useState(false);

  const handleMarkExit = async () => {
    if (!entry) return;
    setMarkingExit(true);
    try {
      // The backend's Zod schema requires a body object even though every
      // field in it is optional — a bodyless PUT can fail validation before
      // it ever reaches the optional-field check, so send an explicit {}.
      await api.put(`/entries/${entry.id}/exit`, {});
      onExited?.();
      onClose();
    } catch (error: any) {
      Alert.alert(t('common_error'), error.response?.data?.message ?? t('entry_markExitError'));
    } finally {
      setMarkingExit(false);
    }
  };

  return (
    <Modal visible={!!entry} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('entry_detailsTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {entry && (
          <View style={styles.content}>
            <PassSummary
              visitorName={entry.visitorName}
              visitorPhoto={entry.gatePhotoUrl}
              visitorPhone={entry.visitorPhone}
              purpose={entry.notes}
              vehicleNumber={entry.vehicleNumber}
              apartment={entry.unit.unitNumber}
              tower={entry.unit.tower}
              gateName={entry.entryPoint.name}
            />

            <View style={styles.metaCard}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('entry_method')}</Text>
                <Text style={styles.metaValue}>{t(METHOD_LABEL_KEY[entry.method])}</Text>
              </View>
              <View style={[styles.metaRow, { borderBottomWidth: entry.exitAt ? 1 : 0 }]}>
                <Text style={styles.metaLabel}>{t('entry_enteredAt')}</Text>
                <Text style={styles.metaValue}>
                  {new Date(entry.entryAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              </View>
              {entry.exitAt ? (
                <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.metaLabel}>{t('entry_exitedAt')}</Text>
                  <Text style={styles.metaValue}>
                    {new Date(entry.exitAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                </View>
              ) : (
                <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.metaValue, { color: colors.success }]}>{t('entry_stillInside')}</Text>
                </View>
              )}
            </View>

            {!entry.exitAt && (
              <TouchableOpacity
                style={[styles.exitButton, markingExit && { opacity: 0.6 }]}
                onPress={handleMarkExit}
                disabled={markingExit}
              >
                {markingExit ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.exitButtonText}>{t('entry_markExit')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
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
  content: { padding: 20 },

  metaCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 16, marginTop: 16,
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  metaLabel: { fontSize: 14, color: colors.textMuted },
  metaValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  exitButton: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  exitButtonText: { color: colors.card, fontSize: 16, fontWeight: '700' },
});
