import { z } from 'zod';

export const syncOfflineEntriesSchema = z.object({
  body: z.object({
    entries: z.array(z.object({
      localId: z.string(),
      unitId: z.string(),
      passId: z.string().nullable().optional(),
      entryPointId: z.string(),
      visitorName: z.string(),
      visitorPhone: z.string().nullable().optional(),
      vehicleNumber: z.string().nullable().optional(),
      method: z.enum(['QR_SCAN', 'OTP', 'MANUAL_GUARD', 'VEHICLE_ANPR']),
      status: z.enum(['APPROVED', 'DENIED', 'PENDING_APPROVAL', 'NO_RESPONSE']),
      gatePhotoUrl: z.string().nullable().optional(),
      entryAt: z.string().datetime(),
    }))
  })
});
