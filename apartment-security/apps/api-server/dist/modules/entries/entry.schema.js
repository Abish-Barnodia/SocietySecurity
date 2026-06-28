"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logExitSchema = exports.logEntrySchema = void 0;
const zod_1 = require("zod");
exports.logEntrySchema = zod_1.z.object({
    body: zod_1.z.object({
        unitId: zod_1.z.string().cuid(),
        entryPointId: zod_1.z.string().cuid(),
        method: zod_1.z.enum(['QR_SCAN', 'OTP', 'MANUAL_GUARD', 'VEHICLE_ANPR']),
        visitorName: zod_1.z.string().min(2),
        visitorPhone: zod_1.z.string().optional(),
        vehicleNumber: zod_1.z.string().optional(),
        // Auth fields (one must be provided based on method)
        qrPayload: zod_1.z.string().optional(),
        otpCode: zod_1.z.string().optional(),
        passId: zod_1.z.string().optional(), // Used if manually associating with a known pass
        notes: zod_1.z.string().optional(),
        gatePhotoUrl: zod_1.z.string().url().optional()
    })
});
exports.logExitSchema = zod_1.z.object({
    body: zod_1.z.object({
        exitAt: zod_1.z.string().datetime().optional()
    })
});
//# sourceMappingURL=entry.schema.js.map