"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInPostSchema = exports.endShiftSchema = exports.startShiftSchema = void 0;
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
//# sourceMappingURL=guard.schema.js.map