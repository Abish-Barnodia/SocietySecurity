import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { env } from '../config/env';
import { logger } from './logger.util';

// Only initialize if we have the credentials (prevents crash in local dev without keys)
if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// ponytail: one Expo client instance shared across all sendPush calls
const expo = new Expo();

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  // Data-only push (no `notification` block) — lets the client build its own
  // rich notification (custom channel/sound, action buttons) via a background
  // task instead of the OS auto-rendering a plain notification it can't
  // attach actions to. title/body still travel in `data` so nothing is lost.
  dataOnly?: boolean;
}

export const sendPush = async (tokens: string[], payload: PushPayload) => {
  if (!tokens.length) return;

  // The resident-app uses getExpoPushTokenAsync → ExponentPushToken[...] format.
  // Those tokens must go through Expo's push service, not Firebase directly.
  // Native FCM tokens (plain hex strings) go through Firebase Admin as before.
  const expoTokens = tokens.filter(t => Expo.isExpoPushToken(t));
  const fcmTokens  = tokens.filter(t => !Expo.isExpoPushToken(t));

  // --- Expo push ---
  if (expoTokens.length) {
    const messages: ExpoPushMessage[] = expoTokens.map(to => ({
      to,
      title: payload.dataOnly ? undefined : payload.title,
      body:  payload.dataOnly ? undefined : payload.body,
      data:  { ...(payload.data ?? {}), title: payload.title, body: payload.body },
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: payload.dataOnly ? 'visitor-ring' : 'default',
    }));

    // expo-server-sdk handles chunking (100 per request) internally
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        // Log errors for visibility — we don't clean Expo tokens the same way
        // as FCM (Expo manages token lifecycle separately).
        tickets.forEach((ticket: any, i: number) => {
          if (ticket.status === 'error') {
            logger.warn('Expo push error', { token: chunk[i]?.to, error: ticket.message });
          }
        });
      } catch (err) {
        logger.error('Expo push send error', { err });
      }
    }
  }

  // --- Firebase FCM push (native FCM tokens only) ---
  if (fcmTokens.length) {
    if (!getApps().length) {
      logger.warn('Firebase admin not initialized, skipping FCM push', payload);
    } else {
      const fcmChunks = chunkArray(fcmTokens, 500);
      for (const chunk of fcmChunks) {
        try {
          const response = await getMessaging().sendEachForMulticast({
            tokens: chunk,
            ...(payload.dataOnly
              ? {}
              : { notification: { title: payload.title, body: payload.body } }),
            data: payload.dataOnly
              ? { ...(payload.data ?? {}), title: payload.title, body: payload.body }
              : (payload.data ?? {}),
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default', badge: 1, ...(payload.dataOnly ? { 'content-available': 1 } : {}) } } },
          });

          const invalidTokens: string[] = [];
          response.responses.forEach((r: any, i: number) => {
            if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
              invalidTokens.push(chunk[i]);
            }
          });

          if (invalidTokens.length) {
            await cleanInvalidTokens(invalidTokens);
          }
        } catch (err) {
          logger.error('FCM send error', { err });
        }
      }
    }
  }
};

const cleanInvalidTokens = async (tokens: string[]) => {
  const { prisma } = await import('../config/prisma');
  const users = await prisma.user.findMany({
    where: { fcmTokens: { hasSome: tokens } },
    select: { id: true, fcmTokens: true },
  });

  const updates = users.map((user) => {
    const cleaned = user.fcmTokens.filter((t) => !tokens.includes(t));
    return prisma.user.update({
      where: { id: user.id },
      data: { fcmTokens: cleaned },
    });
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
};

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};
