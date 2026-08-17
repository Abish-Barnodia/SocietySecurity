import { z } from 'zod';

const CATEGORY = ['MAINTENANCE', 'SECURITY', 'NOISE', 'PARKING', 'CLEANLINESS', 'BILLING', 'STAFF_BEHAVIOR', 'AMENITY', 'OTHER'] as const;
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const STATUS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const createComplaintSchema = z.object({
  body: z.object({
    category: z.enum(CATEGORY),
    priority: z.enum(PRIORITY).optional(),
    title: z.string().min(1).max(150),
    description: z.string().min(1).max(4000),
    attachmentUrls: z.array(z.string()).optional(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(STATUS),
    note: z.string().optional(),
  }),
});

export const assignComplaintSchema = z.object({
  body: z.object({
    assignedTo: z.string(),
    assignedToName: z.string(),
  }),
});
