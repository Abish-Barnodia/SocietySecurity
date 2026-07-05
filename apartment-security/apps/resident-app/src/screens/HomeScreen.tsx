import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Modal, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { useData } from '../context/DataContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

type ServiceProfile = {
  id: string;
  role: string;
  name: string;
  phone: string;
  charges: string;
  rating: string;
  experience: string;
  emoji: string;
  color: string;
};

const SERVICES: ServiceProfile[] = [
  { id: '1', role: 'Plumber', name: 'Ramesh Kumar', phone: '+91 98765 43210', charges: '₹300 / visit', rating: '4.8', experience: '8 yrs', emoji: '🪠', color: '#e0f2fe' },
  { id: '2', role: 'Electrician', name: 'Suresh Singh', phone: '+91 98765 43211', charges: '₹250 / visit', rating: '4.9', experience: '12 yrs', emoji: '⚡', color: '#fef3c7' },
  { id: '3', role: 'Carpenter', name: 'Abdul Ansari', phone: '+91 98765 43212', charges: '₹400 / visit', rating: '4.7', experience: '15 yrs', emoji: '🔨', color: '#ffedd5' },
  { id: '4', role: 'Painter', name: 'Manoj Das', phone: '+91 98765 43213', charges: 'Based on area', rating: '4.6', experience: '5 yrs', emoji: '🎨', color: '#f3e8ff' },
];

