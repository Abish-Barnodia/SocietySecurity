import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters — set it in .env' }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters — set it in .env' }),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Third party services (optional for local dev, required in prod)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  
  QR_HMAC_SECRET: z.string().min(32, { message: 'QR_HMAC_SECRET must be at least 32 characters — set it in .env' }),
  OTP_EXPIRY_MINUTES: z.string().default('10').transform(Number),
  EMERGENCY_SMS_NUMBER: z.string().optional(),
  
  CLIENT_RESIDENT_APP_URL: z.string().url().default('http://localhost:3000'),
  CLIENT_GUARD_APP_URL: z.string().url().default('http://localhost:3001'),
  CLIENT_MANAGER_URL: z.string().url().default('http://localhost:3002'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
