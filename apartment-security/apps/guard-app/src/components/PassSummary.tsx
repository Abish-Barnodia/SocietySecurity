import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  visitorName: string;
  visitorPhoto?: string | null;
  visitorPhone?: string | null;
  purpose?: string | null;
  vehicleNumber?: string | null;
  expectedTime?: string | null;
  apartment?: string | null;
  tower?: string | null;
  gateName?: string | null;
};

export default function PassSummary({
  visitorName, visitorPhoto, visitorPhone, purpose, vehicleNumber, expectedTime, apartment, tower, gateName,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {visitorPhoto ? (
          <Image source={{ uri: visitorPhoto }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoInitial}>{visitorName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name}>{visitorName}</Text>
          {purpose ? <Text style={styles.purpose}>{purpose}</Text> : null}
        </View>
      </View>

      <Row label="Phone" value={visitorPhone} />
      <Row label="Resident unit" value={[tower, apartment].filter(Boolean).join(' - ') || undefined} />
      <Row label="Gate" value={gateName} />
      <Row label="Vehicle" value={vehicleNumber} />
      <Row label="Expected until" value={expectedTime ? new Date(expectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined} last />
    </View>
  );
}

function Row({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  if (!value) return null;
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  photo: { width: 56, height: 56, borderRadius: 28, marginRight: 14 },
  photoPlaceholder: {
    width: 56, height: 56, borderRadius: 28, marginRight: 14,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  photoInitial: { fontSize: 22, fontWeight: '800', color: colors.primary },
  headerText: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  purpose: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
});
