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
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard || !guard.isOnDuty)
            return next(new error_middleware_1.AppError('Guard must be on an active shift', 400));
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
                    else
                        resolvedPassId = pass.id;
                }
            }
        }
        else if (method === 'OTP') {
            if (!otpCode || !req.body.passId)
                return next(new error_middleware_1.AppError('OTP and Pass ID required', 400));
            const pass = await prisma_1.prisma.pass.findUnique({ where: { id: req.body.passId } });
            if (!pass || pass.status !== 'ACTIVE' || !pass.otpCode)
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
        const entry = await prisma_1.prisma.entry.create({
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
            await prisma_1.prisma.passUsageHistory.create({
                data: {
                    passId: resolvedPassId,
                    entryId: entry.id,
                    outcome: status === 'APPROVED' ? 'CLEARED' : 'DENIED'
                }
            });
        }
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
        const entries = await prisma_1.prisma.entry.findMany({
            where: { unitId: currentResident.unitId },
            orderBy: { entryAt: 'desc' },
            take: 100
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Entries fetched', entries);
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitEntries = getUnitEntries;
const getAllEntries = async (req, res, next) => {
    try {
        // For Manager / Committee
        const entries = await prisma_1.prisma.entry.findMany({
            include: { unit: true, guard: true, pass: true },
            orderBy: { entryAt: 'desc' },
            take: 100
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'All entries fetched', entries);
    }
    catch (err) {
        next(err);
    }
};
exports.getAllEntries = getAllEntries;
//# sourceMappingURL=entry.controller.js.map