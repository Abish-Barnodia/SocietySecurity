import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { useData } from '../context/DataContext';

const AMENITIES = [
  { id: '1', name: 'Gymnasium', time: '5:00 AM – 11:00 PM', capacity: 'Capacity: 20 people', status: 'Available', icon: '💪', statusColor: colors.success },
  { id: '2', name: 'Swimming pool', time: '6:00 AM – 8:00 PM', capacity: 'Capacity: 30 people', status: '2 booked', icon: '🏊‍♂️', statusColor: colors.warning },
  { id: '3', name: 'Clubhouse', time: '9:00 AM – 10:00 PM', capacity: 'Capacity: 100 people', status: 'Available', icon: '🎉', statusColor: colors.success },
  { id: '4', name: 'Guest suite', time: 'Check-in 2 PM', capacity: 'Capacity: 4 guests', status: 'Available', icon: '🛏️', statusColor: colors.success },
];

export default function AmenitiesScreen({ navigation }: { navigation: any }) {
  const { addPass } = useData();

  const handleBook = (amenityName: string) => {
    // Generate a pass for the amenity
    const newPassId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    addPass({
      id: newPassId,
      name: amenityName,
      type: 'Amenity Access',
      purpose: 'Recreation',
      time: 'Valid for next 2 hours',
      color: colors.primary,
      gate: `${amenityName} Entry`,
      status: 'Active',
      created: new Date().toLocaleDateString(),
    });

    alert(`Successfully booked ${amenityName}!\nA digital access pass has been generated and added to your Passes. Use it to scan at the amenity entrance.`);
    navigation.navigate('Passes');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {AMENITIES.map((amenity) => (
          <TouchableOpacity 
            key={amenity.id} 
            style={styles.card}
            onPress={() => handleBook(amenity.name)}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{amenity.icon}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{amenity.name}</Text>
                <Text style={styles.time}>{amenity.time}</Text>
                <Text style={styles.capacity}>{amenity.capacity}</Text>
              </View>
              <View style={styles.badgeContainer}>
                <Text style={[styles.statusText, { color: amenity.statusColor }]}>{amenity.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
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
});
