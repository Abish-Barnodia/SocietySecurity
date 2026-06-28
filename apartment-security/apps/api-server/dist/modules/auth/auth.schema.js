"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFcmTokenSchema = exports.refreshTokenSchema = exports.verifyOtpSchema = exports.requestOtpSchema = void 0;
const zod_1 = require("zod");
exports.requestOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
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