"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPassSchema = void 0;
const zod_1 = require("zod");
exports.createPassSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['ONE_TIME', 'RECURRING', 'DELIVERY', 'CONTRACTOR']),
        visitorName: zod_1.z.string().min(2),
        visitorPhone: zod_1.z.string().optional(),
        purpose: zod_1.z.string().optional(),
        validFrom: zod_1.z.string().datetime(), // ISO string expected
        validUntil: zod_1.z.string().datetime(),
        entryPointIds: zod_1.z.array(zod_1.z.string()).optional(),
        // For RECURRING type
        recurringRule: zod_1.z.object({
            allowedDays: zod_1.z.array(zod_1.z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])),
            windowStartTime: zod_1.z.string(), // e.g. "08:00"
            windowEndTime: zod_1.z.string()
        }).optional()
    }).refine((data) => {
        if (data.type === 'RECURRING' && !data.recurringRule) {
            return false;
        }
        return true;
    }, {
        message: "recurringRule is required when type is RECURRING",
        path: ["recurringRule"]
    })
});
//# sourceMappingURL=pass.schema.js.map