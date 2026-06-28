import { z } from 'zod';

export const requestWalkinSchema = z.object({
  body: z.object({
    unitId: z.string().cuid(),
    entryPointId: z.string().cuid(),
    visitorName: z.string().min(2),
    visitorPhone: z.string().optional(),
    purpose: z.string(),
    gatePhotoUrl: z.string().url().optional()
  })
});

export const respondWalkinSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'DENIED']),
    notes: z.string().optional()
  })
});
