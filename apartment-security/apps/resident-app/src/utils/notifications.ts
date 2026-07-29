import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Expo Go dropped remote push notification support in SDK 53. Importing
 * `expo-notifications` there throws at module load, so every use below is
 * lazily imported and skipped when running inside Expo Go. To get real push
 * notifications, run a development build instead:
 * https://docs.expo.dev/develop/development-builds/introduction/
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Cached module handle so we only import expo-notifications once.
let notificationsModule: typeof import('expo-notifications') | null = null;

async function loadNotifications() {
  if (isExpoGo) return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
  return notificationsModule;
}

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    console.log('Push notifications are unavailable in Expo Go — skipping registration.');
    return undefined;
  }

  const Device = await import('expo-device');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    console.log('Must use physical device for push notifications');
    return undefined;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission was not granted.');
    return undefined;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data;
  } catch (error) {
    console.log('Failed to get Expo push token:', error);
    return undefined;
  }
}

/** Fires a local notification (e.g. when a walk-in visitor arrives). */
export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {} },
    trigger: null, // Send immediately
  });
}
