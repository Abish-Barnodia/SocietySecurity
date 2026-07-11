import { usePasses } from '../context/DomainContexts';
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

const passTypes = ['One-time visitor', 'Delivery / service', 'Recurring', 'Contractor'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CreatePassScreen({ navigation, route }: { navigation: any, route?: any }) {
  const { createPass } = usePasses();
  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  const [selectedType, setSelectedType] = useState(route?.params?.initialType || 'One-time visitor');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [shareWhatsApp, setShareWhatsApp] = useState(true);

  const [isCreating, setIsCreating] = useState(false);

  // Date/Time specific states
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [dates, setDates] = useState({
    entryStart: new Date(new Date().setHours(8, 0, 0, 0)),
    entryEnd: new Date(new Date().setHours(13, 0, 0, 0)),
    expiresOn: tomorrow,
    validFrom: new Date(),
    validUntil: tomorrow,
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
    if (isCreating) return;
    
    if (!name) {
      alert('Please enter visitor name');
      return;
    }

    const typeMapping: any = {
      'One-time visitor': 'ONE_TIME',
      'Delivery / service': 'DELIVERY',
      'Recurring': 'RECURRING',
      'Contractor': 'CONTRACTOR'
    };
    
    const dayMapping: any = {
      'Mon': 'MONDAY', 'Tue': 'TUESDAY', 'Wed': 'WEDNESDAY', 
      'Thu': 'THURSDAY', 'Fri': 'FRIDAY', 'Sat': 'SATURDAY', 'Sun': 'SUNDAY'
    };

    const payload: any = {
      type: typeMapping[selectedType],
      visitorName: name,
      visitorPhone: phone || undefined,
      purpose: purpose || 'Visit',
      validFrom: selectedType === 'Recurring' ? dates.entryStart.toISOString() : dates.validFrom.toISOString(),
      validUntil: selectedType === 'Recurring' ? dates.expiresOn.toISOString() : dates.validUntil.toISOString(),
    };

    if (selectedType === 'Recurring') {
      payload.recurringRule = {
        allowedDays: selectedDays.map(d => dayMapping[d]),
        windowStartTime: `${dates.entryStart.getHours().toString().padStart(2, '0')}:${dates.entryStart.getMinutes().toString().padStart(2, '0')}`,
        windowEndTime: `${dates.entryEnd.getHours().toString().padStart(2, '0')}:${dates.entryEnd.getMinutes().toString().padStart(2, '0')}`
      };
    }

    try {
      setIsCreating(true);
      await createPass(payload);
      alert('Pass created successfully!');
      navigation.navigate('MainTabs', { screen: 'Passes' });
    } catch (error: any) {
      setIsCreating(false);
      alert(`Failed to create pass: ${error.message}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
          placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}

        <Text style={styles.label}>Purpose</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dinner visit, plumber"
          value={purpose}
          onChangeText={setPurpose}
          placeholderTextColor={colors.textMuted}
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
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" style={styles.whatsappIcon} />
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
        <TouchableOpacity style={[styles.button, isCreating && { opacity: 0.6 }]} onPress={handleCreate} disabled={isCreating}>
          <Text style={styles.buttonText}>
            {isCreating ? 'Creating...' : (selectedType === 'Recurring' ? 'Create recurring pass' : 'Create pass')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 400,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.lg,
  },
  typeButton: {
    width: '48%',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    borderRadius: roundness.md,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  typeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: isDarkMode ? '#452a0a' : colors.primaryLight,
  },
  typeText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  typeTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    borderRadius: roundness.md,
    padding: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  switchRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginVertical: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: roundness.md,
  },
  switchLabelContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  whatsappIcon: {
    marginRight: spacing.md,
  },
  switchLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  daysRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.xl,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  dayButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
  },
  dayTextActive: {
    color: isDarkMode ? colors.white : colors.text, // Assuming black text on mustard in light mode
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xl,
  },
  toText: {
    marginHorizontal: spacing.lg,
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
  },
  footer: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: roundness.lg,
    alignItems: 'center' as const,
  },
  buttonText: {
    color: isDarkMode ? colors.white : colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
