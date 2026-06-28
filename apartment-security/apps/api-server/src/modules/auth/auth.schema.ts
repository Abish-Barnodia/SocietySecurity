import { z } from 'zod';

export const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string(),
    code: z.string().length(6),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  })
});

export const registerFcmTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1),
  })
});
