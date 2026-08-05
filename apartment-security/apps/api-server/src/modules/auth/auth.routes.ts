import { Router } from 'express';
import { requestOtp, verifyOtp, refreshToken, logout, logoutAllDevices, registerFcmToken, getMe, signupEmail, loginEmail, forgotPassword, resetPassword } from './auth.controller';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema, registerFcmTokenSchema, signupEmailSchema, loginEmailSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/signup', authRateLimiter, validate(signupEmailSchema), signupEmail);
router.post('/login', authRateLimiter, validate(loginEmailSchema), loginEmail);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/otp/request', authRateLimiter, validate(requestOtpSchema), requestOtp);
router.post('/otp/verify',  authRateLimiter, validate(verifyOtpSchema),  verifyOtp);
router.post('/refresh',     validate(refreshTokenSchema), refreshToken);
router.post('/logout',      authenticate, logout);
router.post('/logout-all',  authenticate, logoutAllDevices);
router.post('/fcm-token',   authenticate, validate(registerFcmTokenSchema), registerFcmToken);
router.get('/me',           authenticate, getMe);

export { router as authRouter };
