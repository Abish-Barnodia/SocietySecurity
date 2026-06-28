"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('5000').transform(Number),
    DATABASE_URL: zod_1.z.string().url().optional(), // Made optional for now so dev can start without it immediately crashing if absent
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    JWT_SECRET: zod_1.z.string().min(32).default('your_super_secret_key_min_32_chars_override_me'),
    JWT_EXPIRES_IN: zod_1.z.string().default('7d'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32).default('your_refresh_secret_key_override_me_please'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    // Third party services (optional for local dev, required in prod)
    FIREBASE_PROJECT_ID: zod_1.z.string().optional(),
    FIREBASE_CLIENT_EMAIL: zod_1.z.string().email().optional(),
    FIREBASE_PRIVATE_KEY: zod_1.z.string().optional(),
    TWILIO_ACCOUNT_SID: zod_1.z.string().optional(),
    TWILIO_AUTH_TOKEN: zod_1.z.string().optional(),
    TWILIO_PHONE_NUMBER: zod_1.z.string().optional(),
    SMTP_USER: zod_1.z.string().email().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    WHATSAPP_API_URL: zod_1.z.string().url().optional(),
    WHATSAPP_TOKEN: zod_1.z.string().optional(),
    WHATSAPP_PHONE_ID: zod_1.z.string().optional(),
    QR_HMAC_SECRET: zod_1.z.string().min(32).default('your_qr_signing_secret_override_me_please'),
    OTP_EXPIRY_MINUTES: zod_1.z.string().default('10').transform(Number),
    EMERGENCY_SMS_NUMBER: zod_1.z.string().optional(),
    CLIENT_RESIDENT_APP_URL: zod_1.z.string().url().default('http://localhost:3000'),
    CLIENT_GUARD_APP_URL: zod_1.z.string().url().default('http://localhost:3001'),
    CLIENT_MANAGER_URL: zod_1.z.string().url().default('http://localhost:3002'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
//# sourceMappingURL=env.js.map