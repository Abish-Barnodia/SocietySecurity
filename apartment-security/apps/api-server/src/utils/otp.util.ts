import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

export const createOTP = async (userId: string, purpose: string): Promise<string> => {
  // Generate a random 6 digit numeric code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // In production, you might hash the OTP before storing it if it's highly sensitive, 
  // but since it expires quickly, plaintext or simple hash is often used.
  // For optimal security as specified in prompt, let's hash it.
  const hashedCode = await bcrypt.hash(code, 10);
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + env.OTP_EXPIRY_MINUTES);
  
  await prisma.oTP.create({
    data: {
      userId,
      code: hashedCode,
      purpose,
      expiresAt,
    }
  });

  return code; // We return the plaintext code to send to the user
};

export const verifyOTP = async (userId: string, code: string, purpose: string): Promise<boolean> => {
  // Find the latest valid OTP for this user and purpose
  const otpRecord = await prisma.oTP.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!otpRecord) return false;

  const isValid = await bcrypt.compare(code, otpRecord.code);
  
  if (isValid) {
    // Mark as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() }
    });
    return true;
  }
  
  return false;
};
