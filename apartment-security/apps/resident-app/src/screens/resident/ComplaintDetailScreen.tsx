import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useComplaints, Complaint } from '../../context/ComplaintsContext';
import { useTheme } from '../../context/ThemeContext';
import { categoryMeta, statusLabel, priorityLabel } from '../../constants/complaints';

const formatDateTime = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url);

export default function ComplaintDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { complaintId } = route.params;
  const { complaints, fetchComplaintDetail } = useComplaints();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [complaint, setComplaint] = useState<Complaint | null>(complaints.find((c) => c.id === complaintId) ?? null);
  const [loading, setLoading] = useState(!complaint);

  useEffect(() => {
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complaint Detail</Text>
        </View>
        <View style={styles.loaderContainer}>
          <Text style={{ color: colors.textMuted }}>Complaint not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const category = categoryMeta(complaint.category);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Complaint Details</Text>
          <Text style={styles.headerSubtitle}>Ticket #{complaint.id.slice(-6).toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBox}>
              <Ionicons name={category.icon as any} size={24} color={colors.text} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>{complaint.title}</Text>
              <Text style={styles.metaText}>{category.label} · Submitted {formatDateTime(complaint.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{statusLabel(complaint.status)}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{priorityLabel(complaint.priority)} Priority</Text>
            </View>
          </View>
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
                    <Ionicons name="document-text-outline" size={16} color={colors.text} />
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
            <Text style={styles.sectionLabel}>RESOLUTION NOTE</Text>
            <Text style={styles.description}>{complaint.resolutionNote}</Text>
          </View>
        )}

        {complaint.updates && complaint.updates.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ACTIVITY TIMELINE</Text>
            {complaint.updates.map((update, index) => (
              <View key={update.id} style={styles.timelineRow}>
                <View style={styles.timelineDotColumn}>
                  <View style={[styles.timelineDot, { backgroundColor: isDark ? '#ffffff' : '#0f172a' }]} />
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
        )}
      </ScrollView>
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
    content: { padding: 20, paddingBottom: 40 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    topCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cardIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 3 },
    metaText: { fontSize: 12, color: colors.textMuted },
    badgeRow: { flexDirection: 'row', gap: 8 },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.text },

    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    description: { fontSize: 14, color: colors.text, lineHeight: 21 },
    attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    attachmentThumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.border },
    fileChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    fileChipText: { fontSize: 12, color: colors.text, marginLeft: 6 },
    timelineRow: { flexDirection: 'row' },
    timelineDotColumn: { alignItems: 'center', width: 20 },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
    timelineBody: { flex: 1, paddingBottom: 16, marginLeft: 10 },
    timelineAction: { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
    timelineNote: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    timelineDate: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  });
