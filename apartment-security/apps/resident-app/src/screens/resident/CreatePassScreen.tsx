import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { shareQrAsImage } from '../../utils/shareQrPass';
import PhoneInput from '../../components/PhoneInput';
import { COUNTRIES } from '../../utils/countryCodes';

const passTypes = ['One-time visitor', 'Delivery / service', 'Recurring', 'Contractor'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// UI labels the backend's createPassSchema doesn't know about — it only accepts these enum values.
const PASS_TYPE_TO_API: Record<string, string> = {
  'One-time visitor': 'ONE_TIME',
  'Delivery / service': 'DELIVERY',
  'Recurring': 'RECURRING',
  'Contractor': 'CONTRACTOR',
};

const DAY_TO_API: Record<string, string> = {
  Mon: 'MONDAY', Tue: 'TUESDAY', Wed: 'WEDNESDAY', Thu: 'THURSDAY', Fri: 'FRIDAY', Sat: 'SATURDAY', Sun: 'SUNDAY',
};

export default function CreatePassScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const { createPass } = useData();
  const [selectedType, setSelectedType] = useState('One-time visitor');
  const [name, setName] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(COUNTRIES[0]);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [purpose, setPurpose] = useState('');
  const [shareWhatsApp, setShareWhatsApp] = useState(true);
  
  // Date/Time specific states
  const [showPicker, setShowPicker] = useState<{ field: keyof typeof dates; mode: 'date' | 'time' } | null>(null);
  const [dates, setDates] = useState({
    entryStart: new Date(new Date().setHours(8, 0, 0, 0)),
    entryEnd: new Date(new Date().setHours(13, 0, 0, 0)),
    expiresOn: new Date(),
    validFrom: new Date(),
    // Defaults to a real multi-hour window, not "now" — validFrom===validUntil
    // meant every pass expired within seconds of creation, before a guard
    // could ever scan it (the date pickers below only pick a day, not a
    // time, so an untouched field stays exactly at this initial value).
    validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000),
  });

  const onChangeDate = (event: any, selectedValue?: Date) => {
    const current = showPicker;
    setShowPicker(null);
    if (!selectedValue || !current) return;

    setDates(prev => {
      // Merge just the picked component (day, or hour/minute) onto the
      // field's existing value, so picking a date doesn't reset the time
      // that was already set, and vice versa.
      const merged = new Date(prev[current.field]);
      if (current.mode === 'date') {
        merged.setFullYear(selectedValue.getFullYear(), selectedValue.getMonth(), selectedValue.getDate());
      } else {
        merged.setHours(selectedValue.getHours(), selectedValue.getMinutes(), 0, 0);
      }
      // "Pass expires on" (Recurring) is day-only — always end of day.
      if (current.field === 'expiresOn') merged.setHours(23, 59, 59, 999);
      return { ...prev, [current.field]: merged };
    });
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

  const formatTime24 = (d: Date) => {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name) {
      Alert.alert('Missing name', 'Please enter visitor name');
      return;
    }

    const newPass: Record<string, unknown> = {
      visitorName: name,
      type: PASS_TYPE_TO_API[selectedType] ?? 'ONE_TIME',
      purpose: purpose || 'Visit',
      visitorPhone: phoneDigits ? `${phoneCountry.dial}${phoneDigits}` : '',
      validFrom: selectedType === 'Recurring' ? new Date().toISOString() : dates.validFrom.toISOString(),
      validUntil: selectedType === 'Recurring' ? dates.expiresOn.toISOString() : dates.validUntil.toISOString(),
    };

    if (selectedType === 'Recurring') {
      newPass.recurringRule = {
        allowedDays: selectedDays.map(day => DAY_TO_API[day]),
        windowStartTime: formatTime24(dates.entryStart),
        windowEndTime: formatTime24(dates.entryEnd),
      };
    }

    setIsSubmitting(true);
    try {
      const created = await createPass(newPass);
      if (shareWhatsApp && created.qrPayload) {
        try {
          await shareQrAsImage(created.qrPayload, created.id.substring(created.id.length - 8));
        } catch {
          // The pass is already created either way — a failed share shouldn't block navigation back.
        }
      }
      Alert.alert('Success', 'Pass created successfully!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to create pass. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            <PhoneInput
              colors={colors}
              country={phoneCountry}
              onChangeCountry={setPhoneCountry}
              digits={phoneDigits}
              onChangeDigits={setPhoneDigits}
              placeholder="98765 43210"
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
              <TouchableOpacity style={[styles.input, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} onPress={() => setShowPicker({ field: 'entryStart', mode: 'time' })}>
                <Text style={{ color: colors.text }}>{formatTime(dates.entryStart)}</Text>
              </TouchableOpacity>
              <Text style={styles.toText}>to</Text>
              <TouchableOpacity style={[styles.input, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} onPress={() => setShowPicker({ field: 'entryEnd', mode: 'time' })}>
                <Text style={{ color: colors.text }}>{formatTime(dates.entryEnd)}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Pass expires on</Text>
            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowPicker({ field: 'expiresOn', mode: 'date' })}>
              <Text style={{ color: colors.text }}>{formatDate(dates.expiresOn)}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Valid from</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={[styles.input, { flex: 1.4, marginBottom: 0, marginRight: 10, justifyContent: 'center' }]} onPress={() => setShowPicker({ field: 'validFrom', mode: 'date' })}>
                <Text style={{ color: colors.text }}>{formatDate(dates.validFrom)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.input, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} onPress={() => setShowPicker({ field: 'validFrom', mode: 'time' })}>
                <Text style={{ color: colors.text }}>{formatTime(dates.validFrom)}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Valid until</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={[styles.input, { flex: 1.4, marginBottom: 0, marginRight: 10, justifyContent: 'center' }]} onPress={() => setShowPicker({ field: 'validUntil', mode: 'date' })}>
                <Text style={{ color: colors.text }}>{formatDate(dates.validUntil)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.input, { flex: 1, marginBottom: 0, justifyContent: 'center' }]} onPress={() => setShowPicker({ field: 'validUntil', mode: 'time' })}>
                <Text style={{ color: colors.text }}>{formatTime(dates.validUntil)}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.whatsappIcon}>💬</Text>
                <Text style={styles.switchLabel}>Share via WhatsApp</Text>
              </View>
              <Switch
                value={shareWhatsApp}
                onValueChange={setShareWhatsApp}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.card}
              />
            </View>
          </>
        )}

      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={dates[showPicker.field]}
          mode={showPicker.mode}
          display="default"
          is24Hour={false}
          onChange={onChangeDate}
        />
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={[styles.button, isSubmitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={isSubmitting}>
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Creating…' : selectedType === 'Recurring' ? 'Create recurring pass' : 'Create pass'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
    color: colors.card,
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
    backgroundColor: colors.card,
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
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
