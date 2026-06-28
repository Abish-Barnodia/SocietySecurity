import { z } from 'zod';

export const createAlertSchema = z.object({
  body: z.object({
    type: z.enum(['SECURITY_BREACH', 'FIRE', 'MEDICAL', 'GENERAL_NOTICE', 'DURESS', 'MAINTENANCE']),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    title: z.string().min(3),
    message: z.string().min(5),
    targetRoles: z.array(z.enum(['RESIDENT', 'GUARD', 'MANAGER', 'COMMITTEE'])).optional(), // Empty means all
  })
});

export const triggerDuressSchema = z.object({
  body: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
});
