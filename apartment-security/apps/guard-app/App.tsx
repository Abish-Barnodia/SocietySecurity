import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import LoginScreen from './src/screens/LoginScreen';
import GuardDetailsScreen from './src/screens/GuardDetailsScreen';
import GuardShell from './src/screens/GuardShell';

function Root() {
  const { isAuthenticated, isLoading, guardProfile } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F2A900" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!guardProfile?.isOnDuty) {
    return <GuardDetailsScreen />;
  }

  return <GuardShell />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0B0E11',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
