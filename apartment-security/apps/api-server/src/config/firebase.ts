import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';
import { logger } from '../utils/logger.util';

let app;

if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
  try {
    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      logger.info('Firebase Admin initialized successfully');
    } else {
      app = getApps()[0];
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin:', error);
  }
} else {
  logger.warn('Firebase credentials missing in environment variables. Firebase Admin not initialized.');
}

export const db = getApps().length > 0 ? getFirestore() : null;
export default app;
