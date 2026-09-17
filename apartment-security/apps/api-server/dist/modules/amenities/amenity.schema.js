"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookAmenitySchema = exports.updateAmenitySchema = exports.createAmenitySchema = void 0;
const zod_1 = require("zod");
const TIME = zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Expected HH:MM');
exports.createAmenitySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).max(100),
        capacity: zod_1.z.number().int().positive(),
        openTime: TIME,
        closeTime: TIME,
        status: zod_1.z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE']).optional(),
    }),
});
exports.updateAmenitySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).max(100).optional(),
        capacity: zod_1.z.number().int().positive().optional(),
        openTime: TIME.optional(),
        closeTime: TIME.optional(),
        status: zod_1.z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE']).optional(),
    }),
});
exports.bookAmenitySchema = zod_1.z.object({
    body: zod_1.z.object({
        amenityId: zod_1.z.string(),
        date: zod_1.z.string().datetime(), // ISO date
        startTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        endTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    }).refine((data) => data.startTime < data.endTime, {
        message: 'End time must be after start time',
        path: ['endTime'],
    })
});
//# sourceMappingURL=amenity.schema.js.map