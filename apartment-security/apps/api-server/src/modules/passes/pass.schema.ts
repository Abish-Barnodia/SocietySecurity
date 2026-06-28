import { z } from 'zod';

export const createPassSchema = z.object({
  body: z.object({
    type: z.enum(['ONE_TIME', 'RECURRING', 'DELIVERY', 'CONTRACTOR']),
    visitorName: z.string().min(2),
    visitorPhone: z.string().optional(),
    purpose: z.string().optional(),
    validFrom: z.string().datetime(), // ISO string expected
    validUntil: z.string().datetime(),
    entryPointIds: z.array(z.string()).optional(),
    
    // For RECURRING type
    recurringRule: z.object({
      allowedDays: z.array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])),
      windowStartTime: z.string(), // e.g. "08:00"
      windowEndTime: z.string()
    }).optional()
  }).refine((data) => {
    if (data.type === 'RECURRING' && !data.recurringRule) {
      return false;
    }
    return true;
  }, {
    message: "recurringRule is required when type is RECURRING",
    path: ["recurringRule"]
  })
});
