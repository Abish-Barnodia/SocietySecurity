import { z } from 'zod';

const WORKER_TYPE = ['MAID', 'COOK', 'DRIVER', 'NANNY', 'ELECTRICIAN', 'PLUMBER', 'GARDENER', 'SECURITY_GUARD', 'OTHER'] as const;
const DAY_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const workerBody = {
  name: z.string().min(2).max(100),
  phone: z.string().min(6).max(20),
  type: z.enum(WORKER_TYPE),
  address: z.string().max(300).optional(),
  photoUrl: z.string().url().optional(),
  govtIdType: z.string().max(50).optional(),
  govtIdNumber: z.string().max(50).optional(),
  workingDays: z.array(z.enum(DAY_OF_WEEK)).min(1),
  entryTime: z.string().regex(TIME_REGEX, 'entryTime must be in HH:MM format'),
  exitTime: z.string().regex(TIME_REGEX, 'exitTime must be in HH:MM format'),
  notes: z.string().max(1000).optional(),
};

export const createWorkerSchema = z.object({
  body: z.object(workerBody),
});

export const updateWorkerSchema = z.object({
  body: z.object(
    Object.fromEntries(Object.entries(workerBody).map(([key, schema]) => [key, schema.optional()]))
  ),
});

export const logWorkerEntrySchema = z.object({
  body: z.object({
    domesticWorkerId: z.string().min(1),
    entryPointId: z.string().min(1),
  }),
});
