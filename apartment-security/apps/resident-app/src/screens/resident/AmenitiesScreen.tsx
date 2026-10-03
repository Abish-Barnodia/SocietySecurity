import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useData, Amenity } from '../../context/DataContext';

const formatTime24 = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
const formatTime12 = (d: Date) => {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};
const formatDate = (d: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
};

const getAmenityIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const n = name.toLowerCase();
  if (n.includes('gym') || n.includes('fitness')) return 'barbell-outline';
  if (n.includes('pool') || n.includes('swim')) return 'water-outline';
  if (n.includes('club') || n.includes('hall')) return 'grid-outline';
  if (n.includes('tennis') || n.includes('court') || n.includes('badminton')) return 'tennisball-outline';
  if (n.includes('park') || n.includes('garden')) return 'leaf-outline';
  if (n.includes('lounge') || n.includes('terrace') || n.includes('cafe')) return 'cafe-outline';
  return 'business-outline';
};

export default function AmenitiesScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { amenities, fetchAmenities, bookAmenity, amenitiesLastFetchedAt } = useData();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [booking, setBooking] = useState<Amenity | null>(null);
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date(new Date().setHours(new Date().getHours() + 1, 0, 0, 0)));
  const [endTime, setEndTime] = useState(new Date(new Date().setHours(new Date().getHours() + 2, 0, 0, 0)));
  const [showPicker, setShowPicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (amenities.length === 0) setLoading(true);
      if (amenities.length === 0 || Date.now() - amenitiesLastFetchedAt.current > 30000) {
        fetchAmenities().finally(() => setLoading(false));
      }
    }, [fetchAmenities, amenities.length, amenitiesLastFetchedAt])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAmenities();
    setRefreshing(false);
  };

  const openBooking = (amenity: Amenity) => {
    setBooking(amenity);
    setDate(new Date());
  };

  const confirmBooking = async () => {
    if (!booking) return;
    setSubmitting(true);
    try {
      await bookAmenity(booking.id, date, formatTime24(startTime), formatTime24(endTime));
      Alert.alert('Booking Confirmed', `${booking.name} has been booked for ${formatDate(date)}.`);
      setBooking(null);
    } catch (error: any) {
      Alert.alert('Booking Failed', error.response?.data?.message ?? 'Failed to book this amenity. Please try a different slot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Society Amenities</Text>
          <Text style={styles.headerSubtitle}>Explore and reserve clubhouse facilities</Text>
        </View>
      </View>

      {loading && amenities.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} />}
        >
          {amenities.length === 0 ? (
            <View style={styles.centerState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="business-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Amenities Available</Text>
              <Text style={styles.emptyText}>There are no society amenities registered for booking at this time.</Text>
            </View>
          ) : (
            amenities.map((amenity) => {
              const iconName = getAmenityIcon(amenity.name);
              const isAvailable = amenity.status === 'AVAILABLE';

              return (
                <TouchableOpacity
                  key={amenity.id}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => openBooking(amenity)}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardIconBox}>
                      <Ionicons name={iconName} size={24} color={colors.text} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.name}>{amenity.name}</Text>
                      <Text style={styles.time}>{amenity.timeLabel || 'Open daily'}</Text>
                      <Text style={styles.capacity}>Capacity: {amenity.capacity} people</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.badge, !isAvailable && styles.badgeUnavailable]}>
                        <Text style={[styles.badgeText, !isAvailable && styles.badgeTextUnavailable]}>
                          {isAvailable ? 'Available' : amenity.status}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: 8 }} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={!!booking} transparent animationType="slide" onRequestClose={() => setBooking(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setBooking(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.cardIconBox}>
                <Ionicons name={booking ? getAmenityIcon(booking.name) : 'business-outline'} size={22} color={colors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Book {booking?.name}</Text>
                <Text style={styles.modalSubtitle}>Select date and time slot</Text>
              </View>
              <TouchableOpacity onPress={() => setBooking(null)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>DATE</Text>
            <TouchableOpacity style={styles.pickerInput} onPress={() => setShowPicker('date')}>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{formatDate(date)}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>START TIME</Text>
                <TouchableOpacity style={styles.pickerInput} onPress={() => setShowPicker('start')}>
                  <Ionicons name="time-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{formatTime12(startTime)}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>END TIME</Text>
                <TouchableOpacity style={styles.pickerInput} onPress={() => setShowPicker('end')}>
                  <Ionicons name="time-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{formatTime12(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setBooking(null)} disabled={submitting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, submitting && { opacity: 0.6 }]} onPress={confirmBooking} disabled={submitting}>
                {submitting ? <ActivityIndicator color={isDark ? '#000' : '#fff'} /> : <Text style={styles.saveText}>Confirm Booking</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showPicker && (
        <DateTimePicker
          value={showPicker === 'date' ? date : showPicker === 'start' ? startTime : endTime}
          mode={showPicker === 'date' ? 'date' : 'time'}
          display="default"
          minimumDate={showPicker === 'date' ? new Date() : undefined}
          onChange={(_event, selected) => {
            setShowPicker(null);
            if (!selected) return;
            if (showPicker === 'date') setDate(selected);
            else if (showPicker === 'start') setStartTime(selected);
            else setEndTime(selected);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0f172a' : '#f5f3ef' },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
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
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    cardIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    info: { flex: 1 },
    name: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
    time: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
    capacity: { fontSize: 11, color: colors.textMuted },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
    badgeUnavailable: { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' },
    badgeTextUnavailable: { color: '#ef4444' },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      width: '100%',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    modalSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
      marginTop: 10,
    },
    pickerInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 20,
      gap: 10,
    },
    cancelButton: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    saveButton: {
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { color: isDark ? '#0f172a' : '#ffffff', fontSize: 14, fontWeight: '700' },

    centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyIconBox: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  });
