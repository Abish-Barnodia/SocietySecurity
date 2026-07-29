import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    emergencyContact: z.string().optional(),
    emergencyContactName: z.string().optional(),
    showUnitInCommunity: z.boolean().optional(),
  }),
});

export const alertPreferencesSchema = z.object({
  body: z.object({
    preferences: z.record(z.string(), z.boolean()), // e.g., { ONE_TIME: true, RECURRING: false }
  }),
});

export const onboardResidentSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format'),
    unit: z.string(),
    tower: z.string().optional(),
    floor: z.string().optional(),
    isPrimary: z.boolean().default(false),
  }),
});

export const onboardSelfSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    tower: z.string().min(1),
    flatNumber: z.string().min(1),
  }),
});
