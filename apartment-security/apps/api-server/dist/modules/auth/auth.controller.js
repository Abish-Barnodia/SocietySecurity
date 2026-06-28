"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFcmToken = exports.logout = exports.refreshToken = exports.verifyOtp = exports.requestOtp = void 0;
const prisma_1 = require("../../config/prisma");
const otp_util_1 = require("../../utils/otp.util");
const jwt_util_1 = require("../../utils/jwt.util");
const sms_util_1 = require("../../utils/sms.util");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const logger_util_1 = require("../../utils/logger.util");
const requestOtp = async (req, res, next) => {
    try {
        const { phone } = req.body;
        // Check if user exists
        const user = await prisma_1.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            return next(new error_middleware_1.AppError('No account found with this phone number', 404));
        }
        if (!user.isActive) {
            return next(new error_middleware_1.AppError('Your account has been deactivated', 403));
        }
        // Generate and store OTP
        const code = await (0, otp_util_1.createOTP)(user.id, 'LOGIN');
        // Send OTP via SMS
        await (0, sms_util_1.sendSMS)(phone, `Your Apartment Security login OTP is: ${code}`);
        // Audit log
        await (0, audit_util_1.auditLog)(user.id, 'OTP_REQUESTED', 'User', user.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'OTP sent successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.requestOtp = requestOtp;
const verifyOtp = async (req, res, next) => {
    try {
        const { phone, code } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            return next(new error_middleware_1.AppError('No account found', 404));
        }
        const isValid = await (0, otp_util_1.verifyOTP)(user.id, code, 'LOGIN');
        if (!isValid) {
            return next(new error_middleware_1.AppError('Invalid or expired OTP', 400));
        }
        // Generate tokens
        const payload = { userId: user.id, role: user.role };
        const accessToken = (0, jwt_util_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_util_1.signRefreshToken)(payload);
        // Store refresh token
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // 30 days
        await prisma_1.prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: expiryDate,
            }
        });
        // Update last login
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });
        await (0, audit_util_1.auditLog)(user.id, 'LOGIN_SUCCESS', 'User', user.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Login successful', {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                phone: user.phone,
                role: user.role
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyOtp = verifyOtp;
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        // Check if token exists in DB and is not revoked
        const storedToken = await prisma_1.prisma.refreshToken.findUnique({
            where: { token: refreshToken }
        });
        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
            return next(new error_middleware_1.AppError('Invalid or expired refresh token', 401));
        }
        const newAccessToken = (0, jwt_util_1.signAccessToken)({ userId: storedToken.userId, role: 'UNKNOWN' }); // Ideally fetch role
        const newRefreshToken = await (0, jwt_util_1.rotateRefreshToken)(refreshToken);
        // Update DB
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revokedAt: new Date() }
            }),
            prisma_1.prisma.refreshToken.create({
                data: {
                    userId: storedToken.userId,
                    token: newRefreshToken,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            })
        ]);
        return (0, response_util_1.sendSuccess)(res, 200, 'Token refreshed successfully', {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    }
    catch (error) {
        next(error);
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await prisma_1.prisma.refreshToken.update({
                where: { token: refreshToken },
                data: { revokedAt: new Date() }
            }).catch((err) => logger_util_1.logger.warn('Logout token update failed', err));
        }
        return (0, response_util_1.sendSuccess)(res, 200, 'Logged out successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
const registerFcmToken = async (req, res, next) => {
    try {
        const { token } = req.body;
        const userId = req.user?.userId;
        if (!userId)
            return next(new error_middleware_1.AppError('Unauthorized', 401));
        // Append token if not exists
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (user && !user.fcmTokens.includes(token)) {
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { fcmTokens: { push: token } }
            });
        }
        return (0, response_util_1.sendSuccess)(res, 200, 'FCM token registered');
    }
    catch (error) {
        next(error);
    }
};
exports.registerFcmToken = registerFcmToken;
//# sourceMappingURL=auth.controller.js.map