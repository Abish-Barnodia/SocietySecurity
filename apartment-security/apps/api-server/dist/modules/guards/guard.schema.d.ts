import { z } from 'zod';
export declare const startShiftSchema: z.ZodObject<{
    body: z.ZodObject<{
        entryPointId: z.ZodString;
        latitude: z.ZodOptional<z.ZodNumber>;
        longitude: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const endShiftSchema: z.ZodObject<{
    body: z.ZodObject<{
        handoverNote: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const checkInPostSchema: z.ZodObject<{
    body: z.ZodObject<{
        entryPointId: z.ZodString;
        latitude: z.ZodOptional<z.ZodNumber>;
        longitude: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=guard.schema.d.ts.map