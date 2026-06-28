"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookAmenitySchema = void 0;
const zod_1 = require("zod");
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