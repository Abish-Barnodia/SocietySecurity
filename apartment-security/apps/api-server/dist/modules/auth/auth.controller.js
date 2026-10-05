"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerResidentPublic = exports.resetPassword = exports.forgotPassword = exports.checkApprovalStatus = exports.loginEmail = exports.signupEmail = exports.updateManagerAlertPreferences = exports.updateMyManagerProfile = exports.getMe = exports.registerFcmToken = exports.logoutAllDevices = exports.logout = exports.refreshToken = exports.verifyOtp = exports.requestOtp = exports.getPublicSocieties = void 0;
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
const email_service_1 = require("../../utils/email.service");
const getPublicSocieties = async (req, res, next) => {
    try {
        // Include ACTIVE and PENDING societies so newly provisioned societies
        // appear in the login dropdown before their status is explicitly activated.
        // Only SUSPENDED societies are excluded from the public list.
        const societies = await prisma_1.prisma.property.findMany({
            where: { status: { in: ['ACTIVE', 'PENDING'] } },
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
                        status: true,
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
        // ponytail: Public signup is strictly RESIDENT. Manager/Admin creation is an internal admin action.
        const resolvedRole = 'RESIDENT';
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                role: resolvedRole,
            }
        });
        return (0, response_util_1.sendSuccess)(res, 201, 'Signup successful', { id: user.id, email: user.email, role: user.role });
    }
    catch (error) {
        next(error);
    }
};
exports.signupEmail = signupEmail;
const loginEmail = async (req, res, next) => {
    try {
        const { email, password, propertyId } = req.body;
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').trim();
        const user = await prisma_1.prisma.user.findFirst({
            where: {
                email: { equals: cleanEmail, mode: 'insensitive' },
            },
            include: {
                manager: {
                    include: {
                        property: true,
                    },
                },
                guard: {
                    include: {
                        property: true,
                    },
                },
                resident: {
                    include: {
                        unit: {
                            include: {
                                property: true,
                            },
                        },
                    },
                },
            },
        });
        if (!user || !user.passwordHash) {
            return next(new error_middleware_1.AppError('Invalid email or password', 401));
        }
        const isValid = await bcryptjs_1.default.compare(cleanPassword, user.passwordHash);
        if (!isValid) {
            return next(new error_middleware_1.AppError('Invalid email or password', 401));
        }
        if (!user.isActive) {
            return next(new error_middleware_1.AppError('This account has been deactivated', 403));
        }
        let managerSessionToken;
        // Role-specific validations for Manager login:
        if (user.role === 'MANAGER') {
            if (!propertyId) {
                return next(new error_middleware_1.AppError('Please choose your society from the dropdown to sign in.', 400));
            }
            if (!user.manager || user.manager.propertyId !== propertyId) {
                const assignedPropertyName = user.manager?.property?.name;
                const msg = assignedPropertyName
                    ? `You are not authorized for the selected society. Your manager account is registered under "${assignedPropertyName}".`
                    : 'You are not registered as a manager for the selected society.';
                return next(new error_middleware_1.AppError(msg, 403));
            }
            if (user.manager?.property?.status === 'SUSPENDED') {
                return next(new error_middleware_1.AppError('This society has been suspended. Please contact platform support.', 403));
            }
            const token = await (0, managerPortalLock_util_1.claimManagerPortalLock)(user.manager.propertyId, user.manager.id);
            if (!token) {
                return next(new error_middleware_1.AppError('Another manager is currently logged into this society portal.', 409));
            }
            managerSessionToken = token;
        }
        // Role-specific validations for Guard login:
        if (user.role === 'GUARD') {
            if (propertyId && (!user.guard || user.guard.propertyId !== propertyId)) {
                const assignedPropertyName = user.guard?.property?.name;
                const msg = assignedPropertyName
                    ? `You are not authorized for the selected society. Your guard account is registered under "${assignedPropertyName}".`
                    : 'You are not registered as a guard for the selected society.';
                return next(new error_middleware_1.AppError(msg, 403));
            }
            if (user.guard?.property?.status === 'SUSPENDED') {
                return next(new error_middleware_1.AppError('This society has been suspended. Please contact platform support.', 403));
            }
            if (user.guard) {
                const now = new Date();
                const activeLeave = await prisma_1.prisma.guardLeave.findFirst({
                    where: {
                        guardId: user.guard.id,
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
        // For residents: verify society match and approval status
        if (user.role === 'RESIDENT') {
            if (propertyId) {
                const residentPropertyId = user.resident?.unit?.propertyId;
                if (!residentPropertyId || residentPropertyId !== propertyId) {
                    const assignedPropertyName = user.resident?.unit?.property?.name;
                    const msg = assignedPropertyName
                        ? `You are not registered in the selected society. Your resident account belongs to "${assignedPropertyName}".`
                        : 'You are not registered in the selected society.';
                    return next(new error_middleware_1.AppError(msg, 403));
                }
            }
            if (user.resident?.unit?.property?.status === 'SUSPENDED') {
                return next(new error_middleware_1.AppError('This society has been suspended. Please contact platform support.', 403));
            }
            if (user.resident && user.resident.status === 'PENDING') {
                return next(new error_middleware_1.AppError('Your account verification is still pending approval by your society manager.', 403));
            }
            if (user.resident && user.resident.status === 'REJECTED') {
                return next(new error_middleware_1.AppError('Your registration request was rejected by your society management.', 403));
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
const checkApprovalStatus = async (req, res, next) => {
    try {
        const { email, phone, userId } = req.query;
        let user = null;
        if (email) {
            user = await prisma_1.prisma.user.findFirst({
                where: { email: { equals: String(email).trim().toLowerCase(), mode: 'insensitive' } },
                include: { resident: { include: { unit: { include: { property: true } } } } },
            });
        }
        else if (phone) {
            user = await prisma_1.prisma.user.findUnique({
                where: { phone: String(phone).trim() },
                include: { resident: { include: { unit: { include: { property: true } } } } },
            });
        }
        else if (userId) {
            user = await prisma_1.prisma.user.findUnique({
                where: { id: String(userId) },
                include: { resident: { include: { unit: { include: { property: true } } } } },
            });
        }
        if (!user) {
            return (0, response_util_1.sendSuccess)(res, 200, 'Status retrieved', {
                registered: false,
                status: 'NOT_REGISTERED',
                message: 'No registration found with these details.',
            });
        }
        const resident = user.resident;
        const status = resident?.status || 'PENDING';
        return (0, response_util_1.sendSuccess)(res, 200, 'Status retrieved', {
            registered: true,
            status, // 'PENDING' | 'APPROVED' | 'REJECTED'
            name: resident?.name || user.email,
            flat: resident?.unit?.unitNumber,
            tower: resident?.unit?.tower,
            society: resident?.unit?.property?.name,
            submittedAt: resident?.createdAt,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.checkApprovalStatus = checkApprovalStatus;
// Password reset supports both Supabase Auth mailer (if configured) and
// native OTP generation + direct SMTP email delivery via Gmail/Nodemailer.
// In either case, the password stored in our User.passwordHash is updated.
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return next(new error_middleware_1.AppError('Email is required', 400));
        }
        const cleanEmail = email.trim().toLowerCase();
        const user = await prisma_1.prisma.user.findUnique({ where: { email: cleanEmail } });
        if (!user) {
            // Don't leak whether the email exists or not
            return (0, response_util_1.sendSuccess)(res, 200, 'If your email is registered, you will receive a reset code.');
        }
        if (!user.isActive) {
            return next(new error_middleware_1.AppError('Your account has been deactivated', 403));
        }
        let sent = false;
        try {
            sent = await (0, supabaseAuth_util_1.sendSupabaseRecoveryEmail)(cleanEmail);
        }
        catch (err) {
            logger_util_1.logger.warn('Supabase recovery email failed, falling back to native OTP email', { error: err });
            sent = false;
        }
        if (!sent) {
            // Native OTP generation and direct SMTP delivery
            const otp = await (0, otp_util_1.createOTP)(user.id, 'PASSWORD_RESET');
            await (0, email_service_1.sendPasswordResetEmail)(cleanEmail, otp);
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
        if (!email || !code || !password) {
            return next(new error_middleware_1.AppError('Email, code, and new password are required', 400));
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanCode = code.toString().trim();
        const user = await prisma_1.prisma.user.findUnique({ where: { email: cleanEmail } });
        if (!user) {
            return next(new error_middleware_1.AppError('Invalid email or code', 400));
        }
        // Try native OTP verification first
        let verified = await (0, otp_util_1.verifyOTP)(user.id, cleanCode, 'PASSWORD_RESET');
        // If native OTP didn't match, check if Supabase recovery code matches
        let supabaseResult = null;
        if (!verified) {
            supabaseResult = await (0, supabaseAuth_util_1.verifySupabaseRecoveryCode)(cleanEmail, cleanCode);
            if (supabaseResult) {
                verified = true;
            }
        }
        if (!verified) {
            return next(new error_middleware_1.AppError('Invalid or expired OTP', 400));
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash }
        });
        if (supabaseResult?.userId) {
            (0, supabaseAuth_util_1.setSupabaseUserPassword)(supabaseResult.userId, password).catch(() => { });
        }
        await (0, audit_util_1.auditLog)(user.id, 'PASSWORD_RESET_SUCCESS', 'User', user.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Password has been successfully reset');
    }
    catch (error) {
        next(error);
    }
};
exports.resetPassword = resetPassword;
const registerResidentPublic = async (req, res, next) => {
    try {
        const { email, password, name, phone, tower, flatNumber, propertyId, societyName, city, country, type, tenantSubtype, occupancyStatus, documentUrl, documentName, vehicleNumber, } = req.body;
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').trim();
        // 1. Check if user already exists
        let user = await prisma_1.prisma.user.findFirst({
            where: { email: { equals: cleanEmail, mode: 'insensitive' } },
            include: {
                resident: {
                    include: { unit: { include: { property: true } } },
                },
            },
        });
        if (user?.resident) {
            if (user.resident.status === 'PENDING') {
                return (0, response_util_1.sendSuccess)(res, 200, 'Your registration is already submitted and pending approval', {
                    id: user.resident.id,
                    userId: user.id,
                    email: user.email,
                    name: user.resident.name,
                    flat: user.resident.unit?.unitNumber || flatNumber,
                    building: user.resident.unit?.tower || tower,
                    society: user.resident.unit?.property?.name || societyName,
                    status: 'PENDING',
                    submittedAt: user.resident.createdAt,
                });
            }
            if (user.resident.status === 'APPROVED') {
                return next(new error_middleware_1.AppError('An account with this email is already registered and approved. Please sign in.', 400));
            }
        }
        if (!user) {
            const passwordHash = await bcryptjs_1.default.hash(cleanPassword, 10);
            user = await prisma_1.prisma.user.create({
                data: {
                    email: cleanEmail,
                    passwordHash,
                    phone: phone ? String(phone).trim() : null,
                    role: 'RESIDENT',
                },
                include: {
                    resident: {
                        include: { unit: { include: { property: true } } },
                    },
                },
            });
        }
        // 2. Resolve Society / Property
        let property = null;
        if (propertyId) {
            property = await prisma_1.prisma.property.findUnique({ where: { id: propertyId } });
        }
        if (!property && societyName) {
            property = await prisma_1.prisma.property.findFirst({
                where: { name: { contains: societyName, mode: 'insensitive' } },
            });
        }
        if (!property) {
            property = await prisma_1.prisma.property.findFirst();
        }
        if (!property) {
            property = await prisma_1.prisma.property.create({
                data: {
                    name: societyName || 'Aban Humming Bees',
                    address: 'Address',
                    city: city || 'Bengaluru',
                    pincode: '560001',
                    totalUnits: 100,
                },
            });
        }
        // 3. Resolve Unit
        const formattedTower = (tower || 'Block A').trim();
        const formattedFlat = String(flatNumber || '101').trim();
        let unit = await prisma_1.prisma.unit.findUnique({
            where: { propertyId_unitNumber: { propertyId: property.id, unitNumber: formattedFlat } },
        });
        if (!unit) {
            unit = await prisma_1.prisma.unit.create({
                data: {
                    unitNumber: formattedFlat,
                    tower: formattedTower,
                    floor: 1,
                    propertyId: property.id,
                    isOccupied: true,
                },
            });
        }
        else if (unit.tower !== formattedTower && formattedTower) {
            await prisma_1.prisma.unit.update({
                where: { id: unit.id },
                data: { tower: formattedTower },
            });
        }
        // 4. Create Resident Profile
        const existingUnitResidents = await prisma_1.prisma.resident.count({ where: { unitId: unit.id } });
        const resident = await prisma_1.prisma.resident.create({
            data: {
                userId: user.id,
                unitId: unit.id,
                name: name.trim(),
                residentType: type || 'Owner',
                relationship: tenantSubtype || 'Primary',
                status: 'PENDING',
                occupancyStatus: occupancyStatus || 'Currently residing',
                documentUrl: documentUrl || null,
                documentName: documentName || null,
                isPrimary: existingUnitResidents === 0,
            },
            include: { unit: { include: { property: true } } },
        });
        // 5. Create Vehicle if given
        if (vehicleNumber && String(vehicleNumber).trim()) {
            await prisma_1.prisma.vehicle.create({
                data: {
                    unitId: unit.id,
                    registrationNo: String(vehicleNumber).trim().toUpperCase(),
                    isResident: true,
                },
            }).catch((vErr) => {
                logger_util_1.logger.warn('Vehicle creation during public registration failed:', vErr);
            });
        }
        if (!unit.isOccupied) {
            await prisma_1.prisma.unit.update({ where: { id: unit.id }, data: { isOccupied: true } }).catch(() => { });
        }
        await (0, audit_util_1.auditLog)(user.id, 'PUBLIC_REGISTER_RESIDENT', 'Resident', resident.id);
        // 6. Notify Society Managers by Email
        const managers = await prisma_1.prisma.manager.findMany({
            where: { propertyId: property.id },
            include: { user: true },
        });
        const managerEmails = managers
            .map((m) => m.user?.email)
            .filter((e) => !!e);
        const targetManagerEmail = managerEmails.length > 0 ? managerEmails.join(', ') : null;
        (0, email_service_1.sendResidentRegistrationEmailToManager)({
            managerEmail: targetManagerEmail,
            societyName: property.name,
            residentName: name.trim(),
            residentEmail: user.email,
            residentPhone: user.phone,
            unitNumber: formattedFlat,
            tower: formattedTower,
            residentType: type || 'Owner',
            tenantSubtype: tenantSubtype || null,
            occupancyStatus: occupancyStatus || 'Currently residing',
            documentUrl: documentUrl || null,
            documentName: documentName || null,
        }).catch((err) => {
            logger_util_1.logger.warn('Failed to send manager alert email:', err);
        });
        return (0, response_util_1.sendSuccess)(res, 201, 'Registration request submitted for approval', {
            id: resident.id,
            userId: user.id,
            email: user.email,
            name: resident.name,
            flat: formattedFlat,
            building: formattedTower,
            society: property.name,
            status: 'PENDING',
            submittedAt: resident.createdAt,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.registerResidentPublic = registerResidentPublic;
//# sourceMappingURL=auth.controller.js.map