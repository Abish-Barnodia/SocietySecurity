import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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

export default function AmenitiesScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { amenities, fetchAmenities, bookAmenity } = useData();
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
      setLoading(true);
      fetchAmenities().finally(() => setLoading(false));
    }, [fetchAmenities])
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
      Alert.alert('Booked', `${booking.name} has been booked for ${formatDate(date)}.`);
      setBooking(null);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to book this amenity. Please try a different time.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {amenities.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="business-outline" size={36} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>No amenities available</Text>
          </View>
          ) : (
            amenities.map((amenity) => (
              <TouchableOpacity
                key={amenity.id}
                style={styles.card}
                onPress={() => openBooking(amenity)}
              >
                <View style={styles.cardRow}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={(() => {
                        const name = amenity.name.toLowerCase();
                        if (name.includes('gym') || name.includes('fitness')) return 'barbell-outline';
                        if (name.includes('pool') || name.includes('swim')) return 'water-outline';
                        if (name.includes('club') || name.includes('hall')) return 'grid-outline';
                        if (name.includes('tennis') || name.includes('court')) return 'tennisball-outline';
                        if (name.includes('park') || name.includes('garden')) return 'leaf-outline';
                        if (name.includes('lounge') || name.includes('terrace')) return 'cafe-outline';
                        return 'business-outline';
                      })()}
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{amenity.name}</Text>
                    <Text style={styles.time}>{amenity.timeLabel}</Text>
                    <Text style={styles.capacity}>Capacity: {amenity.capacity} people</Text>
                  </View>
                  <View style={styles.badgeContainer}>
                    <Text style={[styles.statusText, { color: amenity.status === 'AVAILABLE' ? colors.success : colors.warning }]}>
                      {amenity.status === 'AVAILABLE' ? 'Available' : amenity.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={!!booking} transparent animationType="slide" onRequestClose={() => setBooking(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setBooking(null)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Book {booking?.name}</Text>

            <Text style={styles.label}>Date</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowPicker('date')}>
              <Text style={{ color: colors.text }}>{formatDate(date)}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Start time</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowPicker('start')}>
              <Text style={{ color: colors.text }}>{formatTime12(startTime)}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>End time</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowPicker('end')}>
              <Text style={{ color: colors.text }}>{formatTime12(endTime)}</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setBooking(null)} disabled={submitting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, submitting && { opacity: 0.6 }]} onPress={confirmBooking} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.card} /> : <Text style={styles.saveText}>Confirm Booking</Text>}
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
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  capacity: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badgeContainer: {
    paddingLeft: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
});
