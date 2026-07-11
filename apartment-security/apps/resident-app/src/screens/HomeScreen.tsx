import { usePasses, useAlerts, useHousehold, useEntries } from '../context/DomainContexts';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { passes } = usePasses();
  const { alerts } = useAlerts();
  const { emergencyContacts } = useHousehold();
  const { userProfile, userEmail, userRole } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  const activePasses = passes.filter(p => p.status === 'Active');
  const upcomingPasses = passes.filter(p => (p.status as any) === 'Scheduled');
  const unreadAlerts = alerts.filter(a => a.unread);
  const [activeAction, setActiveAction] = React.useState('Create Visitor Pass'); // ponytail: dynamic highlight

  const navigateTo = (screen: string) => {
    navigation.navigate(screen);
  };

  const isManager = userRole === 'MANAGER' || userRole === 'COMMITTEE';
  const name = userProfile?.name ? userProfile.name.split(' ')[0] : (isManager ? 'Manager' : 'Resident');
  const subtitle = isManager ? 'PROPERTY DASHBOARD' : `${userProfile?.wing || 'Unknown Block'} · FLAT ${userProfile?.flat || 'N/A'}`;

  const handleSOS = () => {
    let message = "🚨 SOS ALARM SENT!\nGuard station has been instantly notified.";
    if (emergencyContacts && emergencyContacts.length > 0) {
      const names = emergencyContacts.map(c => c.name).join(', ');
      message += `\n\nSMS alerts sent to:\n${names}`;
    }
    alert(message);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* App Header */}
        <View style={styles.appHeader}>
          <View>
            <Text style={styles.apartmentText}>{subtitle}</Text>
            <Text style={styles.greetingText}>Welcome, {name}</Text>
          </View>
          <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
            <Ionicons name="alert-outline" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* 2x2 Grid */}
        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.topGridCard} onPress={() => navigateTo('Entries')}>
            <View style={[styles.topGridIconWrapper, { backgroundColor: isDarkMode ? '#452a0a' : '#fef3c7' }]}>
              <Ionicons name="person-add-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.gridNumber}>3</Text>
            <Text style={styles.topGridLabel}>Visitors Today</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.topGridCard} onPress={() => navigation.navigate('Passes', { initialTab: 'Active' })}>
            <View style={[styles.topGridIconWrapper, { backgroundColor: isDarkMode ? '#262626' : '#e5e7eb' }]}>
              <Ionicons name="ticket-outline" size={24} color={colors.textMuted} />
            </View>
            <Text style={styles.gridNumber}>{activePasses.length}</Text>
            <Text style={styles.topGridLabel}>Active Passes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.topGridCard} onPress={() => navigateTo('Alerts')}>
            <View style={[styles.topGridIconWrapper, { backgroundColor: isDarkMode ? '#450a0a' : '#fee2e2' }]}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
            </View>
            <View style={styles.numberRow}>
              <Text style={styles.gridNumber}>{unreadAlerts.length}</Text>
              {unreadAlerts.length > 0 && <View style={styles.redDot} />}
            </View>
            <Text style={styles.topGridLabel}>Alerts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.topGridCard} onPress={() => navigation.navigate('Passes', { initialTab: 'Scheduled' })}>
            <View style={[styles.topGridIconWrapper, { backgroundColor: isDarkMode ? '#452a0a' : '#fef3c7' }]}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.gridNumber}>{upcomingPasses.length}</Text>
            <Text style={styles.topGridLabel}>Upcoming</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.actionsContainer}>
          {[
            { id: 'Create Visitor Pass', icon: 'person-add-outline', screen: 'CreatePass' },
            { id: 'Invite Delivery', icon: 'bus-outline', screen: 'CreatePass', params: { initialType: 'Delivery / service' } },
            { id: 'Add Domestic Worker', icon: 'body-outline', screen: 'Household' },
            { id: 'View Entry Log', icon: 'time-outline', screen: 'Entries' },
          ].map(action => {
            const isActive = activeAction === action.id;
            return (
              <TouchableOpacity 
                key={action.id}
                style={[styles.actionCard, isActive && { backgroundColor: colors.primary }]} 
                onPress={() => { 
                  setActiveAction(action.id); 
                  if (action.params) navigation.navigate(action.screen, action.params); 
                  else navigateTo(action.screen); 
                }}
              >
                <View style={[styles.actionIconWrapper, isActive && { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                  <Ionicons name={action.icon as any} size={20} color={isActive ? (isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)') : colors.text} />
                </View>
                <Text style={[styles.actionCardText, isActive && { color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }]}>{action.id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Activity */}
        <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigateTo('Entries')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentActivityContainer}>
          {useEntries().entries.slice(0, 3).map((entry, index) => {
            const isEntered = entry.status === 'ENTERED';
            return (
              <TouchableOpacity key={index} style={styles.activityCard}>
                <View style={[styles.activityIconWrapper, { backgroundColor: isEntered ? (isDarkMode ? '#452a0a' : '#fef3c7') : (isDarkMode ? '#262626' : '#e5e7eb') }]}>
                  <Ionicons name={isEntered ? "log-in-outline" : "log-out-outline"} size={24} color={isEntered ? colors.primary : colors.textMuted} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityName}>{entry.name}</Text>
                  <Text style={styles.activityAction}>{isEntered ? 'Entered' : 'Exited'} via {entry.gate || 'Main Gate'}</Text>
                </View>
                <Text style={styles.activityTime}>{entry.time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* More */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>More</Text>
        </View>

        <View style={styles.moreGridContainer}>
          <TouchableOpacity style={styles.moreGridCard} onPress={() => navigateTo('Household')}>
            <View style={styles.moreGridIconWrapper}>
              <Ionicons name="people-outline" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.moreGridLabel}>Workers</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.moreGridCard} onPress={() => navigateTo('Household')}>
            <View style={styles.moreGridIconWrapper}>
              <Ionicons name="home-outline" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.moreGridLabel}>Household</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.moreGridCard} onPress={() => navigateTo('Amenities')}>
            <View style={styles.moreGridIconWrapper}>
              <Ionicons name="business-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.moreGridLabel}>Amenities</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.moreGridCard, { backgroundColor: isDarkMode ? '#4a1111' : '#f5d3d3', borderColor: 'transparent' }]} onPress={handleSOS}>
            <View style={[styles.moreGridIconWrapper, { backgroundColor: 'transparent' }]}>
              <Ionicons name="alert-circle-outline" size={20} color="#c92a2a" />
            </View>
            <Text style={[styles.moreGridLabel, { color: '#c92a2a' }]}>Emergency</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  appHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xl,
  },
  apartmentText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
  },
  sosButton: {
    backgroundColor: isDarkMode ? '#2c0c0c' : colors.dangerLight,
    padding: spacing.sm,
    borderRadius: roundness.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  gridContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.xl,
  },
  topGridCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: roundness.xl,
    padding: spacing.lg,
    marginBottom: 16,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
  },
  topGridIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: roundness.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
  },
  numberRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  gridNumber: {
    fontSize: 32,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
    marginBottom: 4,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginLeft: 8,
    marginTop: 4,
  },
  topGridLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  actionsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: roundness.lg,
    padding: spacing.md,
    marginBottom: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
  },
  actionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: roundness.md,
    backgroundColor: isDarkMode ? '#262626' : '#e5e7eb',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.sm,
  },
  actionCardText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  viewAllText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  recentActivityContainer: {
    marginBottom: spacing.xxl,
  },
  activityCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    padding: spacing.lg,
    borderRadius: roundness.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
  },
  activityIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: roundness.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  activityAction: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  activityTime: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  moreGridContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    gap: 16,
  },
  moreGridCard: {
    width: '47%',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    borderRadius: roundness.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
  },
  moreGridIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: roundness.md,
    backgroundColor: isDarkMode ? '#262626' : '#e6dfd1',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.sm,
  },
  moreGridLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
});
