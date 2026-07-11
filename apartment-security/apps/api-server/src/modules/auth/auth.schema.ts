import { z } from 'zod';

export const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
  }),
});

export const emailLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const emailSignupSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format').optional(),
  }),
});

export const verifyEmailOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    code: z.string().length(6, 'OTP must be 6 characters'),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'ID Token is required'),
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
