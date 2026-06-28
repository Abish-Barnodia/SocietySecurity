import { z } from 'zod';

export const registerVehicleSchema = z.object({
  body: z.object({
    registrationNo: z.string().min(4),
    make: z.string().optional(),
    model: z.string().optional(),
    color: z.string().optional()
  })
});

export const checkVehicleSchema = z.object({
  params: z.object({
    registrationNo: z.string().min(4)
  })
});
