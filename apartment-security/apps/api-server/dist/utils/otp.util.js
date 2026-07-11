"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOTP = exports.createOTP = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../config/prisma");
const env_1 = require("../config/env");
const MAX_OTP_ATTEMPTS = 5;
const createOTP = async (userId, purpose) => {
    // ponytail: crypto.randomInt is cryptographically secure; Math.random is not
    const code = crypto_1.default.randomInt(100000, 1000000).toString();
    const hashedCode = await bcryptjs_1.default.hash(code, 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + env_1.env.OTP_EXPIRY_MINUTES);
    // Invalidate all existing unused OTPs for this user+purpose before creating a new one
    await prisma_1.prisma.oTP.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() }
    });
    await prisma_1.prisma.oTP.create({
        data: {
            userId,
            code: hashedCode,
            purpose,
            expiresAt,
        }
    });
    return code; // We return the plaintext code to send to the user
};
exports.createOTP = createOTP;
const verifyOTP = async (userId, code, purpose) => {
    // Find the latest valid OTP for this user and purpose
    const otpRecord = await prisma_1.prisma.oTP.findFirst({
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
    if (!otpRecord)
        return false;
    // Brute-force protection: lock out after MAX_OTP_ATTEMPTS failed attempts
    const failedAttempts = otpRecord.failedAttempts ?? 0;
    if (failedAttempts >= MAX_OTP_ATTEMPTS) {
        // Invalidate OTP to prevent further guessing
        await prisma_1.prisma.oTP.update({
            where: { id: otpRecord.id },
            data: { usedAt: new Date() }
        });
        return false;
    }
    const isValid = await bcryptjs_1.default.compare(code, otpRecord.code);
    if (isValid) {
        // Mark as used
        await prisma_1.prisma.oTP.update({
            where: { id: otpRecord.id },
            data: { usedAt: new Date() }
        });
        return true;
    }
    // Increment failed attempt counter
    await prisma_1.prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { failedAttempts: { increment: 1 } }
    });
    return false;
};
exports.verifyOTP = verifyOTP;
//# sourceMappingURL=otp.util.js.map