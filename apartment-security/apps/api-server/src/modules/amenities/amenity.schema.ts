import { z } from 'zod';

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
