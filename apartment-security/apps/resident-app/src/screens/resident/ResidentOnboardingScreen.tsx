import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

export default function ResidentOnboardingScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { updateProfile } = useAuth();

  const [name, setName] = useState('');
  const [towers, setTowers] = useState<string[]>([]);
  const [tower, setTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [residentType, setResidentType] = useState('Owner');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [towerPickerOpen, setTowerPickerOpen] = useState(false);
  const [loadingTowers, setLoadingTowers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadTowers = async () => {
      try {
        const response = await api.get('/residents/towers');
        const fetched: string[] = response.data.data ?? [];
        setTowers(fetched);
        setTower(fetched[0] ?? '');
      } catch {
        Alert.alert('Error', 'Could not load tower list. Please try again.');
      } finally {
        setLoadingTowers(false);
      }
    };
    loadTowers();
  }, []);

  const handleComplete = async () => {
    if (!name.trim() || !tower || !flatNumber.trim()) {
      Alert.alert('Missing details', 'Please fill in all details before continuing.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/residents/me/onboard', {
        name: name.trim(),
        tower,
        flatNumber: flatNumber.trim(),
        type: residentType,
        vehicleNumber: vehicleNumber.trim() || undefined,
      });
      const resident = response.data.data;
      updateProfile({
        name: resident.name,
        phone: '',
        email: resident.email ?? null,
        wing: resident.unit?.tower ?? tower,
        flat: resident.unit?.unitNumber ?? flatNumber,
        propertyName: resident.unit?.property?.name ?? '',
        photoUri: null,
      });
    } catch (error: any) {
      const message = error.response?.data?.message ?? 'Failed to create profile. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconContainer}>
            <Text style={styles.emoji}>👤</Text>
          </View>

          <Text style={styles.title}>Create Profile</Text>
          <Text style={styles.subtitle}>Set up your resident profile to get started</Text>

          <View style={styles.form}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={[styles.input, name ? styles.inputFilled : null]}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>TOWER</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setTowerPickerOpen(true)}
              disabled={loadingTowers}
            >
              {loadingTowers ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.dropdownText}>{tower || 'Select tower'}</Text>
              )}
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.label}>FLAT NUMBER</Text>
            <TextInput
              style={[styles.input, flatNumber ? styles.inputFilled : null]}
              placeholder="e.g. 402"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              value={flatNumber}
              onChangeText={setFlatNumber}
            />

            <Text style={styles.label}>RESIDENT TYPE</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeBtn, residentType === 'Owner' && { backgroundColor: colors.primary }]}
                onPress={() => setResidentType('Owner')}
              >
                <Text style={[styles.typeBtnText, residentType === 'Owner' && { color: colors.card }]}>Owner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, residentType === 'Tenant' && { backgroundColor: colors.primary }]}
                onPress={() => setResidentType('Tenant')}
              >
                <Text style={[styles.typeBtnText, residentType === 'Tenant' && { color: colors.card }]}>Tenant</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>VEHICLE REGISTRATION (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, vehicleNumber ? styles.inputFilled : null]}
              placeholder="e.g. MH 01 AB 1234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, (!name || !tower || !flatNumber || submitting) && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Setting up...' : 'Continue to App'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={towerPickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTowerPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={towers}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setTower(item);
                    setTowerPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {item === tower && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 24,
    marginBottom: 32,
  },
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    color: colors.text,
  },
  inputFilled: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  dropdownText: {
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#EBE3DB',
  },
  buttonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
    paddingVertical: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemText: {
    fontSize: 16,
    color: colors.text,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  typeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
