"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardResidentSchema = exports.alertPreferencesSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        emergencyContact: zod_1.z.string().optional(),
        emergencyContactName: zod_1.z.string().optional(),
    }),
});
exports.alertPreferencesSchema = zod_1.z.object({
    body: zod_1.z.object({
        preferences: zod_1.z.record(zod_1.z.string(), zod_1.z.boolean()), // e.g., { ONE_TIME: true, RECURRING: false }
    }),
});
exports.onboardResidentSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2),
        phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
        unitId: zod_1.z.string(),
        isPrimary: zod_1.z.boolean().default(false),
    }),
});
//# sourceMappingURL=resident.schema.js.map