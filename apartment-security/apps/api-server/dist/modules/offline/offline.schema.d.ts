import { z } from 'zod';
export declare const syncOfflineEntriesSchema: z.ZodObject<{
    body: z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
            localId: z.ZodString;
            unitId: z.ZodString;
            passId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            entryPointId: z.ZodString;
            visitorName: z.ZodString;
            visitorPhone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            vehicleNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            method: z.ZodEnum<{
                OTP: "OTP";
                QR_SCAN: "QR_SCAN";
                MANUAL_GUARD: "MANUAL_GUARD";
                VEHICLE_ANPR: "VEHICLE_ANPR";
            }>;
            status: z.ZodEnum<{
                APPROVED: "APPROVED";
                DENIED: "DENIED";
                PENDING_APPROVAL: "PENDING_APPROVAL";
                NO_RESPONSE: "NO_RESPONSE";
            }>;
            gatePhotoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            entryAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=offline.schema.d.ts.map