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
