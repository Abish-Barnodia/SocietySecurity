import { z } from 'zod';
export declare const registerVehicleSchema: z.ZodObject<{
    body: z.ZodObject<{
        registrationNo: z.ZodString;
        make: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const checkVehicleSchema: z.ZodObject<{
    params: z.ZodObject<{
        registrationNo: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=vehicle.schema.d.ts.map