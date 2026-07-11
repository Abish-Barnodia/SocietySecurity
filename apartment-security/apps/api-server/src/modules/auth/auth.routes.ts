import { Router } from 'express';
import { requestOtp, verifyOtp, refreshToken, logout, registerFcmToken, getMe, emailLogin } from './auth.controller';
import { emailSignup, verifyEmailOtp } from './auth.email.controller';
import { googleAuth } from './auth.google.controller';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema, registerFcmTokenSchema, emailLoginSchema, emailSignupSchema, verifyEmailOtpSchema, googleAuthSchema } from './auth.schema';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/otp/request', authRateLimiter, validate(requestOtpSchema), requestOtp);
router.post('/otp/verify',  authRateLimiter, validate(verifyOtpSchema),  verifyOtp);
router.post('/email/signup', authRateLimiter, validate(emailSignupSchema), emailSignup);
router.post('/email/login', authRateLimiter, validate(emailLoginSchema), emailLogin);
router.post('/email/verify', authRateLimiter, validate(verifyEmailOtpSchema), verifyEmailOtp);
router.post('/google', authRateLimiter, validate(googleAuthSchema), googleAuth);
router.post('/login',       authRateLimiter, validate(emailLoginSchema), emailLogin); // Keeping old /login for backward compatibility
router.post('/refresh',     validate(refreshTokenSchema), refreshToken);
router.post('/logout',      authenticate, logout);
router.post('/fcm-token',   authenticate, validate(registerFcmTokenSchema), registerFcmToken);
router.get('/me',           authenticate, getMe);

export { router as authRouter };
