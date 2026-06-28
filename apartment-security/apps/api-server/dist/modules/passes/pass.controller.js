"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPasses = exports.revokePass = exports.suspendPass = exports.getMyPasses = exports.createPass = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const qr_util_1 = require("../../utils/qr.util");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
            otpPlaintext = Math.floor(100000 + Math.random() * 900000).toString();
            otpHash = await bcryptjs_1.default.hash(otpPlaintext, 10);
        }
        const pass = await prisma_1.prisma.pass.create({
            data: {
                residentId: currentResident.id,
                unitId: currentResident.unitId,
                type,
                visitorName,
                visitorPhone,
                purpose,
                validFrom: new Date(validFrom),
                validUntil: new Date(validUntil),
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
        const pass = await prisma_1.prisma.pass.findUnique({ where: { id } });
        if (!pass)
            return next(new error_middleware_1.AppError('Pass not found', 404));
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
        // Used by MANAGER
        const passes = await prisma_1.prisma.pass.findMany({
            include: { unit: true, resident: true },
            orderBy: { createdAt: 'desc' },
            take: 100 // pagination could be added here
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'All passes fetched', passes);
    }
    catch (err) {
        next(err);
    }
};
exports.getAllPasses = getAllPasses;
//# sourceMappingURL=pass.controller.js.map