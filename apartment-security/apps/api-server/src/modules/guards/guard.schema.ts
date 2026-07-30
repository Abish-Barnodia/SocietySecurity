import { z } from 'zod';

export const startShiftSchema = z.object({
  body: z.object({
    entryPointId: z.string().cuid(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
});

export const endShiftSchema = z.object({
  body: z.object({
    handedOverToId: z.string().cuid(),
    handoverNote: z.string().optional()
  })
});

export const checkInPostSchema = z.object({
  body: z.object({
    entryPointId: z.string().cuid(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  })
});

export const createGuardSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    phone: z.string().min(10),
    badgeNumber: z.string().min(2),
    status: z.string().optional(),
    shift: z.string().optional(),
    post: z.string().optional(),
    dateOfJoining: z.string().optional(),
    photoUrl: z.string().optional()
  })
});
