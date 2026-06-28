"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkVehicleSchema = exports.registerVehicleSchema = void 0;
const zod_1 = require("zod");
exports.registerVehicleSchema = zod_1.z.object({
    body: zod_1.z.object({
        registrationNo: zod_1.z.string().min(4),
        make: zod_1.z.string().optional(),
        model: zod_1.z.string().optional(),
        color: zod_1.z.string().optional()
    })
});
exports.checkVehicleSchema = zod_1.z.object({
    params: zod_1.z.object({
        registrationNo: zod_1.z.string().min(4)
    })
});
//# sourceMappingURL=vehicle.schema.js.map