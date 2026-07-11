import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AppDomainProvider } from './src/context/DomainContexts';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

const AppContent = () => {
  const { isDarkMode, colors } = useTheme();
  
  const navTheme = isDarkMode ? DarkTheme : DefaultTheme;
  const customNavTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    }
  };

  return (
    <NavigationContainer theme={customNavTheme}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <AppNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  useEffect(() => {
    // registerForPushNotificationsAsync().then(token => console.log('Push token:', token));
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppDomainProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </AppDomainProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
