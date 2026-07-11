import { useAlerts } from '../context/DomainContexts';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { LoginRoutes } from '../login';

// Screens
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
import ScanPassScreen from '../screens/ScanPassScreen';
import CommunityScreen from '../community/screens/CommunityScreen';

export type RootStackParamList = {
  LoginFlow: undefined;
  MainTabs: undefined;
  GuardTabs: undefined;
  CreatePass: { initialType?: string } | undefined;
  PassDetail: { passId: string };
  Household: undefined;
  Amenities: undefined;
  WalkInApproval: { requestId: string } | undefined;
  ScanPass: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const GuardTabs = () => {
  const { colors, isDarkMode } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'shield-checkmark';
          if (route.name === 'Dashboard') iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
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
          backgroundColor: isDarkMode ? '#0a0a0a' : '#ffffff',
          borderTopColor: colors.border
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={GuardHomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};


const MainTabs = () => {
  const { alerts } = useAlerts();
  const { colors, isDarkMode } = useTheme();
  const unreadCount = alerts.filter(a => a.unread).length;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Passes') iconName = focused ? 'ticket' : 'ticket-outline';
          else if (route.name === 'Entries') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Community') iconName = focused ? 'people' : 'people-outline';
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
          backgroundColor: isDarkMode ? '#0a0a0a' : '#ffffff',
          borderTopColor: colors.border
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Passes" component={PassesScreen} />
      <Tab.Screen name="Entries" component={EntriesScreen} options={{ title: 'Entry Log' }} />
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
  const { isAuthenticated, userRole } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="LoginFlow" component={LoginRoutes} />
      ) : userRole === 'GUARD' ? (
        <>
          <Stack.Screen name="GuardTabs" component={GuardTabs} />
          <Stack.Screen name="ScanPass" component={ScanPassScreen} options={{ headerShown: true, title: 'Scan Pass' }} />
        </>
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
