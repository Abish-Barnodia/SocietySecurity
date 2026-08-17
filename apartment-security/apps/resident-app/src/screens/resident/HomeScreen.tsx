import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '@apartment-security/shared-auth';

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { passes, alerts, entries, members, triggerDuressAlert } = useData();
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const [emergencyOpen, setEmergencyOpen] = React.useState(false);
  const [sendingSOS, setSendingSOS] = React.useState(false);

  const activePassesCount = passes.filter(p => p.status === 'Active').length;
  const unreadAlertsCount = alerts.filter(a => a.unread).length;
  const entriesTodayCount = entries.filter(e => e.date === 'TODAY').length;
  const householdSize = members.length + 1; // +1 for the primary resident, who isn't in `members`
  const recentActivity = entries.slice(0, 3);

  const navigateTo = (screen: string) => {
    navigation.navigate(screen);
  };

  // Fallback to defaults if no profile exists
  const name = userProfile?.name ? userProfile.name.split(' ')[0] : 'Resident';

  const handleSOS = () => {
    Alert.alert(
      'Send SOS alert?',
      'This will immediately notify the guard station and property management.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSendingSOS(true);
            try {
              await triggerDuressAlert();
              Alert.alert('SOS alarm sent', 'Guard station has been notified.');
            } catch {
              Alert.alert('Error', 'Failed to send the SOS alert. Please try again or call for help directly.');
            } finally {
              setSendingSOS(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* App Header */}
        <View style={styles.appHeader}>
          <View>
            {userProfile?.wing && userProfile?.flat ? (
              <Text style={styles.apartmentText}>TOWER {userProfile.wing} • FLAT {userProfile.flat}</Text>
            ) : null}
            <Text style={styles.greetingText}>Welcome, {name}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.sosButton}
              onPress={handleSOS}
              disabled={sendingSOS}
            >
              <Ionicons name="warning" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="walk" size={20} color={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{entriesTodayCount}</Text>
            <Text style={styles.statLabel}>Visitors Today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="qr-code" size={20} color="#0369A1" />
            </View>
            <Text style={styles.statNumber}>{activePassesCount}</Text>
            <Text style={styles.statLabel}>Active Passes</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.dangerLight }]}>
              <Ionicons name="notifications" size={20} color={colors.danger} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.statNumber}>{unreadAlertsCount}</Text>
              {unreadAlertsCount > 0 ? <View style={styles.redDot} /> : null}
            </View>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="people" size={20} color={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{householdSize}</Text>
            <Text style={styles.statLabel}>Household</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => navigateTo('CreatePass')}>
            <View style={styles.actionIconWrapDark}>
              <Ionicons name="person-add" size={20} color={colors.text} />
            </View>
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Create Visitor Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateTo('Entries')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="time" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.actionBtnText}>View Entry Log</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Entries')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {recentActivity.length === 0 ? (
          <View style={styles.activityCard}>
            <Text style={{ color: colors.textMuted }}>No recent activity yet.</Text>
          </View>
        ) : (
          recentActivity.map((item) => (
            <View key={item.id} style={styles.activityCard}>
              <View style={styles.activityIconWrap}>
                <Ionicons
                  name={item.status === 'Exited' ? 'exit' : 'enter'}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{item.name}</Text>
                <Text style={styles.activitySubtitle}>{item.status} via {item.gate || 'Main Gate'}</Text>
              </View>
              <Text style={styles.activityTime}>{item.time}</Text>
            </View>
          ))
        )}

        {/* More */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>More</Text>
        </View>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateTo('DomesticWorkers')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="hammer" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.actionBtnText}>Workers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateTo('Household')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="home" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.actionBtnText}>Household</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateTo('Amenities')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="business" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.actionBtnText}>Amenities</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateTo('Complaints')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="clipboard" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.actionBtnText}>Complaints</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateTo('Events')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="calendar" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.actionBtnText}>Events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateTo('Maintenance')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="receipt" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.actionBtnText}>Maintenance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtnFull, { backgroundColor: colors.dangerLight }]} onPress={() => setEmergencyOpen(true)}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="alert-circle" size={22} color={colors.danger} />
            </View>
            <Text style={[styles.actionBtnText, { color: colors.danger, flex: 0, marginLeft: 8 }]}>Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={emergencyOpen} transparent animationType="fade" onRequestClose={() => setEmergencyOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.emergencyModal}>
            <Text style={styles.emergencyTitle}>Emergency Contacts</Text>
            <TouchableOpacity style={styles.emergencyOption} onPress={() => { setEmergencyOpen(false); Linking.openURL('tel:100'); }}>
              <Ionicons name="shield" size={24} color="#1D4ED8" style={{ marginRight: 16 }} />
              <Text style={styles.emergencyOptionText}>Police</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyOption} onPress={() => { setEmergencyOpen(false); Linking.openURL('tel:102'); }}>
              <Ionicons name="medkit" size={24} color="#16A34A" style={{ marginRight: 16 }} />
              <Text style={styles.emergencyOptionText}>Ambulance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyOption} onPress={() => { setEmergencyOpen(false); Linking.openURL('tel:101'); }}>
              <Ionicons name="flame" size={24} color="#EA580C" style={{ marginRight: 16 }} />
              <Text style={styles.emergencyOptionText}>Fire Brigade</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emergencyOption, { borderBottomWidth: 0 }]} onPress={() => { setEmergencyOpen(false); handleSOS(); }}>
              <Text style={styles.emergencyOptionEmoji}>🛡️</Text>
              <Text style={styles.emergencyOptionText}>Security Guard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setEmergencyOpen(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  apartmentText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  sosButton: {
    backgroundColor: colors.dangerLight,
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: {
    color: colors.danger,
    fontSize: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statEmoji: {
    fontSize: 20,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginLeft: 4,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  seeAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionBtn: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconWrap: {
    marginRight: 12,
  },
  actionIconWrapDark: {
    marginRight: 12,
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  actionBtnFull: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyModal: {
    width: '85%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 20,
  },
  emergencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emergencyOptionEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  emergencyOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  closeBtn: {
    marginTop: 20,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityEmoji: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  activityTime: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
