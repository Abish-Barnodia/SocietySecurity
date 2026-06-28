import { z } from 'zod';
export declare const logEntrySchema: z.ZodObject<{
    body: z.ZodObject<{
        unitId: z.ZodString;
        entryPointId: z.ZodString;
        method: z.ZodEnum<{
            OTP: "OTP";
            QR_SCAN: "QR_SCAN";
            MANUAL_GUARD: "MANUAL_GUARD";
            VEHICLE_ANPR: "VEHICLE_ANPR";
        }>;
        visitorName: z.ZodString;
        visitorPhone: z.ZodOptional<z.ZodString>;
        vehicleNumber: z.ZodOptional<z.ZodString>;
        qrPayload: z.ZodOptional<z.ZodString>;
        otpCode: z.ZodOptional<z.ZodString>;
        passId: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        gatePhotoUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const logExitSchema: z.ZodObject<{
    body: z.ZodObject<{
        exitAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=entry.schema.d.ts.map