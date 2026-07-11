import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied');
    return null;
  }

  // ponytail: projectId must be set in app.config.js extra.eas.projectId for production
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch (err) {
    console.warn('Could not get push token (running in Expo Go or simulator):', err);
    return null;
  }
}

export async function scheduleLocalNotification(title: string, body: string, data?: Record<string, unknown>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null, // fire immediately
  });
}
