import { z } from 'zod';

export const createIncidentSchema = z.object({
  body: z.object({
    type: z.enum([
      'UNREGISTERED_VEHICLE',
      'TAILGATING',
      'SUSPICIOUS_PERSON',
      'PERIMETER_BREACH',
      'UNAUTHORIZED_ACCESS',
      'PHYSICAL_ALTERCATION',
      'THEFT',
      'VANDALISM',
      'OTHER'
    ]),
    description: z.string().min(5),
    location: z.string().min(2),
    photoUrls: z.array(z.string().url()).optional(),
    vehicleNumber: z.string().optional(),
    unitId: z.string().optional(),
  })
});

export const assignIncidentSchema = z.object({
  body: z.object({
    assignedTo: z.string(),
    note: z.string().optional(),
  })
});

export const escalateIncidentSchema = z.object({
  body: z.object({
    note: z.string().optional(),
  })
});

export const closeIncidentSchema = z.object({
  body: z.object({
    resolutionNote: z.string().optional(),
  })
});
