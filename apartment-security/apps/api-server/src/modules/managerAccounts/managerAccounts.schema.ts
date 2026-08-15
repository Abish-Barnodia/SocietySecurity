import { z } from 'zod';

export const createManagerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    permissions: z.array(z.string()).default([]),
  }),
});

export const updateManagerSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    permissions: z.array(z.string()).optional(),
  }),
});

export const resetManagerPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});
