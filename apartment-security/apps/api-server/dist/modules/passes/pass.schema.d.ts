import { z } from 'zod';
export declare const createPassSchema: z.ZodObject<{
    body: z.ZodObject<{
        type: z.ZodEnum<{
            ONE_TIME: "ONE_TIME";
            RECURRING: "RECURRING";
            DELIVERY: "DELIVERY";
            CONTRACTOR: "CONTRACTOR";
        }>;
        visitorName: z.ZodString;
        visitorPhone: z.ZodOptional<z.ZodString>;
        purpose: z.ZodOptional<z.ZodString>;
        validFrom: z.ZodString;
        validUntil: z.ZodString;
        entryPointIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        recurringRule: z.ZodOptional<z.ZodObject<{
            allowedDays: z.ZodArray<z.ZodEnum<{
                MONDAY: "MONDAY";
                TUESDAY: "TUESDAY";
                WEDNESDAY: "WEDNESDAY";
                THURSDAY: "THURSDAY";
                FRIDAY: "FRIDAY";
                SATURDAY: "SATURDAY";
                SUNDAY: "SUNDAY";
            }>>;
            windowStartTime: z.ZodString;
            windowEndTime: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=pass.schema.d.ts.map