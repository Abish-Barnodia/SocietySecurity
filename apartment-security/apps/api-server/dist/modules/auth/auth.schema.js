"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFcmTokenSchema = exports.refreshTokenSchema = exports.verifyOtpSchema = exports.googleAuthSchema = exports.verifyEmailOtpSchema = exports.emailSignupSchema = exports.emailLoginSchema = exports.requestOtpSchema = void 0;
const zod_1 = require("zod");
exports.requestOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
    }),
});
exports.emailLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
exports.emailSignupSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
        name: zod_1.z.string().min(1, 'Name is required'),
        phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format').optional(),
    }),
});
exports.verifyEmailOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        code: zod_1.z.string().length(6, 'OTP must be 6 characters'),
    }),
});
exports.googleAuthSchema = zod_1.z.object({
    body: zod_1.z.object({
        idToken: zod_1.z.string().min(1, 'ID Token is required'),
    }),
});
exports.verifyOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string(),
        code: zod_1.z.string().length(6),
    }),
});
exports.refreshTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1),
    })
});
exports.registerFcmTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1),
    })
});
//# sourceMappingURL=auth.schema.js.map