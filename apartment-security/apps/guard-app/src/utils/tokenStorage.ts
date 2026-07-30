import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no browser implementation (no Keychain/Keystore
// equivalent exists) — every method throws on web. Fall back to
// localStorage there so auth works in `expo start --web` too.
const tokenStorage = Platform.OS === 'web'
  ? {
      getItemAsync: async (key: string) => window.localStorage.getItem(key),
      setItemAsync: async (key: string, value: string) => window.localStorage.setItem(key, value),
      deleteItemAsync: async (key: string) => window.localStorage.removeItem(key),
    }
  : {
      getItemAsync: SecureStore.getItemAsync,
      setItemAsync: SecureStore.setItemAsync,
      deleteItemAsync: SecureStore.deleteItemAsync,
    };

export default tokenStorage;
