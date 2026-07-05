import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

// Screens
import OTPLoginScreen from '../screens/OTPLoginScreen';
import VerifyOTPScreen from '../screens/VerifyOTPScreen';
import HomeScreen from '../screens/HomeScreen';
import PassesScreen from '../screens/PassesScreen';
import EntriesScreen from '../screens/EntriesScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CreatePassScreen from '../screens/CreatePassScreen';
import PassDetailScreen from '../screens/PassDetailScreen';
import HouseholdScreen from '../screens/HouseholdScreen';
import AmenitiesScreen from '../screens/AmenitiesScreen';
import WalkInApprovalScreen from '../screens/WalkInApprovalScreen';
import GuardHomeScreen from '../screens/GuardHomeScreen';
import ResidentOnboardingScreen from '../screens/ResidentOnboardingScreen';
import ScanPassScreen from '../screens/ScanPassScreen';

export type RootStackParamList = {
  OTPLogin: undefined;
  VerifyOTP: { phone: string };
  MainTabs: undefined;
  GuardTabs: undefined;
  ResidentOnboarding: undefined;
  CreatePass: undefined;
  PassDetail: { passId: string };
  Household: undefined;
  Amenities: undefined;
  WalkInApproval: { requestId: string } | undefined;
  ScanPass: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const GuardTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'shield-checkmark';
          if (route.name === 'Dashboard') iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60 },
      })}
    >
      <Tab.Screen name="Dashboard" component={GuardHomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

import { useData } from '../context/DataContext';

const MainTabs = () => {
  const { alerts } = useData();
  const unreadCount = alerts.filter(a => a.unread).length;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Passes') iconName = focused ? 'ticket' : 'ticket-outline';
          else if (route.name === 'Entries') iconName = focused ? 'document-text' : 'document-text-outline';
          else if (route.name === 'Alerts') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Passes" component={PassesScreen} />
      <Tab.Screen name="Entries" component={EntriesScreen} />
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
  const { isAuthenticated, userRole, isOnboarded } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="OTPLogin" component={OTPLoginScreen} />
          <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
        </>
      ) : userRole === 'GUARD' ? (
        <>
          <Stack.Screen name="GuardTabs" component={GuardTabs} />
          <Stack.Screen name="ScanPass" component={ScanPassScreen} options={{ headerShown: true, title: 'Scan Pass' }} />
        </>
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
        </>
      )}
    </Stack.Navigator>
  );
}
