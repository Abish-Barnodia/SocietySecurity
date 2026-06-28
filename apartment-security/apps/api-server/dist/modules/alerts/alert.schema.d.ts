import { z } from 'zod';
export declare const createAlertSchema: z.ZodObject<{
    body: z.ZodObject<{
        type: z.ZodEnum<{
            MAINTENANCE: "MAINTENANCE";
            SECURITY_BREACH: "SECURITY_BREACH";
            FIRE: "FIRE";
            MEDICAL: "MEDICAL";
            GENERAL_NOTICE: "GENERAL_NOTICE";
            DURESS: "DURESS";
        }>;
        severity: z.ZodEnum<{
            CRITICAL: "CRITICAL";
            HIGH: "HIGH";
            LOW: "LOW";
            MEDIUM: "MEDIUM";
        }>;
        title: z.ZodString;
        message: z.ZodString;
        targetRoles: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            RESIDENT: "RESIDENT";
            GUARD: "GUARD";
            MANAGER: "MANAGER";
            COMMITTEE: "COMMITTEE";
        }>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const triggerDuressSchema: z.ZodObject<{
    body: z.ZodObject<{
        latitude: z.ZodOptional<z.ZodNumber>;
        longitude: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=alert.schema.d.ts.map