import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { passes, alerts, emergencyContacts } = useData();
  const { userProfile, userEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedService, setSelectedService] = React.useState<ServiceProfile | null>(null);

  const activePasses = passes.filter(p => p.status === 'Active').slice(0, 2);

  const navigateTo = (screen: string) => {
    navigation.navigate(screen);
  };

  // Fallback to defaults if no profile exists
  const name = userProfile?.name ? userProfile.name.split(' ')[0] : 'Resident';
  const initial = (userProfile?.name || 'Resident').charAt(0).toUpperCase();

  const handleSOS = () => {
    let message = "🚨 SOS ALARM SENT!\nGuard station has been instantly notified.";
    if (emergencyContacts && emergencyContacts.length > 0) {
      const names = emergencyContacts.map(c => c.name).join(', ');
      message += `\n\nSMS alerts sent to:\n${names}`;
    }
    alert(message);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 50 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* App Header */}
        <View style={styles.appHeader}>
          <View>
            <Text style={styles.greetingText}>Hello, {name}</Text>
            {userProfile?.wing && userProfile?.flat ? (
              <Text style={styles.apartmentText}>Block {userProfile.wing} • Flat {userProfile.flat}</Text>
            ) : (
              <Text style={styles.apartmentText}>{userEmail}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.sosButton}
              onPress={handleSOS}
            >
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
            <View style={[styles.profileAvatar, { overflow: 'hidden' }]}>
              {userProfile?.photoUri ? (
                <Image source={{ uri: userProfile.photoUri }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.profileAvatarText}>{initial}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionItem} onPress={() => navigateTo('CreatePass')}>
            <View style={styles.iconContainer}>
              <Text style={styles.actionEmoji}>📝</Text>
            </View>
            <Text style={styles.actionText}>New Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => navigateTo('Household')}>
            <View style={[styles.iconContainer, { backgroundColor: '#fdf4ff' }]}>
              <Text style={styles.actionEmoji}>👨‍👩‍👧</Text>
            </View>
            <Text style={styles.actionText}>Household</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => navigateTo('Amenities')}>
            <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
              <Text style={styles.actionEmoji}>🎉</Text>
            </View>
            <Text style={styles.actionText}>Amenities</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => navigateTo('Entries')}>
            <View style={[styles.iconContainer, { backgroundColor: '#ecfccb' }]}>
              <Text style={styles.actionEmoji}>📜</Text>
            </View>
            <Text style={styles.actionText}>Entry Log</Text>
          </TouchableOpacity>
        </View>

        {/* Home Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Home Services</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesContainer} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {SERVICES.map((service) => (
            <TouchableOpacity 
              key={service.id} 
              style={styles.serviceCard} 
              onPress={() => setSelectedService(service)}
            >
              <View style={[styles.serviceIconWrapper, { backgroundColor: service.color }]}>
                <Text style={styles.serviceEmoji}>{service.emoji}</Text>
              </View>
              <Text style={styles.serviceText}>{service.role}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Active Passes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active passes</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Passes')}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {activePasses.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>No active passes.</Text>
          </View>
        ) : (
          activePasses.map(pass => (
            <View key={pass.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>{pass.name}</Text>
                  <Text style={styles.cardSubtitle}>{pass.type}</Text>
                </View>
                <View style={[styles.badgeSuccess, { backgroundColor: pass.color + '20' }]}>
                  <Text style={[styles.badgeSuccessText, { color: pass.color }]}>• Active</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.cardFooter} onPress={() => navigation.navigate('PassDetail', { passId: pass.id })}>
                <Text style={styles.cardFooterText}>⏱ {pass.time}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Recent Alerts */}
        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Recent alerts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Alerts')}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {alerts.length === 0 ? (
          <View style={styles.card}>
            <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 8 }}>No recent alerts.</Text>
          </View>
        ) : (
          alerts.slice(0, 2).map((alert) => (
            <View key={alert.id} style={styles.card}>
              <View style={styles.alertRow}>
                <Text style={styles.alertEmoji}>{alert.icon}</Text>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertSubtitle}>{alert.subtitle}</Text>
                  <Text style={styles.alertTime}>{alert.time}</Text>
                </View>
                {alert.unread && <View style={styles.unreadDot} />}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Service Info Modal */}
      <Modal visible={!!selectedService} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.serviceModalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedService(null)}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>

            {selectedService && (
              <>
                <View style={[styles.largeServiceIcon, { backgroundColor: selectedService.color }]}>
                  <Text style={styles.largeServiceEmoji}>{selectedService.emoji}</Text>
                </View>
                <Text style={styles.serviceModalTitle}>{selectedService.role}</Text>
                <Text style={styles.serviceModalName}>{selectedService.name}</Text>

                <View style={styles.serviceInfoGrid}>
                  <View style={styles.serviceInfoItem}>
                    <Text style={styles.serviceInfoLabel}>Rating</Text>
                    <Text style={styles.serviceInfoValue}>⭐ {selectedService.rating}</Text>
                  </View>
                  <View style={styles.serviceInfoItem}>
                    <Text style={styles.serviceInfoLabel}>Experience</Text>
                    <Text style={styles.serviceInfoValue}>{selectedService.experience}</Text>
                  </View>
                  <View style={styles.serviceInfoItem}>
                    <Text style={styles.serviceInfoLabel}>Est. Charges</Text>
                    <Text style={styles.serviceInfoValue}>{selectedService.charges}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.callButton} 
                  onPress={() => Linking.openURL(`tel:${selectedService.phone}`)}
                >
                  <Text style={styles.callButtonText}>📞 Call {selectedService.name}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 400, // Extra space to force scrolling on Android
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 44, // increased from 32
    paddingHorizontal: 4,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  apartmentText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  profileAvatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  sosButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 16,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  sosText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 44, // Increased spacing
    paddingHorizontal: 4,
  },
  actionItem: {
    alignItems: 'center',
    width: '24%',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionEmoji: {
    fontSize: 28,
  },
  actionText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
    textAlign: 'center',
  },
  servicesContainer: {
    marginBottom: 32,
    marginTop: 8,
  },
  serviceCard: {
    alignItems: 'center',
    marginRight: 24,
    width: 72,
  },
  serviceIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceEmoji: {
    fontSize: 28,
  },
  serviceText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  seeAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  badgeSuccess: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccessText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooterText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
    lineHeight: 20,
  },
  alertTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  serviceModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  largeServiceIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 16,
  },
  largeServiceEmoji: {
    fontSize: 48,
  },
  serviceModalTitle: {
    fontSize: 16,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  serviceModalName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 32,
  },
  serviceInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  serviceInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  serviceInfoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '500',
  },
  serviceInfoValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '700',
  },
  callButton: {
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
