import { usePasses, useEntries, useHousehold } from '../context/DomainContexts';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { logout, userProfile, userEmail } = useAuth();
  const { passes } = usePasses();
  const { entries } = useEntries();
  const { alertPreferences, updateAlertPreferences, emergencyContacts, addEmergencyContact, removeEmergencyContact } = useHousehold();
  const [duressVisible, setDuressVisible] = useState(false);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const [emergencyContactsVisible, setEmergencyContactsVisible] = useState(false);

  const { colors, isDarkMode, toggleTheme } = useTheme();
  const styles = useStyles(getStyles);

  // New Contact State
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Fallback to defaults if no profile exists
  const name = userProfile?.name || 'Resident';
  const phone = userProfile?.phone || userEmail || '';
  const initial = name.charAt(0).toUpperCase();

  const activePassesCount = passes.filter(p => p.status === 'Active').length;
  const entriesCount = entries.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {userProfile?.photoUri ? (
                <Image source={{ uri: userProfile.photoUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-outline" size={32} color={colors.primary} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.phone}>{phone}</Text>
            </View>
          </View>

          <View style={styles.towerGrid}>
            <View style={styles.towerCard}>
              <Text style={styles.towerLabel}>Tower</Text>
              <Text style={styles.towerValue}>Tower A</Text>
            </View>
            <View style={styles.towerCard}>
              <Text style={styles.towerLabel}>Flat</Text>
              <Text style={styles.towerValue}>402</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.appearanceCard} onPress={toggleTheme}>
          <View style={styles.appearanceLeft}>
            <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#452a0a' : colors.primaryLight }]}>
              <Ionicons name={isDarkMode ? "moon-outline" : "sunny-outline"} size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.appearanceTitle}>Appearance</Text>
              <Text style={styles.appearanceSubtitle}>{isDarkMode ? 'Dark mode' : 'Light mode'}</Text>
            </View>
          </View>
          <View style={[styles.toggleSwitchBase, isDarkMode && { backgroundColor: colors.primary }]}>
            <View style={[styles.toggleKnob, isDarkMode && { transform: [{ translateX: 20 }] }]}>
              <Ionicons name={isDarkMode ? "moon" : "sunny"} size={14} color={isDarkMode ? colors.white : colors.primary} />
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>SETTINGS</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setAlertsVisible(true)}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#452a0a' : colors.primaryLight }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.menuText}>Notification Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => setEmergencyContactsVisible(true)}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#4a1111' : '#f5d3d3' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#c92a2a" />
              </View>
              <Text style={styles.menuText}>Security Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#262626' : '#e6dfd1' }]}>
                <Ionicons name="eye-off-outline" size={20} color={colors.textMuted} />
              </View>
              <Text style={styles.menuText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.sectionCard}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#452a0a' : colors.primaryLight }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.menuText}>App Version</Text>
            </View>
            <Text style={styles.versionText}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#452a0a' : colors.primaryLight }]}>
                <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.menuText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <View style={[styles.iconWrapper, { backgroundColor: 'transparent', width: 32 }]}>
            <Ionicons name="log-out-outline" size={20} color="#c92a2a" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Alert Preferences Modal */}
      <Modal visible={alertsVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitleSmall}>Alert Preferences</Text>
            <TouchableOpacity onPress={() => setAlertsVisible(false)}>
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContentScroll}>
            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Push Notifications</Text>
                <Text style={styles.prefDesc}>Receive entry and exit alerts on your phone lock screen.</Text>
              </View>
              <View style={[styles.toggleSwitch, { backgroundColor: alertPreferences?.pushEnabled ? colors.success : colors.border }]}>
                <TouchableOpacity onPress={() => updateAlertPreferences({ pushEnabled: !alertPreferences?.pushEnabled })} style={[styles.toggleThumb, alertPreferences?.pushEnabled && styles.toggleThumbActive]} />
              </View>
            </View>
            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>SMS Fallback</Text>
                <Text style={styles.prefDesc}>Get an SMS if you don't respond to a push notification.</Text>
              </View>
              <View style={[styles.toggleSwitch, { backgroundColor: alertPreferences?.smsEnabled ? colors.success : colors.border }]}>
                <TouchableOpacity onPress={() => updateAlertPreferences({ smsEnabled: !alertPreferences?.smsEnabled })} style={[styles.toggleThumb, alertPreferences?.smsEnabled && styles.toggleThumbActive]} />
              </View>
            </View>
            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefTitle}>Domestic Worker Entries</Text>
                <Text style={styles.prefDesc}>Notify me when my registered staff arrives.</Text>
              </View>
              <View style={[styles.toggleSwitch, { backgroundColor: alertPreferences?.staffEnabled ? colors.success : colors.border }]}>
                <TouchableOpacity onPress={() => updateAlertPreferences({ staffEnabled: !alertPreferences?.staffEnabled })} style={[styles.toggleThumb, alertPreferences?.staffEnabled && styles.toggleThumbActive]} />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Emergency Contacts Modal */}
      <Modal visible={emergencyContactsVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitleSmall}>Emergency Contacts</Text>
            <TouchableOpacity onPress={() => setEmergencyContactsVisible(false)}>
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContentScroll} keyboardShouldPersistTaps="handled">
            <Text style={[styles.prefDesc, { marginBottom: spacing.lg }]}>These contacts will be notified automatically if you trigger an SOS.</Text>

            {emergencyContacts.length === 0 ? (
              <Text style={{ marginTop: 20, color: colors.textMuted }}>No emergency contacts added yet.</Text>
            ) : (
              emergencyContacts.map(contact => (
                <View key={contact.id} style={styles.contactCard}>
                  <Ionicons name="person-circle-outline" size={40} color={colors.textMuted} style={{ marginRight: spacing.md }} />
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name} ({contact.relation})</Text>
                    <Text style={styles.contactPhone}>{contact.phone}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeEmergencyContact(contact.id)}>
                    <Ionicons name="trash-outline" size={24} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {isAddingContact ? (
              <View style={{ marginTop: 20 }}>
                <TextInput style={styles.input} placeholder="Contact Name" placeholderTextColor={colors.textMuted} value={newContactName} onChangeText={setNewContactName} />
                <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="Phone Number" placeholderTextColor={colors.textMuted} value={newContactPhone} onChangeText={setNewContactPhone} keyboardType="phone-pad" />
                <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="Relation (e.g. Spouse, Parent)" placeholderTextColor={colors.textMuted} value={newContactRelation} onChangeText={setNewContactRelation} />
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <TouchableOpacity style={[styles.addButton, { flex: 1, marginRight: 5 }]} onPress={() => {
                    if (newContactName && newContactPhone) {
                      addEmergencyContact({ id: Date.now().toString(36), name: newContactName, phone: newContactPhone, relation: newContactRelation || 'Family' });
                      setIsAddingContact(false);
                      setNewContactName('');
                      setNewContactPhone('');
                      setNewContactRelation('');
                    }
                  }}>
                    <Text style={styles.addButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.addButton, { flex: 1, marginLeft: 5, backgroundColor: isDarkMode ? '#262626' : colors.border }]} onPress={() => setIsAddingContact(false)}>
                    <Text style={[styles.addButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={() => setIsAddingContact(true)}>
                <Text style={styles.addButtonText}>+ Add New Contact</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Duress Modal */}
      <Modal visible={duressVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setDuressVisible(false)}>
            <Ionicons name="close" size={28} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.modalContent}>
            <Ionicons name="shield-checkmark" size={80} color={colors.danger} style={styles.shieldIcon} />
            <Text style={styles.modalTitle}>Emergency alert</Text>
            <Text style={styles.modalSubtitle}>
              Press the button below to silently alert the security guard and property management. No sound will play on your device.
            </Text>

            <TouchableOpacity style={styles.emergencyButton} onPress={() => { alert('Emergency alert sent!'); setDuressVisible(false); }}>
              <Ionicons name="warning" size={24} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.emergencyButtonText}>Send silent alert</Text>
            </TouchableOpacity>

            <Text style={styles.emergencyInfoText}>
              For immediate danger, call emergency services
            </Text>
            <Text style={styles.emergencyNumbers}>
              <Text style={{ fontWeight: 'bold' }}>100</Text> (Police) • <Text style={{ fontWeight: 'bold' }}>112</Text> (Emergency)
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  profileCard: {
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    borderRadius: roundness.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
  },
  profileHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: isDarkMode ? '#452a0a' : '#e6dfd1',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.md,
  },
  avatarImage: {
    width: '100%' as const,
    height: '100%' as const,
    borderRadius: 16,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  phone: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  towerGrid: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
  },
  towerCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: roundness.md,
    alignItems: 'center' as const,
  },
  towerLabel: {
    fontSize: typography.sizes.xs,
    color: '#6c757d',
    marginBottom: 4,
  },
  towerValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  appearanceCard: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    padding: spacing.lg,
    borderRadius: roundness.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
  },
  appearanceLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  appearanceTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  appearanceSubtitle: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  toggleSwitchBase: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e6dfd1',
    padding: 2,
    flexDirection: 'row' as const,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: '#6c757d',
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    borderRadius: roundness.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
  },
  menuItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.lg,
  },
  menuItemLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.md,
  },
  menuText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  versionText: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  divider: {
    height: 1,
    backgroundColor: isDarkMode ? '#262626' : '#eae7e1',
  },
  logoutButton: {
    flexDirection: 'row' as const,
    backgroundColor: isDarkMode ? '#4a1111' : '#f5d3d3',
    padding: spacing.md,
    borderRadius: roundness.lg,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eec2c2',
  },
  logoutText: {
    color: '#c92a2a',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },

  /* Modal Styles */
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    padding: spacing.lg,
    alignItems: 'flex-end' as const,
  },
  modalContent: {
    flex: 1,
    alignItems: 'center' as const,
    padding: spacing.xl,
    paddingTop: 40,
  },
  shieldIcon: {
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 40,
  },
  emergencyButton: {
    flexDirection: 'row' as const,
    backgroundColor: colors.danger,
    width: '100%' as const,
    padding: 20,
    borderRadius: roundness.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.xl,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  emergencyButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  emergencyInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  emergencyNumbers: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center' as const,
  },
  modalHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleSmall: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  modalContentScroll: {
    padding: spacing.xl,
  },
  prefRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefTextContainer: {
    flex: 1,
    paddingRight: spacing.lg,
  },
  prefTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  prefDesc: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center' as const,
    padding: 2,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  contactCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: roundness.lg,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    marginVertical: spacing.sm,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  contactPhone: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    borderRadius: roundness.md,
  },
  addButton: {
    padding: spacing.lg,
    backgroundColor: isDarkMode ? '#452a0a' : colors.primaryLight,
    borderRadius: roundness.md,
    alignItems: 'center' as const,
    marginTop: 10,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
