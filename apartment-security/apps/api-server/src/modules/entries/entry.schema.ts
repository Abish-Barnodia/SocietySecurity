import { z } from 'zod';

export const logEntrySchema = z.object({
  body: z.object({
    unitId: z.string().cuid(),
    entryPointId: z.string().cuid(),
    method: z.enum(['QR_SCAN', 'OTP', 'MANUAL_GUARD', 'VEHICLE_ANPR']),
    visitorName: z.string().min(2),
    visitorPhone: z.string().optional(),
    vehicleNumber: z.string().optional(),
    
    // Auth fields (one must be provided based on method)
    qrPayload: z.string().optional(),
    otpCode: z.string().optional(),
    passId: z.string().optional(), // Used if manually associating with a known pass
    
    notes: z.string().optional(),
    gatePhotoUrl: z.string().url().optional()
  })
});

export const logExitSchema = z.object({
  body: z.object({
    exitAt: z.string().datetime().optional()
  })
});
