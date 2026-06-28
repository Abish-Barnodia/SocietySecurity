import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  DATABASE_URL: z.string().url().optional(), // Made optional for now so dev can start without it immediately crashing if absent
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32).default('your_super_secret_key_min_32_chars_override_me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32).default('your_refresh_secret_key_override_me_please'),
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
  
  QR_HMAC_SECRET: z.string().min(32).default('your_qr_signing_secret_override_me_please'),
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
