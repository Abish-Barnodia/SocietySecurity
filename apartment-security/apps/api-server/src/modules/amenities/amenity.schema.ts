import { z } from 'zod';

const TIME = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Expected HH:MM');

export const createAmenitySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    capacity: z.number().int().positive(),
    openTime: TIME,
    closeTime: TIME,
    status: z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE']).optional(),
  }),
});

export const updateAmenitySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    capacity: z.number().int().positive().optional(),
    openTime: TIME.optional(),
    closeTime: TIME.optional(),
    status: z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE']).optional(),
  }),
});

export const bookAmenitySchema = z.object({
  body: z.object({
    amenityId: z.string(),
    date: z.string().datetime(), // ISO date
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }).refine((data) => data.startTime < data.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
});
