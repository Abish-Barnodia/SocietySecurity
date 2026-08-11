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

export const updateParkingCapacitySchema = z.object({
  body: z.object({
    residentParkingSlots: z.number().int().min(0),
    visitorParkingSlots: z.number().int().min(0),
  })
});
