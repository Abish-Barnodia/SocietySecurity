import { z } from 'zod';

export const createDemoRequestSchema = z.object({
  body: z.object({
    contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(8, 'Phone number must be at least 8 digits'),
    societyName: z.string().min(2, 'Society name must be at least 2 characters'),
    city: z.string().optional(),
    numberOfUnits: z.number().int().positive().optional(),
    message: z.string().optional(),
  }),
});

export const updateDemoRequestStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'CONTACTED', 'APPROVED', 'REJECTED', 'CONVERTED']),
    notes: z.string().optional(),
  }),
});

export const approveAndProvisionSchema = z.object({
  body: z.object({
    managerName: z.string().min(2, 'Manager name must be at least 2 characters'),
    managerEmail: z.string().email('Invalid manager email address'),
    managerPhone: z.string().min(8, 'Manager phone number must be at least 8 digits'),
    managerPassword: z.string().min(6, 'Password must be at least 6 characters').optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
    totalUnits: z.number().int().positive().default(100),
    totalTowers: z.number().int().positive().default(1),
    subscriptionPlan: z.string().default('STANDARD'),
  }),
});

