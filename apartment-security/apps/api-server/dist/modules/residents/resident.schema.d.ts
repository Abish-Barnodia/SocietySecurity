import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        emergencyContact: z.ZodOptional<z.ZodString>;
        emergencyContactName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const alertPreferencesSchema: z.ZodObject<{
    body: z.ZodObject<{
        preferences: z.ZodRecord<z.ZodString, z.ZodBoolean>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const onboardResidentSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        phone: z.ZodString;
        unitId: z.ZodString;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=resident.schema.d.ts.map