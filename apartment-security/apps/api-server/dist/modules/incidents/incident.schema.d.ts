import { z } from 'zod';
export declare const createIncidentSchema: z.ZodObject<{
    body: z.ZodObject<{
        type: z.ZodEnum<{
            UNREGISTERED_VEHICLE: "UNREGISTERED_VEHICLE";
            TAILGATING: "TAILGATING";
            SUSPICIOUS_PERSON: "SUSPICIOUS_PERSON";
            PERIMETER_BREACH: "PERIMETER_BREACH";
            UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS";
            PHYSICAL_ALTERCATION: "PHYSICAL_ALTERCATION";
            THEFT: "THEFT";
            VANDALISM: "VANDALISM";
            OTHER: "OTHER";
        }>;
        description: z.ZodString;
        location: z.ZodString;
        photoUrls: z.ZodOptional<z.ZodArray<z.ZodString>>;
        vehicleNumber: z.ZodOptional<z.ZodString>;
        unitId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const assignIncidentSchema: z.ZodObject<{
    body: z.ZodObject<{
        assignedTo: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const escalateIncidentSchema: z.ZodObject<{
    body: z.ZodObject<{
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const closeIncidentSchema: z.ZodObject<{
    body: z.ZodObject<{
        resolutionNote: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=incident.schema.d.ts.map