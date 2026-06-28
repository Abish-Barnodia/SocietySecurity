"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOTP = exports.createOTP = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../config/prisma");
const env_1 = require("../config/env");
const createOTP = async (userId, purpose) => {
    // Generate a random 6 digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // In production, you might hash the OTP before storing it if it's highly sensitive, 
    // but since it expires quickly, plaintext or simple hash is often used.
    // For optimal security as specified in prompt, let's hash it.
    const hashedCode = await bcryptjs_1.default.hash(code, 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + env_1.env.OTP_EXPIRY_MINUTES);
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
    const isValid = await bcryptjs_1.default.compare(code, otpRecord.code);
    if (isValid) {
        // Mark as used
        await prisma_1.prisma.oTP.update({
            where: { id: otpRecord.id },
            data: { usedAt: new Date() }
        });
        return true;
    }
    return false;
};
exports.verifyOTP = verifyOTP;
//# sourceMappingURL=otp.util.js.map