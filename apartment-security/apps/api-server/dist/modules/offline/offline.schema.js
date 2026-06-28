"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOfflineEntriesSchema = void 0;
const zod_1 = require("zod");
exports.syncOfflineEntriesSchema = zod_1.z.object({
    body: zod_1.z.object({
        entries: zod_1.z.array(zod_1.z.object({
            localId: zod_1.z.string(),
            unitId: zod_1.z.string(),
            passId: zod_1.z.string().nullable().optional(),
            entryPointId: zod_1.z.string(),
            visitorName: zod_1.z.string(),
            visitorPhone: zod_1.z.string().nullable().optional(),
            vehicleNumber: zod_1.z.string().nullable().optional(),
            method: zod_1.z.enum(['QR_SCAN', 'OTP', 'MANUAL_GUARD', 'VEHICLE_ANPR']),
            status: zod_1.z.enum(['APPROVED', 'DENIED', 'PENDING_APPROVAL', 'NO_RESPONSE']),
            gatePhotoUrl: zod_1.z.string().nullable().optional(),
            entryAt: zod_1.z.string().datetime(),
        }))
    })
});
//# sourceMappingURL=offline.schema.js.map