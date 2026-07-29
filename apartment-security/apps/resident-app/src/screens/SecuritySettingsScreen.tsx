import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';

export default function SecuritySettingsScreen() {
  const { userPhone, userEmail, logoutAllDevices } = useAuth();
  const { emergencyContacts, updateEmergencyContact, clearEmergencyContact, triggerDuressAlert } = useData();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const existingContact = emergencyContacts[0];
  const [contactName, setContactName] = useState(existingContact?.name ?? '');
  const [contactPhone, setContactPhone] = useState(existingContact?.phone ?? '');
  const [savingContact, setSavingContact] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    setContactName(existingContact?.name ?? '');
    setContactPhone(existingContact?.phone ?? '');
  }, [existingContact?.name, existingContact?.phone]);

  const handleSaveContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Missing details', 'Enter both a name and a phone number.');
      return;
    }
    setSavingContact(true);
    try {
      await updateEmergencyContact(contactName.trim(), contactPhone.trim());
      Alert.alert('Saved', 'Your emergency contact has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save emergency contact. Please try again.');
    } finally {
      setSavingContact(false);
    }
  };

  const handleRemoveContact = () => {
    Alert.alert('Remove emergency contact', 'Are you sure you want to remove this contact?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSavingContact(true);
          try {
            await clearEmergencyContact();
            setContactName('');
            setContactPhone('');
          } catch {
            Alert.alert('Error', 'Failed to remove emergency contact.');
          } finally {
            setSavingContact(false);
          }
        },
      },
    ]);
  };

  const handleDuress = () => {
    Alert.alert(
      'Send silent alert?',
      'This will immediately and silently notify the guard station and property management.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send alert',
          style: 'destructive',
          onPress: async () => {
            setSendingAlert(true);
            try {
              await triggerDuressAlert();
              Alert.alert('Alert sent', 'Guard station and management have been notified.');
            } catch {
              Alert.alert('Error', 'Failed to send the alert. Please try again or call for help directly.');
            } finally {
              setSendingAlert(false);
            }
          },
        },
      ]
    );
  };

  const handleLogoutAll = () => {
    Alert.alert('Log out of all devices?', "You'll be signed out everywhere, including this device.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out everywhere',
        style: 'destructive',
        onPress: async () => {
          setLoggingOutAll(true);
          await logoutAllDevices();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>SIGNED IN AS</Text>
      <View style={styles.card}>
        {!!userPhone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.infoIcon} />
            <Text style={styles.infoText}>{userPhone}</Text>
          </View>
        )}
        {!!userEmail && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.infoIcon} />
            <Text style={styles.infoText}>{userEmail}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
      <View style={styles.card}>
        <Text style={styles.helperText}>Notified by SMS if you send a silent alert.</Text>
        <TextInput
          style={styles.input}
          placeholder="Contact name"
          placeholderTextColor={colors.textMuted}
          value={contactName}
          onChangeText={setContactName}
        />
        <TextInput
          style={[styles.input, { marginTop: 10 }]}
          placeholder="Phone number"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={contactPhone}
          onChangeText={setContactPhone}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={handleSaveContact} disabled={savingContact}>
            {savingContact ? <ActivityIndicator color={colors.card} /> : <Text style={styles.primaryButtonText}>Save</Text>}
          </TouchableOpacity>
          {!!existingContact && (
            <TouchableOpacity style={styles.removeButton} onPress={handleRemoveContact} disabled={savingContact}>
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>EMERGENCY ALERT</Text>
      <View style={styles.card}>
        <Text style={styles.helperText}>
          Silently alert the security guard and property management. No sound will play on your device.
        </Text>
        <TouchableOpacity style={styles.duressButton} onPress={handleDuress} disabled={sendingAlert}>
          {sendingAlert ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <>
              <Ionicons name="warning" size={18} color={colors.card} style={{ marginRight: 8 }} />
              <Text style={styles.duressButtonText}>Send silent alert</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>SESSIONS</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.logoutAllRow} onPress={handleLogoutAll} disabled={loggingOutAll}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: 10 }} />
          {loggingOutAll ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.logoutAllText}>Log out of all devices</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 8,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    infoIcon: { marginRight: 10 },
    infoText: { fontSize: 15, color: colors.text },
    helperText: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    buttonRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: colors.card, fontWeight: '700', fontSize: 14 },
    removeButton: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeButtonText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
    duressButton: {
      flexDirection: 'row',
      backgroundColor: colors.danger,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    duressButtonText: { color: colors.card, fontWeight: '700', fontSize: 15 },
    logoutAllRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    logoutAllText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  });
