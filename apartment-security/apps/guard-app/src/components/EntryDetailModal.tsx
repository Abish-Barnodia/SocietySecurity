import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemeColors } from '../theme/colors';
import { TranslationKey } from '../i18n/translations';
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

function formatInsideDuration(entryAt: string, exitAt: string | null): string {
  const start = new Date(entryAt).getTime();
  const end = exitAt ? new Date(exitAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hours === 0 && mins === 0) {
    return exitAt ? '< 1 min' : 'Just entered';
  }
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (mins > 0) parts.push(`${mins} min${mins > 1 ? 's' : ''}`);
  const durationStr = parts.join(' ');
  return exitAt ? durationStr : `${durationStr} (active)`;
}

export default function EntryDetailModal({ entry, onClose }: { entry: EntryDetail | null; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);

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
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('entry_enteredAt')}</Text>
                <Text style={styles.metaValue}>
                  {new Date(entry.entryAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              </View>
              {entry.exitAt ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('entry_exitedAt')}</Text>
                  <Text style={styles.metaValue}>
                    {new Date(entry.exitAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                </View>
              ) : (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('entry_exitedAt')}</Text>
                  <Text style={[styles.metaValue, { color: colors.success }]}>{t('entry_stillInside')}</Text>
                </View>
              )}
              <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.metaLabel}>{t('entry_insideTime')}</Text>
                <Text style={[styles.metaValue, !entry.exitAt && { color: colors.success }]}>
                  {formatInsideDuration(entry.entryAt, entry.exitAt)}
                </Text>
              </View>
            </View>
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
});
