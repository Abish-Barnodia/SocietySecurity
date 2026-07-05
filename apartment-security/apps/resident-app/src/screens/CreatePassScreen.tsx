import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { useData } from '../context/DataContext';

const passTypes = ['One-time visitor', 'Delivery / service', 'Recurring', 'Contractor'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CreatePassScreen({ navigation }: { navigation: any }) {
  const { createPass } = useData();
  const [selectedType, setSelectedType] = useState('One-time visitor');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [shareWhatsApp, setShareWhatsApp] = useState(true);
  
  // Date/Time specific states
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [dates, setDates] = useState({
    entryStart: new Date(new Date().setHours(8, 0, 0, 0)),
    entryEnd: new Date(new Date().setHours(13, 0, 0, 0)),
    expiresOn: new Date(),
    validFrom: new Date(),
    validUntil: new Date(),
  });

  const onChangeDate = (event: any, selectedDate?: Date) => {
    const currentShow = showPicker;
    setShowPicker(null);
    if (selectedDate && currentShow) {
      setDates(prev => ({ ...prev, [currentShow]: selectedDate }));
    }
  };

  const formatTime = (d: Date) => {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${strMinutes} ${ampm}`;
  };

  const formatDate = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
  };

  // Recurring specific
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleCreate = async () => {
    if (!name) {
      alert('Please enter visitor name');
      return;
    }

    const timeString = selectedType === 'Recurring' 
      ? `${formatTime(dates.entryStart)} - ${formatTime(dates.entryEnd)}`
      : `${formatDate(dates.validFrom)} ${formatTime(dates.validFrom)}`;

    const newPass = {
      name,
      type: selectedType,
      time: timeString,
      purpose: purpose || 'Visit',
      phone,
    };

    try {
      await createPass(newPass);
      alert('Pass created successfully!');
      navigation.goBack();
    } catch (error) {
      alert('Failed to create pass. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Pass type</Text>
        <View style={styles.typeGrid}>
          {passTypes.map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.typeButton, selectedType === type && styles.typeButtonActive]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={[styles.typeText, selectedType === type && styles.typeTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Visitor name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter visitor name"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#9ca3af"
        />

        {selectedType !== 'Recurring' && (
          <>
            <Text style={styles.label}>Visitor phone</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +91 98765 43210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholderTextColor="#9ca3af"
            />
          </>
        )}

        <Text style={styles.label}>Purpose</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dinner visit, plumber"
          value={purpose}
          onChangeText={setPurpose}
          placeholderTextColor="#9ca3af"
        />

        {selectedType === 'Recurring' ? (
          <>
            <Text style={styles.label}>Allowed days</Text>
            <View style={styles.daysRow}>
              {days.map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, selectedDays.includes(day) && styles.dayTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Entry window</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={[styles.input, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} onPress={() => setShowPicker('entryStart')}>
                <Text style={{ color: colors.text }}>{formatTime(dates.entryStart)}</Text>
              </TouchableOpacity>
              <Text style={styles.toText}>to</Text>
              <TouchableOpacity style={[styles.input, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} onPress={() => setShowPicker('entryEnd')}>
                <Text style={{ color: colors.text }}>{formatTime(dates.entryEnd)}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Pass expires on</Text>
            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowPicker('expiresOn')}>
              <Text style={{ color: colors.text }}>{formatDate(dates.expiresOn)}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Valid from</Text>
            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowPicker('validFrom')}>
              <Text style={{ color: colors.text }}>{formatDate(dates.validFrom)}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Valid until</Text>
            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowPicker('validUntil')}>
              <Text style={{ color: colors.text }}>{formatDate(dates.validUntil)}</Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.whatsappIcon}>💬</Text>
                <Text style={styles.switchLabel}>Share via WhatsApp</Text>
              </View>
              <Switch
                value={shareWhatsApp}
                onValueChange={setShareWhatsApp}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.white}
              />
            </View>
          </>
        )}

      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={dates[showPicker as keyof typeof dates]}
          mode={
            showPicker === 'entryStart' || showPicker === 'entryEnd'
              ? 'time'
              : 'date'
          }
          display="default"
          onChange={onChangeDate}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleCreate}>
          <Text style={styles.buttonText}>
            {selectedType === 'Recurring' ? 'Create recurring pass' : 'Create pass'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 400, // Large padding to allow scrolling past the keyboard
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeButton: {
    width: '48%',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  typeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  typeTextActive: {
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  whatsappIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: colors.text,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  dayTextActive: {
    color: colors.white,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  toText: {
    marginHorizontal: 16,
    color: colors.textMuted,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
