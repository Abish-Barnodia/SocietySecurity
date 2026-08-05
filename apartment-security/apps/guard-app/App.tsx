import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth, configureApi, LoginScreen } from '@apartment-security/shared-auth';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import GuardDetailsScreen from './src/screens/GuardDetailsScreen';
import GuardShell from './src/screens/GuardShell';
import { API_URL } from './src/utils/api';
import tokenStorage from './src/utils/tokenStorage';

// Configure shared API
configureApi(
  API_URL,
  async () => tokenStorage.getItemAsync('guardToken'),
  async () => {
    await tokenStorage.deleteItemAsync('guardToken');
    await tokenStorage.deleteItemAsync('guardRefreshToken');
  }
);

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
    return <LoginScreen appTitle="GUARD ACCESS" allowSignup={false} />;
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
          <AuthProvider allowedRoles={['GUARD', 'MANAGER', 'ADMIN']} tokenKey="guardToken" refreshTokenKey="guardRefreshToken">
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
