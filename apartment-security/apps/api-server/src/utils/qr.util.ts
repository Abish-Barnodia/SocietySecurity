import crypto from 'crypto';
import { env } from '../config/env';

export interface QRPayload {
  passId: string;
  visitorName: string;
  validFrom: number; // Unix timestamp
  validUntil: number; // Unix timestamp
}

export const generateSignedQRPayload = (payload: QRPayload): string => {
  const dataString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', env.QR_HMAC_SECRET)
    .update(dataString)
    .digest('hex');

  // Payload structure: Base64(JSON).Signature
  const base64Data = Buffer.from(dataString).toString('base64');
  return `${base64Data}.${signature}`;
};

export const verifySignedQRPayload = (signedPayload: string): QRPayload | null => {
  const parts = signedPayload.split('.');
  if (parts.length !== 2) return null;

  const [base64Data, signature] = parts;
  const dataString = Buffer.from(base64Data, 'base64').toString('utf8');

  const expectedSignature = crypto
    .createHmac('sha256', env.QR_HMAC_SECRET)
    .update(dataString)
    .digest('hex');

  if (signature !== expectedSignature) {
    return null; // Signature mismatch, tampered QR
  }

  try {
    return JSON.parse(dataString) as QRPayload;
  } catch (error) {
    return null;
  }
};
