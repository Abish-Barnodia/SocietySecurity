import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useComplaints, Complaint } from '../../context/ComplaintsContext';
import { useTheme } from '../../context/ThemeContext';
import { categoryMeta, statusLabel, priorityLabel, STATUS_COLOR_KEY, PRIORITY_COLOR_KEY } from '../../constants/complaints';

const formatDateTime = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url);

export default function ComplaintDetailScreen() {
  const route = useRoute<any>();
  const { complaintId } = route.params;
  const { complaints, fetchComplaintDetail } = useComplaints();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [complaint, setComplaint] = useState<Complaint | null>(complaints.find((c) => c.id === complaintId) ?? null);
  const [loading, setLoading] = useState(!complaint);

  useEffect(() => {
    // Skip the refetch when the cached list item already has its update
    // timeline populated — nothing new to fetch, no need to hit the network.
    if (complaint && complaint.updates.length > 0) return;

    let cancelled = false;
    fetchComplaintDetail(complaintId)
      .then((result) => { if (!cancelled) setComplaint(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [complaintId, fetchComplaintDetail]);

  if (loading && !complaint) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={{ color: colors.textMuted }}>Complaint not found.</Text>
      </View>
    );
  }

  const category = categoryMeta(complaint.category);
  const statusColor = colors[STATUS_COLOR_KEY[complaint.status]];
  const priorityColor = colors[PRIORITY_COLOR_KEY[complaint.priority]];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel(complaint.status)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${priorityColor}22` }]}>
          <Text style={[styles.badgeText, { color: priorityColor }]}>{priorityLabel(complaint.priority)} priority</Text>
        </View>
      </View>

      <Text style={styles.title}>{complaint.title}</Text>
      <View style={styles.metaRow}>
        <Ionicons name={category.icon} size={14} color={colors.textMuted} />
        <Text style={styles.metaText}>{category.label} · Submitted {formatDateTime(complaint.createdAt)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DESCRIPTION</Text>
        <Text style={styles.description}>{complaint.description}</Text>
      </View>

      {complaint.attachmentUrls.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ATTACHMENTS</Text>
          <View style={styles.attachmentRow}>
            {complaint.attachmentUrls.map((url) =>
              isImageUrl(url) ? (
                <TouchableOpacity key={url} onPress={() => Linking.openURL(url)}>
                  <Image source={{ uri: url }} style={styles.attachmentThumb} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity key={url} style={styles.fileChip} onPress={() => Linking.openURL(url)}>
                  <Ionicons name="document-text" size={16} color={colors.primary} />
                  <Text style={styles.fileChipText} numberOfLines={1}>{url.split('/').pop()}</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      )}

      {!!complaint.assignedToName && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ASSIGNED TO</Text>
          <Text style={styles.description}>{complaint.assignedToName}</Text>
        </View>
      )}

      {!!complaint.resolutionNote && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>RESOLUTION</Text>
          <Text style={styles.description}>{complaint.resolutionNote}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>TIMELINE</Text>
        {complaint.updates.map((update, index) => (
          <View key={update.id} style={styles.timelineRow}>
            <View style={styles.timelineDotColumn}>
              <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              {index < complaint.updates.length - 1 && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineBody}>
              <Text style={styles.timelineAction}>{update.action.replace(/_/g, ' ')}</Text>
              {!!update.note && <Text style={styles.timelineNote}>{update.note}</Text>}
              <Text style={styles.timelineDate}>{formatDateTime(update.createdAt)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    title: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    metaText: { fontSize: 13, color: colors.textMuted, marginLeft: 6 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, marginBottom: 8 },
    description: { fontSize: 14, color: colors.text, lineHeight: 21 },
    attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    attachmentThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 10, marginBottom: 10, backgroundColor: colors.border },
    fileChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginRight: 10,
      marginBottom: 10,
      maxWidth: 160,
    },
    fileChipText: { fontSize: 12, color: colors.text, marginLeft: 6, flexShrink: 1 },
    timelineRow: { flexDirection: 'row' },
    timelineDotColumn: { alignItems: 'center', width: 20 },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
    timelineBody: { flex: 1, paddingBottom: 16, marginLeft: 10 },
    timelineAction: { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
    timelineNote: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    timelineDate: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  });
