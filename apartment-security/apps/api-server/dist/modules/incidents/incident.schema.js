"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeIncidentSchema = exports.escalateIncidentSchema = exports.assignIncidentSchema = exports.createIncidentSchema = void 0;
const zod_1 = require("zod");
exports.createIncidentSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum([
            'UNREGISTERED_VEHICLE',
            'TAILGATING',
            'SUSPICIOUS_PERSON',
            'PERIMETER_BREACH',
            'UNAUTHORIZED_ACCESS',
            'PHYSICAL_ALTERCATION',
            'THEFT',
            'VANDALISM',
            'OTHER'
        ]),
        description: zod_1.z.string().min(5),
        location: zod_1.z.string().min(2),
        photoUrls: zod_1.z.array(zod_1.z.string().url()).optional(),
        vehicleNumber: zod_1.z.string().optional(),
        unitId: zod_1.z.string().optional(),
    })
});
exports.assignIncidentSchema = zod_1.z.object({
    body: zod_1.z.object({
        assignedTo: zod_1.z.string(),
        note: zod_1.z.string().optional(),
    })
});
exports.escalateIncidentSchema = zod_1.z.object({
    body: zod_1.z.object({
        note: zod_1.z.string().optional(),
    })
});
exports.closeIncidentSchema = zod_1.z.object({
    body: zod_1.z.object({
        resolutionNote: zod_1.z.string().optional(),
    })
});
//# sourceMappingURL=incident.schema.js.map