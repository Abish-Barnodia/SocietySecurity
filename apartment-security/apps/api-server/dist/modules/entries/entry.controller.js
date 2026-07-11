"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllEntries = exports.getUnitEntries = exports.logExit = exports.logEntry = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const qr_util_1 = require("../../utils/qr.util");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logEntry = async (req, res, next) => {
    try {
        const { unitId, entryPointId, method, visitorName, visitorPhone, vehicleNumber, qrPayload, otpCode, notes, gatePhotoUrl } = req.body;
        // Resolve guard via userId (guardId is NOT in the JWT payload)
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard || !guard.isOnDuty)
            return next(new error_middleware_1.AppError('Guard must be on an active shift', 400));
        // Validate the unit belongs to the guard's property
        const unit = await prisma_1.prisma.unit.findUnique({ where: { id: unitId } });
        if (!unit || unit.propertyId !== guard.propertyId) {
            return next(new error_middleware_1.AppError('Forbidden: Unit does not belong to your assigned property', 403));
        }
        let resolvedPassId = null;
        let status = 'APPROVED';
        if (method === 'QR_SCAN') {
            if (!qrPayload)
                return next(new error_middleware_1.AppError('QR Payload required for QR scan', 400));
            const parsedQr = (0, qr_util_1.verifySignedQRPayload)(qrPayload);
            if (!parsedQr) {
                status = 'DENIED';
            }
            else {
                const pass = await prisma_1.prisma.pass.findUnique({ where: { id: parsedQr.passId } });
                if (!pass || pass.status !== 'ACTIVE')
                    status = 'DENIED';
                else {
                    const now = new Date();
                    if (now < pass.validFrom || now > pass.validUntil)
                        status = 'DENIED';
                    else if (pass.unitId !== unitId)
                        status = 'DENIED';
                    else
                        resolvedPassId = pass.id;
                }
            }
        }
        else if (method === 'OTP') {
            if (!otpCode || !req.body.passId)
                return next(new error_middleware_1.AppError('OTP and Pass ID required', 400));
            const pass = await prisma_1.prisma.pass.findUnique({ where: { id: req.body.passId } });
            if (!pass || pass.status !== 'ACTIVE' || !pass.otpCode || pass.unitId !== unitId)
                status = 'DENIED';
            else {
                const isValid = await bcryptjs_1.default.compare(otpCode, pass.otpCode);
                if (!isValid)
                    status = 'DENIED';
                else
                    resolvedPassId = pass.id;
            }
        }
        else if (method === 'MANUAL_GUARD') {
            // Manual guard entry usually implies walk-in, so status might be pending if it requires resident approval
            // We will handle walk-in flows in another module, but here we just log it as pending.
            status = 'PENDING_APPROVAL';
        }
        let entry;
        await prisma_1.prisma.$transaction(async (tx) => {
            entry = await tx.entry.create({
                data: {
                    unitId,
                    guardId: guard.id,
                    entryPointId,
                    method,
                    visitorName,
                    visitorPhone,
                    vehicleNumber,
                    passId: resolvedPassId,
                    status: status,
                    notes,
                    gatePhotoUrl
                }
            });
            if (resolvedPassId) {
                await tx.passUsageHistory.create({
                    data: {
                        passId: resolvedPassId,
                        entryId: entry.id,
                        outcome: status === 'APPROVED' ? 'CLEARED' : 'DENIED'
                    }
                });
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'LOG_ENTRY', 'Entry', entry.id);
        return (0, response_util_1.sendSuccess)(res, 201, `Entry logged as ${status}`, entry);
    }
    catch (err) {
        next(err);
    }
};
exports.logEntry = logEntry;
const logExit = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { exitAt } = req.body;
        const entry = await prisma_1.prisma.entry.findUnique({ where: { id } });
        if (!entry)
            return next(new error_middleware_1.AppError('Entry not found', 404));
        const updated = await prisma_1.prisma.entry.update({
            where: { id },
            data: { exitAt: exitAt ? new Date(exitAt) : new Date() }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'LOG_EXIT', 'Entry', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Exit logged', updated);
    }
    catch (err) {
        next(err);
    }
};
exports.logExit = logExit;
const getUnitEntries = async (req, res, next) => {
    try {
        // For Resident
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        let page = parseInt(req.query.page);
        page = Number.isNaN(page) ? 1 : Math.max(1, page);
        let limit = parseInt(req.query.limit);
        limit = Number.isNaN(limit) ? 20 : Math.min(100, Math.max(1, limit));
        const skip = (page - 1) * limit;
        const [entries, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.entry.findMany({
                where: { unitId: currentResident.unitId },
                orderBy: { entryAt: 'desc' },
                skip,
                take: limit
            }),
            prisma_1.prisma.entry.count({ where: { unitId: currentResident.unitId } })
        ]);
        return (0, response_util_1.sendSuccess)(res, 200, 'Entries fetched', {
            entries,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitEntries = getUnitEntries;
const getAllEntries = async (req, res, next) => {
    try {
        // For Manager / Committee — scoped strictly to their property to prevent cross-tenant exposure
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { manager: true, guard: true },
        });
        const propertyId = user?.manager?.propertyId ?? user?.guard?.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('No property context found', 403));
        let page = parseInt(req.query.page);
        page = Number.isNaN(page) ? 1 : Math.max(1, page);
        let limit = parseInt(req.query.limit);
        limit = Number.isNaN(limit) ? 20 : Math.min(100, Math.max(1, limit));
        const skip = (page - 1) * limit;
        const [entries, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.entry.findMany({
                where: { unit: { propertyId } },
                include: { unit: true, guard: true, pass: true },
                orderBy: { entryAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.entry.count({ where: { unit: { propertyId } } }),
        ]);
        return (0, response_util_1.sendSuccess)(res, 200, 'All entries fetched', {
            entries,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getAllEntries = getAllEntries;
//# sourceMappingURL=entry.controller.js.map