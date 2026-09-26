"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehicleAlertSchema = exports.triggerDuressSchema = exports.createAlertSchema = void 0;
const zod_1 = require("zod");
exports.createAlertSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['SECURITY_BREACH', 'FIRE', 'MEDICAL', 'GENERAL_NOTICE', 'DURESS', 'MAINTENANCE', 'ACCIDENT', 'COMPLAINT']).or(zod_1.z.string()),
        severity: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        priority: zod_1.z.enum(['P1', 'P2', 'P3']).optional(),
        title: zod_1.z.string().min(2),
        message: zod_1.z.string().min(2),
        location: zod_1.z.string().optional(),
        photoBase64: zod_1.z.string().optional(),
        targetRoles: zod_1.z.array(zod_1.z.enum(['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE'])).optional(), // Empty means all
    })
});
exports.triggerDuressSchema = zod_1.z.object({
    body: zod_1.z.object({
        latitude: zod_1.z.number().optional(),
        longitude: zod_1.z.number().optional()
    })
});
exports.vehicleAlertSchema = zod_1.z.object({
    body: zod_1.z.object({
        photoBase64: zod_1.z.string().min(1, 'Vehicle photo is required'),
        plateNumber: zod_1.z.string().min(1),
        vehicleDetails: zod_1.z.string().min(1),
        location: zod_1.z.string().min(1),
        notes: zod_1.z.string().optional(),
    })
});
//# sourceMappingURL=alert.schema.js.map