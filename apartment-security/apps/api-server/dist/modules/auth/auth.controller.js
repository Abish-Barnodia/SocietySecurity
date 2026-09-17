"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.loginEmail = exports.signupEmail = exports.updateManagerAlertPreferences = exports.updateMyManagerProfile = exports.getMe = exports.registerFcmToken = exports.logoutAllDevices = exports.logout = exports.refreshToken = exports.verifyOtp = exports.requestOtp = exports.getPublicSocieties = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../../config/prisma");
const otp_util_1 = require("../../utils/otp.util");
const jwt_util_1 = require("../../utils/jwt.util");
const sms_util_1 = require("../../utils/sms.util");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const logger_util_1 = require("../../utils/logger.util");
const managerPortalLock_util_1 = require("../../utils/managerPortalLock.util");
const supabaseAuth_util_1 = require("../../utils/supabaseAuth.util");
const getPublicSocieties = async (req, res, next) => {
    try {
        const societies = await prisma_1.prisma.property.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                slug: true,
                city: true,
                address: true,
            },
            orderBy: { name: 'asc' },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Societies retrieved successfully', societies);
    }
    catch (error) {
        next(error);
    }
};
exports.getPublicSocieties = getPublicSocieties;
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
        // Fetch user to get real role (never trust stored token payload for role)
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: storedToken.userId },
            include: { manager: true },
        });
        if (!user)
            return next(new error_middleware_1.AppError('User no longer exists', 401));
        if (!user.isActive)
            return next(new error_middleware_1.AppError('This account has been deactivated', 401));
        // A manager silently refreshing shouldn't be able to keep their session
        // alive after a force-logout or expiry — re-check the lock, not just the
        // refresh token's own validity.
        let managerSessionToken;
        if (user.role === 'MANAGER' && user.manager) {
            const decoded = (0, jwt_util_1.verifyRefreshToken)(refreshToken);
            const lock = await prisma_1.prisma.managerPortalLock.findUnique({ where: { propertyId: user.manager.propertyId } });
            const now = new Date();
            const holdsLock = lock
                && lock.activeManagerId === user.manager.id
                && lock.sessionToken === decoded.managerSessionToken
                && lock.expiresAt && lock.expiresAt > now;
            if (!holdsLock) {
                return next(new error_middleware_1.AppError('Your Manager Portal session has ended. Please log in again.', 401));
            }
            managerSessionToken = lock.sessionToken;
            await prisma_1.prisma.managerPortalLock.update({
                where: { propertyId: user.manager.propertyId },
                data: { lastActivityAt: now, expiresAt: new Date(now.getTime() + managerPortalLock_util_1.MANAGER_SESSION_IDLE_MS) },
            });
        }
        const newAccessToken = (0, jwt_util_1.signAccessToken)({ userId: storedToken.userId, role: user.role, ...(managerSessionToken ? { managerSessionToken } : {}) });
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
        if (req.user?.role === 'MANAGER' && req.user.managerId && req.user.propertyId) {
            await (0, managerPortalLock_util_1.releaseManagerPortalLock)(req.user.propertyId, req.user.managerId, req.user.managerSessionToken);
        }
        return (0, response_util_1.sendSuccess)(res, 200, 'Logged out successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
const logoutAllDevices = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        await prisma_1.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        if (req.user?.role === 'MANAGER' && req.user.managerId && req.user.propertyId) {
            await (0, managerPortalLock_util_1.releaseManagerPortalLock)(req.user.propertyId, req.user.managerId, req.user.managerSessionToken);
        }
        await (0, audit_util_1.auditLog)(userId, 'LOGOUT_ALL_DEVICES', 'User', userId);
        return (0, response_util_1.sendSuccess)(res, 200, 'Logged out of all devices');
    }
    catch (error) {
        next(error);
    }
};
exports.logoutAllDevices = logoutAllDevices;
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
const getMe = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return next(new error_middleware_1.AppError('Unauthorized', 401));
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                phone: true,
                email: true,
                role: true,
                isActive: true,
                resident: {
                    select: {
                        id: true,
                        name: true,
                        residentType: true,
                        isPrimary: true,
                        relationship: true,
                        unit: { select: { unitNumber: true, tower: true, property: { select: { name: true } } } }
                    }
                },
                guard: {
                    select: {
                        id: true,
                        name: true,
                        badgeNumber: true,
                        isOnDuty: true,
                        property: { select: { name: true } }
                    }
                },
                manager: {
                    select: {
                        id: true,
                        name: true,
                        alertPreferences: true,
                        property: { select: { name: true } }
                    }
                }
            }
        });
        if (!user)
            return next(new error_middleware_1.AppError('User not found', 404));
        if (!user.isActive)
            return next(new error_middleware_1.AppError('Account deactivated', 403));
        return (0, response_util_1.sendSuccess)(res, 200, 'Authenticated', user);
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
const updateMyManagerProfile = async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        if (name !== undefined) {
            await prisma_1.prisma.manager.update({ where: { userId: req.user.userId }, data: { name } });
        }
        if (phone !== undefined) {
            try {
                await prisma_1.prisma.user.update({ where: { id: req.user.userId }, data: { phone: phone || null } });
            }
            catch (err) {
                if (err.code === 'P2002')
                    return next(new error_middleware_1.AppError('That phone number is already in use', 400));
                throw err;
            }
        }
        return (0, response_util_1.sendSuccess)(res, 200, 'Profile updated');
    }
    catch (err) {
        next(err);
    }
};
exports.updateMyManagerProfile = updateMyManagerProfile;
const updateManagerAlertPreferences = async (req, res, next) => {
    try {
        const { preferences } = req.body;
        const manager = await prisma_1.prisma.manager.update({
            where: { userId: req.user.userId },
            data: { alertPreferences: preferences },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Alert preferences updated', manager.alertPreferences);
    }
    catch (err) {
        next(err);
    }
};
exports.updateManagerAlertPreferences = updateManagerAlertPreferences;
const signupEmail = async (req, res, next) => {
    try {
        const { email, password, name, role } = req.body;
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            return next(new error_middleware_1.AppError('Email already in use', 400));
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const resolvedRole = role === 'MANAGER' ? 'MANAGER' : 'RESIDENT';
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                role: resolvedRole,
            }
        });
        if (resolvedRole === 'MANAGER') {
            const property = await prisma_1.prisma.property.findFirst();
            if (property) {
                await prisma_1.prisma.manager.create({
                    data: {
                        userId: user.id,
                        propertyId: property.id,
                        name: name || 'Admin',
                    }
                });
            }
        }
        return (0, response_util_1.sendSuccess)(res, 201, 'Signup successful', { id: user.id, email: user.email, role: user.role });
    }
    catch (error) {
        next(error);
    }
};
exports.signupEmail = signupEmail;
const loginEmail = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').trim();
        const user = await prisma_1.prisma.user.findFirst({
            where: {
                email: { equals: cleanEmail, mode: 'insensitive' },
            },
            include: { manager: true },
        });
        if (!user || !user.passwordHash) {
            return next(new error_middleware_1.AppError('Invalid email or password', 401));
        }
        let isValid = await bcryptjs_1.default.compare(cleanPassword, user.passwordHash);
        // Allow trailing period variation if needed for super admin
        if (!isValid && user.role === 'SUPER_ADMIN') {
            if (cleanPassword.endsWith('.')) {
                isValid = await bcryptjs_1.default.compare(cleanPassword.slice(0, -1), user.passwordHash);
            }
            else {
                isValid = await bcryptjs_1.default.compare(`${cleanPassword}.`, user.passwordHash);
            }
        }
        if (!isValid) {
            return next(new error_middleware_1.AppError('Invalid email or password', 401));
        }
        if (!user.isActive) {
            return next(new error_middleware_1.AppError('This account has been deactivated', 403));
        }
        // Managers get exactly one active Manager Portal session per property —
        // claim it atomically before issuing any tokens. If another manager
        // already holds it, the login is rejected outright (no tokens minted),
        // not just blocked on the next request.
        let managerSessionToken;
        if (user.role === 'MANAGER' && user.manager) {
            const token = await (0, managerPortalLock_util_1.claimManagerPortalLock)(user.manager.propertyId, user.manager.id);
            if (!token) {
                return next(new error_middleware_1.AppError('The Manager Portal is currently being used by another manager. Please try again later.', 409));
            }
            managerSessionToken = token;
        }
        // ponytail: Leave restriction enforced at backend auth layer, not frontend
        if (user.role === 'GUARD') {
            const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: user.id }, select: { id: true } });
            if (guard) {
                const now = new Date();
                const activeLeave = await prisma_1.prisma.guardLeave.findFirst({
                    where: {
                        guardId: guard.id,
                        status: 'APPROVED',
                        startDate: { lte: now },
                        endDate: { gte: now },
                    },
                });
                if (activeLeave) {
                    const fmt = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    return next(new error_middleware_1.AppError(`You are currently on leave from ${fmt(activeLeave.startDate)} to ${fmt(activeLeave.endDate)}. You cannot access the Guard App during your leave period.`, 403));
                }
            }
        }
        const payload = { userId: user.id, role: user.role, ...(managerSessionToken ? { managerSessionToken } : {}) };
        const accessToken = (0, jwt_util_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_util_1.signRefreshToken)(payload);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        await prisma_1.prisma.refreshToken.create({
            data: { userId: user.id, token: refreshToken, expiresAt: expiryDate }
        });
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return (0, response_util_1.sendSuccess)(res, 200, 'Login successful', {
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, role: user.role }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.loginEmail = loginEmail;
// Delivery goes through Supabase Auth's own mailer (backed by the real
// Gmail SMTP relay configured inside Supabase's own dashboard, not this
// repo's .env) — Ethereal never reaches a real inbox no matter how
// correctly it's wired up. Supabase is only ever used here to prove the
// requester owns the email and to send the code; the password that
// actually matters for login is still our own User.passwordHash, updated
// below in resetPassword.
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Don't leak whether the email exists or not
            return (0, response_util_1.sendSuccess)(res, 200, 'If your email is registered, you will receive a reset code.');
        }
        if (!user.isActive) {
            return next(new error_middleware_1.AppError('Your account has been deactivated', 403));
        }
        const sent = await (0, supabaseAuth_util_1.sendSupabaseRecoveryEmail)(email);
        if (!sent) {
            return next(new error_middleware_1.AppError('Password reset is not configured. Please contact support.', 500));
        }
        await (0, audit_util_1.auditLog)(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'If your email is registered, you will receive a reset code.');
    }
    catch (error) {
        next(error);
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res, next) => {
    try {
        const { email, code, password } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return next(new error_middleware_1.AppError('Invalid email or code', 400));
        }
        const verified = await (0, supabaseAuth_util_1.verifySupabaseRecoveryCode)(email, code);
        if (!verified) {
            return next(new error_middleware_1.AppError('Invalid or expired OTP', 400));
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash }
        });
        (0, supabaseAuth_util_1.setSupabaseUserPassword)(verified.userId, password).catch(() => { });
        await (0, audit_util_1.auditLog)(user.id, 'PASSWORD_RESET_SUCCESS', 'User', user.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Password has been successfully reset');
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=auth.controller.js.map