import { z } from 'zod';
export declare const requestWalkinSchema: z.ZodObject<{
    body: z.ZodObject<{
        unitId: z.ZodString;
        entryPointId: z.ZodString;
        visitorName: z.ZodString;
        visitorPhone: z.ZodOptional<z.ZodString>;
        purpose: z.ZodString;
        gatePhotoUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const respondWalkinSchema: z.ZodObject<{
    body: z.ZodObject<{
        status: z.ZodEnum<{
            APPROVED: "APPROVED";
            DENIED: "DENIED";
        }>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=walkin.schema.d.ts.map