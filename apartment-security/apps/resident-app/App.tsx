import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, configureApi, useAuth } from '@apartment-security/shared-auth';
import { SocketProvider } from './src/context/SocketContext';
import { DataProvider } from './src/context/DataContext';
import { CommunityProvider } from './src/context/CommunityContext';
import { ComplaintsProvider } from './src/context/ComplaintsContext';
import { DomesticWorkersProvider } from './src/context/DomesticWorkersContext';
import { EventsProvider } from './src/context/EventsContext';
import { MaintenanceProvider } from './src/context/MaintenanceContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { registerForPushNotificationsAsync, registerBackgroundNotificationTask, addVisitorNotificationResponseListener } from './src/utils/notifications';
import api, { API_URL } from './src/utils/api';
import tokenStorage from './src/utils/tokenStorage';

// Configure shared API
configureApi(
  API_URL,
  async () => tokenStorage.getItemAsync('userToken'),
  async () => {
    await tokenStorage.deleteItemAsync('userToken');
    await tokenStorage.deleteItemAsync('userRefreshToken');
  }
);
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
    registerBackgroundNotificationTask().catch(error => console.log('Background task registration skipped:', error));

    let removeListener: (() => void) | undefined;
    addVisitorNotificationResponseListener().then(remove => { removeListener = remove; });
    return () => removeListener?.();
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
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onStateChange={(state) => {
        const route = state?.routes[state?.index ?? 0];
        console.log(`📱 [Resident App Navigation] Opened -> ${route?.name}`);
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider allowedRoles={['RESIDENT', 'GUARD']} tokenKey="userToken" refreshTokenKey="userRefreshToken">
            <SocketProvider>
              <DataProvider>
                <CommunityProvider>
                  <ComplaintsProvider>
                    <DomesticWorkersProvider>
                      <EventsProvider>
                        <MaintenanceProvider>
                          <ThemedApp />
                        </MaintenanceProvider>
                      </EventsProvider>
                    </DomesticWorkersProvider>
                  </ComplaintsProvider>
                </CommunityProvider>
              </DataProvider>
            </SocketProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
