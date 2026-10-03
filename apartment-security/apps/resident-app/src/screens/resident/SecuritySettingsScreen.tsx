import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';

export default function SecuritySettingsScreen() {
  const navigation = useNavigation();
  const { userPhone, userEmail, logoutAllDevices } = useAuth();
  const { emergencyContacts, updateEmergencyContact, clearEmergencyContact, triggerDuressAlert } = useData();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

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
      Alert.alert('Missing Details', 'Please enter both contact name and phone number.');
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
    Alert.alert('Remove Emergency Contact', 'Are you sure you want to remove this contact?', [
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
      'Send Silent Panic Alert?',
      'This will immediately and silently notify the security gate and property manager without making any sound on your phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Panic Alert',
          style: 'destructive',
          onPress: async () => {
            setSendingAlert(true);
            try {
              await triggerDuressAlert();
              Alert.alert('Alert Dispatched', 'Guard station and property security have been alerted with high priority.');
            } catch {
              Alert.alert('Error', 'Failed to send alert. Please call emergency contacts or guards directly.');
            } finally {
              setSendingAlert(false);
            }
          },
        },
      ]
    );
  };

  const handleLogoutAll = () => {
    Alert.alert('Log Out of All Devices?', 'You will be signed out from every browser and mobile session.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out Everywhere',
        style: 'destructive',
        onPress: async () => {
          setLoggingOutAll(true);
          await logoutAllDevices();
        },
      },
    ]);
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
          <Text style={styles.headerTitle}>Security & Privacy</Text>
          <Text style={styles.headerSubtitle}>Account safety, emergency contacts & panic mode</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>AUTHENTICATED CREDENTIALS</Text>
        <View style={styles.card}>
          {!!userPhone && (
            <View style={styles.infoRow}>
              <View style={styles.iconBoxSmall}>
                <Ionicons name="call-outline" size={18} color={colors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.infoLabel}>Registered Mobile</Text>
                <Text style={styles.infoText}>{userPhone}</Text>
              </View>
            </View>
          )}
          {!!userEmail && (
            <View style={[styles.infoRow, !!userPhone && { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 }]}>
              <View style={styles.iconBoxSmall}>
                <Ionicons name="mail-outline" size={18} color={colors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.infoLabel}>Registered Email</Text>
                <Text style={styles.infoText}>{userEmail}</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>EMERGENCY SOS CONTACT</Text>
        <View style={styles.card}>
          <Text style={styles.helperText}>
            This contact will receive automated SMS alerts if you activate silent emergency panic.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Contact Name (e.g. Spouse / Relative)"
            placeholderTextColor={colors.textMuted}
            value={contactName}
            onChangeText={setContactName}
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Phone Number (+91 98765 43210)"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={setContactPhone}
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveContact} disabled={savingContact}>
              {savingContact ? <ActivityIndicator color={isDark ? '#000' : '#fff'} /> : <Text style={styles.primaryButtonText}>Save Contact</Text>}
            </TouchableOpacity>
            {!!existingContact && (
              <TouchableOpacity style={styles.removeButton} onPress={handleRemoveContact} disabled={savingContact}>
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>SILENT PANIC ALERT</Text>
        <View style={styles.card}>
          <Text style={styles.helperText}>
            Trigger an immediate high-priority alarm at the security guard gates and management desk.
          </Text>
          <TouchableOpacity style={styles.duressButton} onPress={handleDuress} disabled={sendingAlert}>
            {sendingAlert ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.duressButtonText}>Trigger Silent Panic Alert</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>ACTIVE SESSIONS</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.logoutAllRow} onPress={handleLogoutAll} disabled={loggingOutAll}>
            <View style={styles.iconBoxSmall}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.logoutAllText}>Log Out of All Devices</Text>
              <Text style={styles.helperTextSub}>Invalidates all active tokens across mobile and web.</Text>
            </View>
          </TouchableOpacity>
        </View>
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

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 14,
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    iconBoxSmall: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    infoText: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 1 },
    helperText: { fontSize: 12, color: colors.textMuted, marginBottom: 12, lineHeight: 17 },
    helperTextSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    input: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
    },
    buttonRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
    primaryButton: {
      flex: 1,
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700', fontSize: 14 },
    removeButton: {
      borderWidth: 1,
      borderColor: '#ef4444',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },

    duressButton: {
      flexDirection: 'row',
      backgroundColor: '#ef4444',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    duressButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

    logoutAllRow: { flexDirection: 'row', alignItems: 'center' },
    logoutAllText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  });
