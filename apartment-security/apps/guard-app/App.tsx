import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth, configureApi, LoginScreen } from '@apartment-security/shared-auth';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import GuardDetailsScreen from './src/screens/GuardDetailsScreen';
import GuardShell from './src/screens/GuardShell';
import { API_URL } from './src/utils/api';
import tokenStorage from './src/utils/tokenStorage';
import { connectSocket, disconnectSocket, getSocket } from './src/utils/socket';

// Set by Root once AuthProvider is mounted, so a 401 can force the app back
// to LoginScreen instead of leaving stale "authenticated" UI making doomed requests.
let handleUnauthorized: (() => void) | null = null;

// Configure shared API
configureApi(
  API_URL,
  async () => tokenStorage.getItemAsync('guardToken'),
  async () => {
    await tokenStorage.deleteItemAsync('guardToken');
    await tokenStorage.deleteItemAsync('guardRefreshToken');
    handleUnauthorized?.();
  }
);

function Root() {
  const { isAuthenticated, isLoading, guardProfile, logout } = useAuth();

  // Force UI back to LoginScreen on a 401 from anywhere in the app.
  useEffect(() => {
    handleUnauthorized = () => { logout(); };
    return () => { handleUnauthorized = null; };
  }, [logout]);

  // Realtime socket lifecycle: connect once authenticated, disconnect on logout/401.
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }
    let cancelled = false;
    tokenStorage.getItemAsync('guardToken').then((token) => {
      if (!cancelled && token) connectSocket(token);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // See resident-app's SocketContext for why: a backgrounded/locked phone can
  // silently drop the socket, and the default reconnect only notices after a
  // ping timeout — force a check the moment the app comes back to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const s = getSocket();
      if (state === 'active' && s && !s.connected) s.connect();
    });
    return () => sub.remove();
  }, []);

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
