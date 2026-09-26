import { z } from 'zod';

export const createAlertSchema = z.object({
  body: z.object({
    type: z.enum(['SECURITY_BREACH', 'FIRE', 'MEDICAL', 'GENERAL_NOTICE', 'DURESS', 'MAINTENANCE', 'ACCIDENT', 'COMPLAINT']).or(z.string()),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    priority: z.enum(['P1', 'P2', 'P3']).optional(),
    title: z.string().min(2),
    message: z.string().min(2),
    location: z.string().optional(),
    photoBase64: z.string().optional(),
    targetRoles: z.array(z.enum(['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE'])).optional(), // Empty means all
  })
});

export const triggerDuressSchema = z.object({
  body: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
});

export const vehicleAlertSchema = z.object({
  body: z.object({
    photoBase64: z.string().min(1, 'Vehicle photo is required'),
    plateNumber: z.string().min(1),
    vehicleDetails: z.string().min(1),
    location: z.string().min(1),
    notes: z.string().optional(),
  })
});
