import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Image, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { colors } from '../theme/colors';

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { logout, userProfile, userEmail } = useAuth();
  const { passes, entries, alertPreferences, updateAlertPreferences, emergencyContacts, addEmergencyContact, removeEmergencyContact } = useData();
  const [duressVisible, setDuressVisible] = useState(false);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const [emergencyContactsVisible, setEmergencyContactsVisible] = useState(false);

  // New Contact State
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Fallback to defaults if no profile exists
  const name = userProfile?.name || 'Resident';
  const phone = userProfile?.phone || userEmail || '';
  const initial = name.charAt(0).toUpperCase();

  const activePassesCount = passes.filter(p => p.status === 'Active').length;
  const entriesCount = entries.length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.header}>
          <View style={styles.avatar}>
            {userProfile?.photoUri ? (
              <Image source={{ uri: userProfile.photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.phone}>{phone}</Text>
          {userProfile?.wing && userProfile?.flat && (
            <Text style={styles.flatText}>Wing {userProfile.wing} • Flat {userProfile.flat}</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{activePassesCount}</Text>
            <Text style={styles.statLabel}>Active passes</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{entriesCount}</Text>
            <Text style={styles.statLabel}>Entries this month</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Household')}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>👨‍👩‍👧</Text>
              <Text style={styles.menuText}>Household members</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={() => setAlertsVisible(true)}>
          <View style={styles.menuItemLeft}>
            <Text style={styles.menuIcon}>🔔</Text>
            <Text style={styles.menuText}>Alert preferences</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={() => setEmergencyContactsVisible(true)}>
          <View style={styles.menuItemLeft}>
            <Text style={styles.menuIcon}>📞</Text>
            <Text style={styles.menuText}>Emergency contacts</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Amenities')}>
          <View style={styles.menuItemLeft}>
            <Text style={styles.menuIcon}>🏊‍♂️</Text>
            <Text style={styles.menuText}>Amenities</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={() => setDuressVisible(true)}>
          <View style={styles.menuItemLeft}>
            <Text style={styles.menuIcon}>🛡️</Text>
            <Text style={styles.menuText}>Duress / emergency</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutIcon}>🚪</Text>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

    </ScrollView>

    {/* Alert Preferences Modal */}
    <Modal visible={alertsVisible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeaderRow}>
          <Text style={styles.modalTitleSmall}>Alert Preferences</Text>
          <TouchableOpacity onPress={() => setAlertsVisible(false)}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalContentScroll}>
          <View style={styles.prefRow}>
            <View>
              <Text style={styles.prefTitle}>Push Notifications</Text>
              <Text style={styles.prefDesc}>Receive entry and exit alerts on your phone lock screen.</Text>
            </View>
            <View style={[styles.toggleSwitch, { backgroundColor: alertPreferences?.pushEnabled ? colors.success : colors.border }]}>
              <TouchableOpacity onPress={() => updateAlertPreferences({ pushEnabled: !alertPreferences?.pushEnabled })} style={[styles.toggleThumb, alertPreferences?.pushEnabled && styles.toggleThumbActive]} />
            </View>
          </View>
          <View style={styles.prefRow}>
            <View>
              <Text style={styles.prefTitle}>SMS Fallback</Text>
              <Text style={styles.prefDesc}>Get an SMS if you don't respond to a push notification.</Text>
            </View>
            <View style={[styles.toggleSwitch, { backgroundColor: alertPreferences?.smsEnabled ? colors.success : colors.border }]}>
              <TouchableOpacity onPress={() => updateAlertPreferences({ smsEnabled: !alertPreferences?.smsEnabled })} style={[styles.toggleThumb, alertPreferences?.smsEnabled && styles.toggleThumbActive]} />
            </View>
          </View>
          <View style={styles.prefRow}>
            <View>
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
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalContentScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.prefDesc}>These contacts will be notified automatically if you trigger an SOS.</Text>
          
          {emergencyContacts.length === 0 ? (
            <Text style={{ marginTop: 20, color: colors.textMuted }}>No emergency contacts added yet.</Text>
          ) : (
            emergencyContacts.map(contact => (
              <View key={contact.id} style={styles.contactCard}>
                <Text style={styles.contactIcon}>👤</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name} ({contact.relation})</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </View>
                <TouchableOpacity onPress={() => removeEmergencyContact(contact.id)}>
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          
          {isAddingContact ? (
            <View style={{ marginTop: 20 }}>
              <TextInput style={styles.input} placeholder="Contact Name" value={newContactName} onChangeText={setNewContactName} />
              <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="Phone Number" value={newContactPhone} onChangeText={setNewContactPhone} keyboardType="phone-pad" />
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <TouchableOpacity style={[styles.addButton, { flex: 1, marginRight: 5 }]} onPress={() => {
                  if(newContactName && newContactPhone) {
                    addEmergencyContact({ id: Math.random().toString(), name: newContactName, phone: newContactPhone, relation: 'Family' });
                    setIsAddingContact(false);
                    setNewContactName('');
                    setNewContactPhone('');
                  }
                }}>
                  <Text style={styles.addButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addButton, { flex: 1, marginLeft: 5, backgroundColor: colors.border }]} onPress={() => setIsAddingContact(false)}>
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
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        
        <View style={styles.modalContent}>
          <Text style={styles.shieldIcon}>🛡️</Text>
          <Text style={styles.modalTitle}>Emergency alert</Text>
          <Text style={styles.modalSubtitle}>
            Press the button below to silently alert the security guard and property management. No sound will play on your device.
          </Text>
          
          <TouchableOpacity style={styles.emergencyButton} onPress={() => { alert('Emergency alert sent!'); setDuressVisible(false); }}>
            <Text style={styles.emergencyButtonText}>⚠️ Send silent alert</Text>
          </TouchableOpacity>

          <Text style={styles.emergencyInfoText}>
            For immediate danger, call emergency services
          </Text>
          <Text style={styles.emergencyNumbers}>
            <Text style={{fontWeight: 'bold'}}>100</Text> (Police) • <Text style={{fontWeight: 'bold'}}>112</Text> (Emergency)
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingTop: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  phone: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 8,
  },
  flatText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  menuContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: colors.text,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: colors.dangerLight,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  /* Modal Styles */
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  closeButton: {
    padding: 16,
    alignItems: 'flex-end',
  },
  closeIcon: {
    fontSize: 24,
    color: colors.textMuted,
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  shieldIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  emergencyButton: {
    backgroundColor: colors.danger,
    width: '100%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  emergencyButtonText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  emergencyInfoText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  emergencyNumbers: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalContentScroll: {
    padding: 20,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  prefDesc: {
    fontSize: 14,
    color: colors.textMuted,
    maxWidth: '85%',
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 16,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  contactPhone: {
    fontSize: 14,
    color: colors.textMuted,
  },
  removeIcon: {
    fontSize: 16,
    color: colors.danger,
    padding: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 8,
  },
  addButton: {
    padding: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
