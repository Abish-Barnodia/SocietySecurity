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

export const onboardHouseholdSchema = z.object({
  body: z.object({
    familyName: z.string().min(2).optional(),
    unit: z.string(),
    tower: z.string().optional(),
    floor: z.string().optional(),
    members: z.array(
      z.object({
        name: z.string().min(2),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        phone: z.string().min(7, 'Phone number too short').optional().or(z.literal('')).transform(v => v || undefined),
        email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
        relationship: z.string().default('Primary'),
        isPrimary: z.boolean().default(false),
      })
    ).min(1),
  }),
});

export const updateHouseholdSchema = z.object({
  body: z.object({
    familyName: z.string().min(2).optional(),
    unit: z.string(),
    tower: z.string().optional(),
    floor: z.string().optional(),
    members: z.array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(2),
        password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
        phone: z.string().min(7, 'Phone number too short').optional().or(z.literal('')).transform(v => v || undefined),
        email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
        relationship: z.string().default('Primary'),
        isPrimary: z.boolean().default(false),
      })
    ).min(1),
  }),
});

export const onboardSelfSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    tower: z.string().min(1),
    flatNumber: z.string().min(1),
  }),
});
