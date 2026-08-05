"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuardSchema = exports.checkInPostSchema = exports.endShiftSchema = exports.startShiftSchema = void 0;
const zod_1 = require("zod");
exports.startShiftSchema = zod_1.z.object({
    body: zod_1.z.object({
        entryPointId: zod_1.z.string().cuid(),
        latitude: zod_1.z.number().optional(),
        longitude: zod_1.z.number().optional()
    })
});
exports.endShiftSchema = zod_1.z.object({
    body: zod_1.z.object({
        handedOverToId: zod_1.z.string().cuid(),
        handoverNote: zod_1.z.string().optional()
    })
});
exports.checkInPostSchema = zod_1.z.object({
    body: zod_1.z.object({
        entryPointId: zod_1.z.string().cuid(),
        latitude: zod_1.z.number().optional(),
        longitude: zod_1.z.number().optional()
    })
});
exports.createGuardSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2),
        phone: zod_1.z.string().min(10),
        badgeNumber: zod_1.z.string().min(2),
        status: zod_1.z.string().optional(),
        shift: zod_1.z.string().optional(),
        post: zod_1.z.string().optional(),
        dateOfJoining: zod_1.z.string().optional(),
        photoUrl: zod_1.z.string().optional()
    })
});
//# sourceMappingURL=guard.schema.js.map