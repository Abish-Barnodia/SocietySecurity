import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { env } from '../config/env';
import '../config/firebase'; // ensures the firebase-admin app is initialized before use
import { AppError } from '../middlewares/error.middleware';

const bucketName = env.FIREBASE_STORAGE_BUCKET
  ?? (env.FIREBASE_PROJECT_ID ? `${env.FIREBASE_PROJECT_ID}.appspot.com` : undefined);

export const uploadBuffer = async (buffer: Buffer, path: string, mimeType: string): Promise<string> => {
  if (getApps().length === 0 || !bucketName) {
    throw new AppError('File storage is not configured on this server', 503);
  }

  const bucket = getStorage().bucket(bucketName);
  const file = bucket.file(path);
  await file.save(buffer, { contentType: mimeType });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucketName}/${path}`;
};
