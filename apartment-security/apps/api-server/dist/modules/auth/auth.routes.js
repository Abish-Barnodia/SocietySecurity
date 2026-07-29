"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_email_controller_1 = require("./auth.email.controller");
const auth_google_controller_1 = require("./auth.google.controller");
const auth_schema_1 = require("./auth.schema");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rateLimiter_middleware_1 = require("../../middlewares/rateLimiter.middleware");
const router = (0, express_1.Router)();
exports.authRouter = router;
router.post('/otp/request', rateLimiter_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_schema_1.requestOtpSchema), auth_controller_1.requestOtp);
router.post('/otp/verify', rateLimiter_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_schema_1.verifyOtpSchema), auth_controller_1.verifyOtp);
router.post('/email/signup', rateLimiter_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_schema_1.emailSignupSchema), auth_email_controller_1.emailSignup);
router.post('/email/login', rateLimiter_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_schema_1.emailLoginSchema), auth_controller_1.emailLogin);
router.post('/email/verify', rateLimiter_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_schema_1.verifyEmailOtpSchema), auth_email_controller_1.verifyEmailOtp);
router.post('/google', rateLimiter_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_schema_1.googleAuthSchema), auth_google_controller_1.googleAuth);
router.post('/login', rateLimiter_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_schema_1.emailLoginSchema), auth_controller_1.emailLogin); // Keeping old /login for backward compatibility
router.post('/refresh', (0, validate_middleware_1.validate)(auth_schema_1.refreshTokenSchema), auth_controller_1.refreshToken);
router.post('/logout', auth_middleware_1.authenticate, auth_controller_1.logout);
router.post('/fcm-token', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(auth_schema_1.registerFcmTokenSchema), auth_controller_1.registerFcmToken);
router.get('/me', auth_middleware_1.authenticate, auth_controller_1.getMe);
//# sourceMappingURL=auth.routes.js.map