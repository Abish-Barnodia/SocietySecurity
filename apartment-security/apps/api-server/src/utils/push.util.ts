import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
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

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const sendPush = async (tokens: string[], payload: PushPayload) => {
  if (!tokens.length) return;
  
  if (!getApps().length) {
    logger.warn('Firebase admin not initialized, skipping push notification', payload);
    return;
  }

  // FCM allows max 500 tokens per multicast
  const chunks = chunkArray(tokens, 500);

  for (const chunk of chunks) {
    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });

      // Remove invalid tokens from DB
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
};

const cleanInvalidTokens = async (tokens: string[]) => {
  const { prisma } = await import('../config/prisma');
  const users = await prisma.user.findMany({
    where: { fcmTokens: { hasSome: tokens } },
    select: { id: true, fcmTokens: true },
  });

  // Batch all updates into a single transaction instead of N individual writes
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
