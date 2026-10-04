"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicPassVerification = exports.getAllPasses = exports.verifyPass = exports.deletePass = exports.revokePass = exports.suspendPass = exports.getMyPasses = exports.createPass = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const qr_util_1 = require("../../utils/qr.util");
const createPass = async (req, res, next) => {
    try {
        const { type, visitorName, visitorPhone, purpose, validFrom, validUntil, entryPointIds, recurringRule, unitId: reqUnitId } = req.body;
        let residentId = null;
        let finalUnitId = reqUnitId;
        if (req.user.role === 'RESIDENT') {
            const currentResident = await prisma_1.prisma.resident.findUnique({
                where: { userId: req.user.userId }
            });
            if (!currentResident)
                return next(new error_middleware_1.AppError('Resident context not found', 404));
            residentId = currentResident.id;
            finalUnitId = currentResident.unitId;
        }
        else if (req.user.role === 'MANAGER' || req.user.role === 'COMMITTEE') {
            if (!finalUnitId)
                return next(new error_middleware_1.AppError('unitId is required for managers creating passes', 400));
            // Optionally find the primary resident of this unit to assign as host
            const unitResident = await prisma_1.prisma.resident.findFirst({ where: { unitId: finalUnitId } });
            residentId = unitResident ? unitResident.id : null;
        }
        else {
            return next(new error_middleware_1.AppError('Unauthorized to create passes', 403));
        }
        // Generate a 6-digit Entry OTP code for every pass
        const otpPlaintext = Math.floor(100000 + Math.random() * 900000).toString();
        const updatedPass = await prisma_1.prisma.$transaction(async (tx) => {
            const pass = await tx.pass.create({
                data: {
                    residentId,
                    unitId: finalUnitId,
                    type,
                    visitorName,
                    visitorPhone,
                    purpose,
                    validFrom: new Date(validFrom),
                    validUntil: new Date(validUntil),
                    entryPointIds: entryPointIds || [],
                    otpCode: otpPlaintext,
                    ...(recurringRule && {
                        recurringRule: {
                            create: recurringRule
                        }
                    })
                },
                include: {
                    recurringRule: true
                }
            });
            // Generate QR payload now that we have the pass ID
            const qrPayloadString = (0, qr_util_1.generateSignedQRPayload)({
                passId: pass.id,
                visitorName: pass.visitorName,
                validFrom: new Date(validFrom).getTime(),
                validUntil: new Date(validUntil).getTime()
            });
            return await tx.pass.update({
                where: { id: pass.id },
                data: { qrPayload: qrPayloadString },
                include: { recurringRule: true }
            });
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'CREATE_PASS', 'Pass', updatedPass.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Pass created successfully', {
            pass: updatedPass,
            otpCode: otpPlaintext // Only returned once to the creator
        });
    }
    catch (err) {
        next(err);
    }
};
exports.createPass = createPass;
const getMyPasses = async (req, res, next) => {
    try {
        const unitId = req.user.unitId;
        if (!unitId)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        const passes = await prisma_1.prisma.pass.findMany({
            where: { unitId },
            include: { recurringRule: true },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Passes fetched', passes);
    }
    catch (err) {
        next(err);
    }
};
exports.getMyPasses = getMyPasses;
const suspendPass = async (req, res, next) => {
    try {
        const id = req.params.id;
        const pass = await prisma_1.prisma.pass.findUnique({ where: { id } });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
        // Ownership check — only the resident who owns the unit can suspend this pass
        const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
        if (!resident || pass.unitId !== resident.unitId) {
            return next(new error_middleware_1.AppError('Forbidden: You do not own this pass', 403));
        }
        const updatedPass = await prisma_1.prisma.pass.update({
            where: { id },
            data: { status: 'SUSPENDED', suspendedAt: new Date() }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'SUSPEND_PASS', 'Pass', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass suspended', updatedPass);
    }
    catch (err) {
        next(err);
    }
};
exports.suspendPass = suspendPass;
const revokePass = async (req, res, next) => {
    try {
        const id = req.params.id;
        const pass = await prisma_1.prisma.pass.findUnique({
            where: { id },
            include: { unit: true },
        });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
        // Residents may only revoke their own unit's passes; managers only within their property
        if (req.user.role === 'RESIDENT') {
            const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
            if (!resident || pass.unitId !== resident.unitId) {
                return next(new error_middleware_1.AppError('Forbidden: You do not own this pass', 403));
            }
        }
        else if (req.user.role === 'MANAGER') {
            if (pass.unit.propertyId !== req.user.propertyId) {
                return next(new error_middleware_1.AppError('Forbidden: You cannot modify passes for other properties', 403));
            }
        }
        const updatedPass = await prisma_1.prisma.pass.update({
            where: { id },
            data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: req.user.userId }
        });
        // Invalidate property pass cache in Redis
        try {
            const { redis } = await Promise.resolve().then(() => __importStar(require('../../config/redis')));
            await redis.del(`pass_cache:property:${pass.unit.propertyId}`);
        }
        catch { }
        await (0, audit_util_1.auditLog)(req.user.userId, 'REVOKE_PASS', 'Pass', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass revoked', updatedPass);
    }
    catch (err) {
        next(err);
    }
};
exports.revokePass = revokePass;
const deletePass = async (req, res, next) => {
    try {
        const id = req.params.id;
        const pass = await prisma_1.prisma.pass.findUnique({ where: { id } });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
        // Ownership check — only the resident who owns the unit can delete this pass
        const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
        if (!resident || pass.unitId !== resident.unitId) {
            return next(new error_middleware_1.AppError('Forbidden: You do not own this pass', 403));
        }
        const isExpired = pass.status === 'EXPIRED' || pass.validUntil < new Date();
        if (!isExpired) {
            return next(new error_middleware_1.AppError('Only expired passes can be deleted', 400));
        }
        await prisma_1.prisma.pass.update({
            where: { id },
            data: {
                status: 'REVOKED',
                revokedAt: new Date(),
                revokedBy: req.user.userId
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'DELETE_PASS', 'Pass', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass deleted');
    }
    catch (err) {
        next(err);
    }
};
exports.deletePass = deletePass;
const verifyPass = async (req, res, next) => {
    try {
        const id = req.params.id;
        const pass = await prisma_1.prisma.pass.findUnique({
            where: { id },
            include: {
                resident: {
                    select: {
                        name: true,
                        user: { select: { phone: true } }
                    }
                },
                unit: { select: { unitNumber: true, tower: true } },
            }
        });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
        const now = new Date();
        const isWithinWindow = now >= pass.validFrom && now <= pass.validUntil;
        const isClear = pass.status === 'ACTIVE' && isWithinWindow;
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass verified', {
            pass,
            clearance: isClear ? 'CLEAR' : 'DENIED',
            reason: isClear ? null : (pass.status !== 'ACTIVE' ? `Pass is ${pass.status.toLowerCase()}` : 'Outside valid time window'),
        });
    }
    catch (err) {
        next(err);
    }
};
exports.verifyPass = verifyPass;
const getAllPasses = async (req, res, next) => {
    try {
        // Used by MANAGER — with offset pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const [passes, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.pass.findMany({
                include: { unit: true, resident: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.pass.count(),
        ]);
        return (0, response_util_1.sendSuccess)(res, 200, 'All passes fetched', {
            passes,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getAllPasses = getAllPasses;
// ponytail: Public pass verification for mobile QR code scans (HMAC cryptographically signed)
const getPublicPassVerification = async (req, res, next) => {
    try {
        const token = req.query.token || req.query.qrPayload;
        if (!token) {
            return next(new error_middleware_1.AppError('Verification token is required', 400));
        }
        const parsedQr = (0, qr_util_1.verifySignedQRPayload)(token);
        if (!parsedQr || !parsedQr.passId) {
            return (0, response_util_1.sendSuccess)(res, 200, 'Pass verification result', {
                status: 'INVALID',
                isValid: false,
                reason: 'Invalid or tampered QR code token signature',
                pass: null,
            });
        }
        const pass = await prisma_1.prisma.pass.findUnique({
            where: { id: parsedQr.passId },
            include: {
                resident: {
                    select: {
                        id: true,
                        name: true,
                        user: {
                            select: {
                                phone: true,
                                email: true,
                            },
                        },
                    },
                },
                unit: {
                    select: {
                        id: true,
                        unitNumber: true,
                        tower: true,
                        property: {
                            select: {
                                id: true,
                                name: true,
                                city: true,
                                address: true,
                            },
                        },
                    },
                },
            },
        });
        if (!pass) {
            return (0, response_util_1.sendSuccess)(res, 200, 'Pass verification result', {
                status: 'NOT_FOUND',
                isValid: false,
                reason: 'Pass record not found in system',
                pass: null,
            });
        }
        const activeEntry = await prisma_1.prisma.entry.findFirst({
            where: { passId: pass.id },
            orderBy: { entryAt: 'desc' },
            include: { entryPoint: true },
        });
        const isInside = activeEntry != null && activeEntry.exitAt == null && activeEntry.status === 'APPROVED';
        const hasExited = activeEntry != null && activeEntry.exitAt != null;
        let scanPhase = 'READY_FOR_ENTRY';
        let scansUsed = 0;
        let durationFormatted = null;
        if (isInside) {
            scanPhase = 'INSIDE_BUILDING';
            scansUsed = 1;
            const durationMs = Math.max(0, Date.now() - new Date(activeEntry.entryAt).getTime());
            const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
            durationFormatted = durationMinutes < 60 ? `${durationMinutes}m` : `${(durationMinutes / 60).toFixed(1)}h`;
        }
        else if (hasExited) {
            scanPhase = 'COMPLETED_EXPIRED';
            scansUsed = 2;
            const durationMs = Math.max(0, new Date(activeEntry.exitAt).getTime() - new Date(activeEntry.entryAt).getTime());
            const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
            durationFormatted = durationMinutes < 60 ? `${durationMinutes}m` : `${(durationMinutes / 60).toFixed(1)}h`;
        }
        const now = new Date();
        const isExpired = now > pass.validUntil || pass.status === 'EXPIRED' || hasExited;
        const isEarly = now < pass.validFrom;
        const isActive = (pass.status === 'ACTIVE' || isInside) && !isExpired && !isEarly;
        let statusText = 'ACTIVE';
        let statusMessage = 'Pass is valid and clear for entry (1/2 scans remaining)';
        if (hasExited || pass.status === 'EXPIRED') {
            statusText = 'EXPIRED';
            statusMessage = `Pass completed & expired (Visit duration: ${durationFormatted || 'Completed'})`;
        }
        else if (isInside) {
            statusText = 'INSIDE';
            statusMessage = `Visitor inside building (Stayed ${durationFormatted || '0m'}). Ready for exit scan.`;
        }
        else if (pass.status !== 'ACTIVE') {
            statusText = pass.status;
            statusMessage = `Pass has been ${pass.status.toLowerCase()}`;
        }
        else if (isExpired) {
            statusText = 'EXPIRED';
            statusMessage = 'Pass has expired';
        }
        else if (isEarly) {
            statusText = 'NOT_YET_VALID';
            statusMessage = 'Pass is not active yet';
        }
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass verified successfully', {
            status: statusText,
            isValid: isActive,
            message: statusMessage,
            scanPhase,
            scansUsed,
            scansTotal: 2,
            durationInside: isInside ? durationFormatted : null,
            totalDuration: hasExited ? durationFormatted : null,
            activeEntry: activeEntry
                ? {
                    id: activeEntry.id,
                    entryAt: activeEntry.entryAt,
                    exitAt: activeEntry.exitAt,
                    gateName: activeEntry.entryPoint?.name || 'Gate',
                }
                : null,
            pass: {
                id: pass.id,
                visitorName: pass.visitorName,
                visitorPhone: pass.visitorPhone,
                type: pass.type,
                validFrom: pass.validFrom,
                validUntil: pass.validUntil,
                purpose: pass.purpose,
                status: pass.status,
                createdAt: pass.createdAt,
                hostResident: {
                    name: pass.resident?.name || 'Resident',
                    phone: pass.resident?.user?.phone || null,
                },
                unit: {
                    unitNumber: pass.unit?.unitNumber || '',
                    tower: pass.unit?.tower || '',
                    formattedUnit: pass.unit?.tower ? `${pass.unit.tower}-${pass.unit.unitNumber}` : pass.unit?.unitNumber,
                },
                society: {
                    name: pass.unit?.property?.name || 'Apartment Society',
                    city: pass.unit?.property?.city || '',
                    address: pass.unit?.property?.address || '',
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getPublicPassVerification = getPublicPassVerification;
//# sourceMappingURL=pass.controller.js.map