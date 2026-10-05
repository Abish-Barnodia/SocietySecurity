"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentRegisterSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginEmailSchema = exports.signupEmailSchema = exports.registerFcmTokenSchema = exports.refreshTokenSchema = exports.verifyOtpSchema = exports.googleAuthSchema = exports.verifyEmailOtpSchema = exports.updateManagerProfileSchema = exports.emailSignupSchema = exports.passwordComplexitySchema = exports.emailLoginSchema = exports.requestOtpSchema = void 0;
const zod_1 = require("zod");
exports.requestOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
    }),
});
exports.emailLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
exports.passwordComplexitySchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter (A-Z)')
    .regex(/[0-9]/, 'Password must contain at least one number (0-9)')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Password must contain at least one special character (!@#$%^&*)');
exports.emailSignupSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        password: exports.passwordComplexitySchema,
        name: zod_1.z.string().min(1, 'Name is required'),
        phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format').optional(),
    }),
});
exports.updateManagerProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        phone: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format').optional().or(zod_1.z.literal('')),
    }),
});
exports.verifyEmailOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        code: zod_1.z.string().length(6, 'OTP must be 6 characters'),
    }),
});
exports.googleAuthSchema = zod_1.z.object({
    body: zod_1.z.object({
        idToken: zod_1.z.string().min(1, 'ID Token is required'),
    }),
});
exports.verifyOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string(),
        code: zod_1.z.string().length(6),
    }),
});
exports.refreshTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1),
    })
});
exports.registerFcmTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1),
    })
});
exports.signupEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: exports.passwordComplexitySchema,
        name: zod_1.z.string().min(2).optional(),
        role: zod_1.z.enum(['RESIDENT', 'MANAGER']).optional(),
    })
});
exports.loginEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(1),
        propertyId: zod_1.z.string().optional().nullable(),
    })
});
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
    })
});
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        code: zod_1.z.string().length(6, 'OTP must be 6 characters'),
        password: exports.passwordComplexitySchema,
    })
});
exports.residentRegisterSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        password: exports.passwordComplexitySchema,
        name: zod_1.z.string().min(1, 'Full name is required'),
        phone: zod_1.z.string().optional().nullable(),
        tower: zod_1.z.string().min(1, 'Building / Tower is required'),
        flatNumber: zod_1.z.string().min(1, 'Flat / Unit number is required'),
        propertyId: zod_1.z.string().optional().nullable(),
        societyName: zod_1.z.string().optional().nullable(),
        city: zod_1.z.string().optional().nullable(),
        country: zod_1.z.string().optional().nullable(),
        type: zod_1.z.enum(['Owner', 'Tenant']).optional().nullable(),
        tenantSubtype: zod_1.z.string().optional().nullable(),
        occupancyStatus: zod_1.z.string().optional().nullable(),
        documentUrl: zod_1.z.string().optional().nullable(),
        documentName: zod_1.z.string().optional().nullable(),
        vehicleNumber: zod_1.z.string().optional().nullable(),
    })
});
//# sourceMappingURL=auth.schema.js.map