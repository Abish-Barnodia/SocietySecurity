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
import AppNavigator from './src/navigation/AppNavigator';
import { registerForPushNotificationsAsync } from './src/utils/notifications';

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const baseNavTheme = isDark ? DarkTheme : DefaultTheme;

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
  useEffect(() => {
    registerForPushNotificationsAsync()
      .then(token => {
        if (token) console.log('Push token:', token);
      })
      .catch(error => console.log('Push registration skipped:', error));
  }, []);

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
