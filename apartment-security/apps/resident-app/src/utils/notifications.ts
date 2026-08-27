import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from './api';

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

const VISITOR_RING_CHANNEL = 'visitor-ring';
const VISITOR_APPROVAL_CATEGORY = 'VISITOR_APPROVAL';
const BACKGROUND_NOTIFICATION_TASK = 'VISITOR_APPROVAL_BACKGROUND_TASK';
const RING_MAP_KEY = 'visitor_ring_schedule_map';

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
    // Separate, more insistent channel for "someone's at the gate" alerts —
    // MAX importance + a longer vibration pattern so it reads as urgent
    // (this app has no bundled ringtone asset to loop, so the repeating
    // schedule in startVisitorRing() re-plays this channel's alert sound
    // every few seconds instead, approximating a phone "ringing").
    await Notifications.setNotificationChannelAsync(VISITOR_RING_CHANNEL, {
      name: 'Visitor at gate',
      importance: Notifications.AndroidImportance.MAX,
      // Longer, more insistent buzz-buzz-buzz pattern (closer to an
      // incoming-call vibration) than a single short pulse.
      vibrationPattern: [0, 600, 200, 600, 200, 600, 200, 600],
      lightColor: '#FF231F7C',
      bypassDnd: true,
    });
    await Notifications.setNotificationCategoryAsync(VISITOR_APPROVAL_CATEGORY, [
      { identifier: 'APPROVE', buttonTitle: 'Approve', options: { opensAppToForeground: false } },
      { identifier: 'DENY', buttonTitle: 'Deny', options: { opensAppToForeground: false } },
    ]);
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

// --- Visitor "ringing" alert (Accept/Deny from the notification itself) ---
//
// A single notification can't loop a sound on its own, so the "ring" is a
// repeating scheduled notification (re-fires every few seconds) that keeps
// replaying the visitor-ring channel's alert sound/vibration until it's
// cancelled — by an in-app Approve/Deny, another household member
// responding elsewhere, or the 2-minute server timeout. The schedule id is
// persisted to SecureStore (not an in-memory var) because the background
// task that starts/stops it runs in its own JS context on Android and can't
// share memory with whatever else the app is doing.

async function getRingMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await SecureStore.getItemAsync(RING_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setRingMap(map: Record<string, string[]>) {
  try {
    await SecureStore.setItemAsync(RING_MAP_KEY, JSON.stringify(map));
  } catch {
    // Best-effort — worst case a stale schedule keeps ringing until its own timeout.
  }
}

// A single repeats:true schedule was going quiet well before the server's
// 120s approval window — Android's alarm scheduler doesn't reliably honor a
// short repeating interval long-term (Doze/battery-optimization throttling).
// Scheduling every firing as its own one-shot alarm up front is far more
// reliable, at the cost of holding more schedule ids to cancel later.
const RING_DURATION_SECONDS = 120;
const RING_INTERVAL_SECONDS = 5;

export async function startVisitorRing(entryId: string, visitorName: string, extra?: Record<string, string>) {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  const data = { type: VISITOR_APPROVAL_CATEGORY, entryId, visitorName, ...(extra ?? {}) };

  if (Platform.OS !== 'android') {
    // No repeating-ring/action-button support wired up for iOS yet — a
    // single alert is still better than nothing.
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Visitor at your gate', body: `${visitorName} is waiting — approve or deny`, data },
      trigger: null,
    });
    return;
  }

  const content = {
    title: 'Visitor at your gate',
    body: `${visitorName} is waiting — approve or deny`,
    data,
    categoryIdentifier: VISITOR_APPROVAL_CATEGORY,
    priority: Notifications.AndroidNotificationPriority.MAX,
    sound: true,
  };

  const scheduleIds: string[] = [];
  // First one fires right away, then one more every RING_INTERVAL_SECONDS
  // up through the full approval window.
  scheduleIds.push(await Notifications.scheduleNotificationAsync({ content, trigger: null }));
  for (let t = RING_INTERVAL_SECONDS; t <= RING_DURATION_SECONDS; t += RING_INTERVAL_SECONDS) {
    scheduleIds.push(
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          channelId: VISITOR_RING_CHANNEL,
          seconds: t,
          repeats: false,
        },
      })
    );
  }

  const map = await getRingMap();
  map[entryId] = scheduleIds;
  await setRingMap(map);
}

export async function stopVisitorRing(entryId: string) {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  const map = await getRingMap();
  const scheduleIds = map[entryId];
  if (scheduleIds?.length) {
    await Promise.all(
      scheduleIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
    delete map[entryId];
    await setRingMap(map);
  }

  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      if (n.request.content.data?.entryId === entryId) {
        await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
      }
    }
  } catch {
    // Non-fatal — the repeating schedule is already cancelled either way.
  }
}

/** Approve/Deny tapped on the notification itself — no app UI involved. */
export async function respondToVisitorFromNotification(entryId: string, status: 'APPROVED' | 'DENIED') {
  try {
    await api.post(`/walkins/${entryId}/respond`, { status });
  } catch (error) {
    console.log('Failed to respond to visitor from notification:', error);
  } finally {
    await stopVisitorRing(entryId);
  }
}

// Expo's docs are explicit that TaskManager.defineTask() must run at module
// scope in a module required early (not inside a component effect) — when
// the app is fully killed, Android loads the JS bundle fresh specifically to
// find this registration, and never mounts any React component to get there.
// This IIFE runs the moment anything imports this file (App.tsx does, at its
// top-level import), which is as close to "module scope, loaded early" as
// this file's Expo-Go-safe dynamic-import pattern allows — a static
// top-level `import` of expo-task-manager would throw immediately in Expo
// Go, the same reason expo-notifications itself is never imported eagerly
// here. The dynamic import does mean there's a brief window on a genuinely
// cold, headless launch where the task might not be defined yet; accepted
// as the tradeoff for not crashing Expo Go for every other feature in the app.
if (!isExpoGo && Platform.OS === 'android') {
  (async () => {
    const TaskManager = await import('expo-task-manager');
    const Notifications = await loadNotifications();
    if (!Notifications || TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) return;

    TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: any) => {
      if (error) return;
      const payload = data?.notification?.request?.content?.data;
      if (!payload) return;

      if (payload.type === 'VISITOR_APPROVAL') {
        await startVisitorRing(payload.entryId, payload.visitorName, {
          timeoutAt: payload.timeoutAt, gateName: payload.gateName,
          apartment: payload.apartment, tower: payload.tower,
        });
      } else if (payload.type === 'VISITOR_APPROVAL_RESOLVED') {
        await stopVisitorRing(payload.entryId);
      }
    });
  })();
}

/** Lets a data-only push start/stop the ring even while the app is killed. */
export async function registerBackgroundNotificationTask() {
  if (isExpoGo || Platform.OS !== 'android') return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {});
}

/** Approve/Deny tapped while the app process is alive (foreground or background). */
export async function addVisitorNotificationResponseListener(): Promise<() => void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data: any = response.notification.request.content.data;
    if (data?.type !== VISITOR_APPROVAL_CATEGORY || !data.entryId) return;

    if (response.actionIdentifier === 'APPROVE') {
      respondToVisitorFromNotification(data.entryId, 'APPROVED');
    } else if (response.actionIdentifier === 'DENY') {
      respondToVisitorFromNotification(data.entryId, 'DENIED');
    } else {
      // Tapped the notification body itself (not an action button) —
      // open straight to the approval screen, same as answering a call.
      import('../navigation/navigationRef').then(({ navigateToWalkInApproval }) => {
        navigateToWalkInApproval(data.entryId);
      });
    }
  });

  return () => sub.remove();
}
