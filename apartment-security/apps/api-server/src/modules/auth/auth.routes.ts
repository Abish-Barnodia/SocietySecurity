import { Router } from 'express';
import { requestOtp, verifyOtp, refreshToken, logout, registerFcmToken } from './auth.controller';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema, registerFcmTokenSchema } from './auth.schema';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/otp/request', authRateLimiter, validate(requestOtpSchema), requestOtp);
router.post('/otp/verify',  authRateLimiter, validate(verifyOtpSchema),  verifyOtp);
router.post('/refresh',     validate(refreshTokenSchema), refreshToken);
router.post('/logout',      authenticate, logout);
router.post('/fcm-token',   authenticate, validate(registerFcmTokenSchema), registerFcmToken);

export { router as authRouter };
