import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, LoginScreen } from '@apartment-security/shared-auth';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Auth Screens
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Resident Screens
import HomeScreen from '../screens/resident/HomeScreen';
import PassesScreen from '../screens/resident/PassesScreen';
import EntriesScreen from '../screens/resident/EntriesScreen';
import CommunityScreen from '../screens/resident/CommunityScreen';
import CreatePassScreen from '../screens/resident/CreatePassScreen';
import PassDetailScreen from '../screens/resident/PassDetailScreen';
import HouseholdScreen from '../screens/resident/HouseholdScreen';
import AmenitiesScreen from '../screens/resident/AmenitiesScreen';
import WalkInApprovalScreen from '../screens/resident/WalkInApprovalScreen';
import ResidentOnboardingScreen from '../screens/resident/ResidentOnboardingScreen';
import SecuritySettingsScreen from '../screens/resident/SecuritySettingsScreen';
import PrivacyScreen from '../screens/resident/PrivacyScreen';
import HelpSupportScreen from '../screens/resident/HelpSupportScreen';
import ComplaintsScreen from '../screens/resident/ComplaintsScreen';
import ComplaintDetailScreen from '../screens/resident/ComplaintDetailScreen';
import CreateComplaintScreen from '../screens/resident/CreateComplaintScreen';
import DomesticWorkersScreen from '../screens/resident/DomesticWorkersScreen';
import WorkerFormScreen from '../screens/resident/WorkerFormScreen';
import EventsScreen from '../screens/resident/EventsScreen';
import MaintenanceScreen from '../screens/resident/MaintenanceScreen';

// Shared Screens
import AlertsScreen from '../screens/shared/AlertsScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationSettingsScreen from '../screens/shared/NotificationSettingsScreen';

// Guard Screens
import GuardShell from '../screens/guard/GuardShell';
import ScanPassScreen from '../screens/guard/ScanScreen';
import GuardDetailsScreen from '../screens/guard/GuardDetailsScreen';

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;
  GuardTabs: undefined;
  ResidentOnboarding: undefined;
  CreatePass: undefined;
  PassDetail: { passId: string };
  Household: undefined;
  Amenities: undefined;
  WalkInApproval: { requestId: string } | undefined;
  ScanPass: undefined;
  NotificationSettings: undefined;
  SecuritySettings: undefined;
  Privacy: undefined;
  HelpSupport: undefined;
  Complaints: undefined;
  ComplaintDetail: { complaintId: string };
  CreateComplaint: undefined;
  DomesticWorkers: undefined;
  WorkerForm: { workerId?: string };
  Events: undefined;
  Maintenance: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();



import { useData } from '../context/DataContext';

const MainTabs = () => {
  const { alerts } = useData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const unreadCount = alerts.filter(a => a.unread).length;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Passes') iconName = focused ? 'ticket' : 'ticket-outline';
          else if (route.name === 'Entries') iconName = focused ? 'document-text' : 'document-text-outline';
          else if (route.name === 'Community') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Alerts') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom, 5),
          paddingTop: 5,
          height: 55 + Math.max(insets.bottom, 5),
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Passes" component={PassesScreen} />
      <Tab.Screen name="Entries" component={EntriesScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen} 
        options={{ tabBarBadge: unreadCount > 0 ? unreadCount : undefined }} 
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default function AppNavigator() {
  const { isAuthenticated, isLoading, userRole, isOnboarded, guardProfile } = useAuth();
  // Session-only — resets on next login. GuardDetailsScreen's "Start Duty"
  // flips guardProfile.isOnDuty via refreshProfile(), which re-evaluates this
  // check on its own; Skip is the only other way out of the prompt.
  const [guardOnboardingSkipped, setGuardOnboardingSkipped] = useState(false);

  // While bootstrapAsync() is still validating a stored token against
  // /auth/me, isAuthenticated is momentarily false — rendering nothing here
  // (instead of falling into the !isAuthenticated branch below) avoids a
  // flash of the Login screen on every cold start with a valid session.
  if (isLoading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Group screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} appTitle="SOCIETY SECURITY" allowSignup={false} onForgotPassword={() => props.navigation.navigate('ForgotPassword')} />}
          </Stack.Screen>
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ presentation: 'modal' }} />
        </Stack.Group>
      ) : userRole === 'GUARD' ? (
        !guardProfile?.isOnDuty && !guardOnboardingSkipped ? (
          <Stack.Screen name="GuardTabs">
            {() => <GuardDetailsScreen onSkip={() => setGuardOnboardingSkipped(true)} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="GuardTabs" component={GuardShell} />
            <Stack.Screen name="ScanPass" component={ScanPassScreen} options={{ headerShown: true, title: 'Scan Pass' }} />
          </>
        )
      ) : !isOnboarded ? (
        <Stack.Screen name="ResidentOnboarding" component={ResidentOnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="CreatePass" component={CreatePassScreen} options={{ headerShown: true, title: 'Create pass' }} />
          <Stack.Screen name="PassDetail" component={PassDetailScreen} options={{ headerShown: true, title: 'Pass details' }} />
          <Stack.Screen name="Household" component={HouseholdScreen} options={{ headerShown: true, title: 'Household members' }} />
          <Stack.Screen name="Amenities" component={AmenitiesScreen} options={{ headerShown: true, title: 'Amenities' }} />
          <Stack.Screen name="WalkInApproval" component={WalkInApprovalScreen} options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: true, title: 'Notification Settings' }} />
          <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} options={{ headerShown: true, title: 'Security Settings' }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: true, title: 'Privacy' }} />
          <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ headerShown: true, title: 'Help & Support' }} />
          <Stack.Screen name="Complaints" component={ComplaintsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} options={{ headerShown: true, title: 'Complaint' }} />
          <Stack.Screen name="CreateComplaint" component={CreateComplaintScreen} options={{ headerShown: true, title: 'New Complaint' }} />
          <Stack.Screen name="DomesticWorkers" component={DomesticWorkersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="WorkerForm" component={WorkerFormScreen} options={{ headerShown: true, title: 'Worker' }} />
          <Stack.Screen name="Events" component={EventsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}
