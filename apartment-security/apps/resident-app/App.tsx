import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { CommunityProvider } from './src/context/CommunityContext';
import { ComplaintsProvider } from './src/context/ComplaintsContext';
import { DomesticWorkersProvider } from './src/context/DomesticWorkersContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import api from './src/utils/api';

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const baseNavTheme = isDark ? DarkTheme : DefaultTheme;

  // Only registerable once logged in — /auth/fcm-token requires auth, and
  // this token was previously generated and just console.logged, so push
  // notifications (as opposed to local, foreground-only ones) never actually
  // reached any device.
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotificationsAsync()
      .then(token => {
        if (token) api.post('/auth/fcm-token', { token }).catch(() => {});
      })
      .catch(error => console.log('Push registration skipped:', error));
  }, [isAuthenticated]);

  const navigationTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <CommunityProvider>
              <ComplaintsProvider>
                <DomesticWorkersProvider>
                  <ThemedApp />
                </DomesticWorkersProvider>
              </ComplaintsProvider>
            </CommunityProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
