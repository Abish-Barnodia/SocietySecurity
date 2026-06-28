"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respondWalkinSchema = exports.requestWalkinSchema = void 0;
const zod_1 = require("zod");
exports.requestWalkinSchema = zod_1.z.object({
    body: zod_1.z.object({
        unitId: zod_1.z.string().cuid(),
        entryPointId: zod_1.z.string().cuid(),
        visitorName: zod_1.z.string().min(2),
        visitorPhone: zod_1.z.string().optional(),
        purpose: zod_1.z.string(),
        gatePhotoUrl: zod_1.z.string().url().optional()
    })
});
exports.respondWalkinSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['APPROVED', 'DENIED']),
        notes: zod_1.z.string().optional()
    })
});
//# sourceMappingURL=walkin.schema.js.map