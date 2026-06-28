import { z } from 'zod';
export declare const bookAmenitySchema: z.ZodObject<{
    body: z.ZodObject<{
        amenityId: z.ZodString;
        date: z.ZodString;
        startTime: z.ZodString;
        endTime: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=amenity.schema.d.ts.map