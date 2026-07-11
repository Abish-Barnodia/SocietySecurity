"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPass = exports.getAllPasses = exports.revokePass = exports.deletePass = exports.suspendPass = exports.getMyPasses = exports.createPass = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const qr_util_1 = require("../../utils/qr.util");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const createPass = async (req, res, next) => {
    try {
        const { type, visitorName, visitorPhone, purpose, validFrom, validUntil, entryPointIds, recurringRule } = req.body;
        // Validate resident context
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        // For DELIVERY type, we optionally create an OTP
        let otpPlaintext = null;
        let otpHash = null;
        if (type === 'DELIVERY') {
            // ponytail: crypto.randomInt is cryptographically secure; Math.random is not
            otpPlaintext = crypto_1.default.randomInt(100000, 1000000).toString();
            otpHash = await bcryptjs_1.default.hash(otpPlaintext, 10);
        }
        const fromDate = new Date(validFrom);
        const untilDate = new Date(validUntil);
        const maxDurationDays = type === 'ONE_TIME' || type === 'DELIVERY' ? 1 : 365;
        const durationDays = (untilDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        if (durationDays > maxDurationDays || durationDays <= 0) {
            return next(new error_middleware_1.AppError(`Invalid duration. Maximum allowed for ${type} is ${maxDurationDays} day(s).`, 400));
        }
        const pass = await prisma_1.prisma.pass.create({
            data: {
                residentId: currentResident.id,
                unitId: currentResident.unitId,
                type,
                visitorName,
                visitorPhone,
                purpose,
                validFrom: fromDate,
                validUntil: untilDate,
                entryPointIds: entryPointIds || [],
                otpCode: otpHash,
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
        const updatedPass = await prisma_1.prisma.pass.update({
            where: { id: pass.id },
            data: { qrPayload: qrPayloadString },
            include: { recurringRule: true }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'CREATE_PASS', 'Pass', pass.id);
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
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        const passes = await prisma_1.prisma.pass.findMany({
            where: { unitId: currentResident.unitId },
            include: { recurringRule: true },
            orderBy: { createdAt: 'desc' }
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
const deletePass = async (req, res, next) => {
    try {
        const id = req.params.id;
        const pass = await prisma_1.prisma.pass.findUnique({ where: { id } });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
        // Ownership check
        const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
        if (!resident || pass.unitId !== resident.unitId) {
            return next(new error_middleware_1.AppError('Forbidden: You do not own this pass', 403));
        }
        if (pass.status !== 'SUSPENDED') {
            return next(new error_middleware_1.AppError('Only suspended passes can be deleted', 400));
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Unlink any entries to keep audit history
            await tx.entry.updateMany({
                where: { passId: id },
                data: { passId: null }
            });
            // 2. Delete pass usage history
            await tx.passUsageHistory.deleteMany({
                where: { passId: id }
            });
            // 3. Delete recurring rules if any
            await tx.recurringRule.deleteMany({
                where: { passId: id }
            });
            // 4. Finally delete the pass
            await tx.pass.delete({ where: { id } });
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'DELETE_PASS', 'Pass', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass deleted successfully', null);
    }
    catch (err) {
        next(err);
    }
};
exports.deletePass = deletePass;
const revokePass = async (req, res, next) => {
    try {
        const id = req.params.id;
        const pass = await prisma_1.prisma.pass.findUnique({ where: { id } });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
        if (req.user.role === 'RESIDENT') {
            const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
            if (!resident || pass.unitId !== resident.unitId) {
                return next(new error_middleware_1.AppError('Forbidden: You do not own this pass', 403));
            }
        }
        else {
            // Non-residents must only revoke passes in their property
            const propertyId = req.user.propertyId;
            if (!propertyId)
                return next(new error_middleware_1.AppError('No property context found', 403));
            const passUnit = await prisma_1.prisma.unit.findUnique({ where: { id: pass.unitId } });
            if (!passUnit || passUnit.propertyId !== propertyId) {
                return next(new error_middleware_1.AppError('Forbidden: Pass belongs to a different property', 403));
            }
        }
        const updatedPass = await prisma_1.prisma.pass.update({
            where: { id },
            data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: req.user.userId }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'REVOKE_PASS', 'Pass', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass revoked', updatedPass);
    }
    catch (err) {
        next(err);
    }
};
exports.revokePass = revokePass;
const getAllPasses = async (req, res, next) => {
    try {
        // Used by MANAGER — scoped strictly to their property to prevent cross-tenant exposure
        const propertyId = req.user.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('Manager context not found', 403));
        let page = parseInt(req.query.page);
        page = Number.isNaN(page) ? 1 : Math.max(1, page);
        let limit = parseInt(req.query.limit);
        limit = Number.isNaN(limit) ? 20 : Math.min(100, Math.max(1, limit));
        const skip = (page - 1) * limit;
        const [passes, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.pass.findMany({
                where: { unit: { propertyId } },
                include: { unit: true, resident: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.pass.count({ where: { unit: { propertyId } } }),
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
const verifyPass = async (req, res, next) => {
    try {
        const id = req.params.id;
        // Guard property context checking
        const propertyId = req.user.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('No property context found', 403));
        const pass = await prisma_1.prisma.pass.findUnique({
            where: { id },
            include: { unit: true }
        });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
        if (pass.unit.propertyId !== propertyId) {
            return next(new error_middleware_1.AppError('Forbidden: Pass belongs to a different property', 403));
        }
        return (0, response_util_1.sendSuccess)(res, 200, 'Pass verified', pass);
    }
    catch (err) {
        next(err);
    }
};
exports.verifyPass = verifyPass;
//# sourceMappingURL=pass.controller.js.map