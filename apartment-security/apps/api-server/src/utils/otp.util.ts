import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

const MAX_OTP_ATTEMPTS = 5;

export const createOTP = async (userId: string, purpose: string): Promise<string> => {
  // ponytail: crypto.randomInt is cryptographically secure; Math.random is not
  const code = crypto.randomInt(100000, 1000000).toString();
  
  const hashedCode = await bcrypt.hash(code, 10);
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + env.OTP_EXPIRY_MINUTES);
  
  // Invalidate all existing unused OTPs for this user+purpose before creating a new one
  await prisma.oTP.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() }
  });

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

  // Brute-force protection: lock out after MAX_OTP_ATTEMPTS failed attempts
  const failedAttempts = (otpRecord as any).failedAttempts ?? 0;
  if (failedAttempts >= MAX_OTP_ATTEMPTS) {
    // Invalidate OTP to prevent further guessing
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() }
    });
    return false;
  }

  const isValid = await bcrypt.compare(code, otpRecord.code);
  
  if (isValid) {
    // Mark as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() }
    });
    return true;
  }

  // Increment failed attempt counter
  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { failedAttempts: { increment: 1 } } as any
  });
  
  return false;
};
