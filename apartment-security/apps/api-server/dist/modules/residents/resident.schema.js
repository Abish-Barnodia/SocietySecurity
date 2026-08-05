"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardSelfSchema = exports.onboardHouseholdSchema = exports.onboardResidentSchema = exports.alertPreferencesSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        emergencyContact: zod_1.z.string().optional(),
        emergencyContactName: zod_1.z.string().optional(),
        showUnitInCommunity: zod_1.z.boolean().optional(),
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
        phone: zod_1.z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format'),
        unit: zod_1.z.string(),
        tower: zod_1.z.string().optional(),
        floor: zod_1.z.string().optional(),
        isPrimary: zod_1.z.boolean().default(false),
    }),
});
exports.onboardHouseholdSchema = zod_1.z.object({
    body: zod_1.z.object({
        familyName: zod_1.z.string().min(2).optional(),
        familyPassword: zod_1.z.string().min(6),
        unit: zod_1.z.string(),
        tower: zod_1.z.string().optional(),
        floor: zod_1.z.string().optional(),
        members: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string().min(2),
            phone: zod_1.z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format'),
            email: zod_1.z.string().email().optional(),
            relationship: zod_1.z.string().default('Primary'),
            isPrimary: zod_1.z.boolean().default(false),
        })).min(1),
    }),
});
exports.onboardSelfSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2),
        tower: zod_1.z.string().min(1),
        flatNumber: zod_1.z.string().min(1),
    }),
});
//# sourceMappingURL=resident.schema.js.map