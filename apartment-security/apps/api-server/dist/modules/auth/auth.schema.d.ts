import { z } from 'zod';
export declare const requestOtpSchema: z.ZodObject<{
    body: z.ZodObject<{
        phone: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const verifyOtpSchema: z.ZodObject<{
    body: z.ZodObject<{
        phone: z.ZodString;
        code: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const refreshTokenSchema: z.ZodObject<{
    body: z.ZodObject<{
        refreshToken: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const registerFcmTokenSchema: z.ZodObject<{
    body: z.ZodObject<{
        token: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=auth.schema.d.ts.map