import { Platform, Share } from 'react-native';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const ExpoClipboard = require('expo-clipboard');
    if (ExpoClipboard && typeof ExpoClipboard.setStringAsync === 'function') {
      await ExpoClipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // Fallback if expo-clipboard native binding is not initialized
  }

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore
  }

  try {
    // Safe mobile fallback
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}
