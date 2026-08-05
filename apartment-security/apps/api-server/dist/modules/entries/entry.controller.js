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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllEntries = exports.getUnitEntries = exports.getUnitsForGuard = exports.getFrequentVisitors = exports.getRecentEntries = exports.getEntryPoints = exports.logExit = exports.logEntry = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const qr_util_1 = require("../../utils/qr.util");
const server_1 = require("../../server");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logEntry = async (req, res, next) => {
    try {
        const { entryPointId, method, vehicleNumber, qrPayload, otpCode, notes, gatePhotoUrl } = req.body;
        let { unitId, visitorName, visitorPhone } = req.body;
        // Every method except QR_SCAN still needs the guard to tell us who/where —
        // a QR scan is fully self-describing once the signed pass resolves, so
        // the guard app never has to (and can't, without the HMAC secret) know
        // the unit/visitor identity up front.
        if (method !== 'QR_SCAN' && (!unitId || !visitorName)) {
            return next(new error_middleware_1.AppError('unitId and visitorName are required for this method', 400));
        }
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard || !guard.isOnDuty)
            return next(new error_middleware_1.AppError('Guard must be on an active shift', 400));
        let resolvedPassId = null;
        let status = 'APPROVED';
        let denialReason = null;
        // Only set for a valid QR scan that needs resident approval — carries the
        // context needed after entry.create() to open the WalkinApproval ticket
        // and notify the resident. Never set for MANUAL_GUARD, so that existing
        // walk-in behavior (no resident-approval ticket here) is untouched.
        let qrApproval = null;
        if (method === 'QR_SCAN') {
            if (!qrPayload)
                return next(new error_middleware_1.AppError('QR Payload required for QR scan', 400));
            const parsedQr = (0, qr_util_1.verifySignedQRPayload)(qrPayload);
            const pass = parsedQr
                ? await prisma_1.prisma.pass.findUnique({
                    where: { id: parsedQr.passId },
                    include: { unit: true, resident: { include: { user: true } } },
                })
                : null;
            // No signature, or the signed passId doesn't correspond to any real
            // pass — there's no unit/resident to attach this attempt to at all,
            // so there's nothing meaningful to persist as an Entry.
            if (!pass) {
                return (0, response_util_1.sendSuccess)(res, 200, 'Entry logged as DENIED', { status: 'DENIED', reason: 'Invalid or unrecognized QR code' });
            }
            const entryPoint = await prisma_1.prisma.entryPoint.findUnique({ where: { id: entryPointId } });
            const now = new Date();
            // From here on a real pass (and therefore a real unit) exists, so
            // every outcome — including denials — gets a proper audit-trail Entry.
            unitId = pass.unitId;
            visitorName = pass.visitorName;
            visitorPhone = pass.visitorPhone;
            if (pass.status !== 'ACTIVE')
                denialReason = `Pass is ${pass.status.toLowerCase()}`;
            else if (now < pass.validFrom)
                denialReason = 'Pass is not valid yet';
            else if (now > pass.validUntil)
                denialReason = 'Pass has expired';
            else if (!entryPoint || entryPoint.propertyId !== guard.propertyId)
                denialReason = 'Gate does not belong to your property';
            else if (pass.unit.propertyId !== guard.propertyId)
                denialReason = 'Pass does not belong to your property';
            else if (pass.entryPointIds.length > 0 && !pass.entryPointIds.includes(entryPointId))
                denialReason = 'Pass is not valid at this gate';
            else if (pass.type === 'ONE_TIME' &&
                (await prisma_1.prisma.passUsageHistory.findFirst({
                    where: { passId: pass.id, outcome: { in: ['CLEARED', 'PENDING'] } },
                }))) {
                denialReason = 'Pass has already been used';
            }
            if (denialReason) {
                status = 'DENIED';
            }
            else {
                resolvedPassId = pass.id;
                status = 'PENDING_APPROVAL';
                qrApproval = { pass, unit: pass.unit, entryPoint };
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
            const outcome = status === 'PENDING_APPROVAL' ? 'PENDING' : (status === 'APPROVED' ? 'CLEARED' : 'DENIED');
            await prisma_1.prisma.passUsageHistory.create({
                data: { passId: resolvedPassId, entryId: entry.id, outcome }
            });
        }
        let enriched = denialReason ? { reason: denialReason } : {};
        if (qrApproval) {
            const { pass, unit, entryPoint } = qrApproval;
            const timeoutAt = new Date(Date.now() + 120000);
            await prisma_1.prisma.walkinApproval.create({
                data: {
                    entryId: entry.id,
                    residentId: pass.residentId,
                    visitorName,
                    purpose: pass.purpose ?? '',
                    timeoutAt,
                }
            });
            server_1.io?.to(`unit_${unitId}`).emit('visitor_approval_request', {
                entryId: entry.id,
                visitorName,
                visitorPhone,
                visitorPhoto: pass.visitorPhoto,
                purpose: pass.purpose,
                vehicleNumber,
                expectedTime: pass.validUntil,
                apartment: unit.unitNumber,
                tower: unit.tower,
                gateName: entryPoint.name,
                timeoutAt,
            });
            const { triggerAlert } = await Promise.resolve().then(() => __importStar(require('../../utils/alert.util')));
            await triggerAlert({
                priority: 'P2',
                title: 'Visitor at your gate',
                body: `${visitorName} scanned in — approve or deny within 2 minutes.`,
                targetUserIds: [pass.resident.userId],
                propertyId: guard.propertyId,
                entryId: entry.id,
            });
            enriched = {
                visitorPhoto: pass.visitorPhoto,
                residentPhone: pass.resident.user.phone,
                unit: { unitNumber: unit.unitNumber, tower: unit.tower },
                gateName: entryPoint.name,
                timeoutAt,
            };
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'LOG_ENTRY', 'Entry', entry.id);
        return (0, response_util_1.sendSuccess)(res, 201, `Entry logged as ${status}`, { ...entry, ...enriched });
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
const getEntryPoints = async (req, res, next) => {
    try {
        let propertyId;
        if (req.user.role === 'GUARD') {
            const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
            propertyId = guard?.propertyId;
        }
        else {
            const resident = await prisma_1.prisma.resident.findUnique({
                where: { userId: req.user.userId },
                select: { unit: { select: { propertyId: true } } },
            });
            propertyId = resident?.unit.propertyId;
        }
        if (!propertyId)
            return next(new error_middleware_1.AppError('Property context not found', 404));
        const entryPoints = await prisma_1.prisma.entryPoint.findMany({
            where: { propertyId, isActive: true },
            orderBy: { name: 'asc' },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Entry points fetched', entryPoints);
    }
    catch (err) {
        next(err);
    }
};
exports.getEntryPoints = getEntryPoints;
const getRecentEntries = async (req, res, next) => {
    try {
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        const entries = await prisma_1.prisma.entry.findMany({
            where: { unit: { propertyId: guard.propertyId }, status: 'APPROVED' },
            include: {
                unit: { select: { unitNumber: true, tower: true } },
                entryPoint: { select: { name: true } },
            },
            orderBy: { entryAt: 'desc' },
            take: 10,
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Recent entries fetched', entries);
    }
    catch (err) {
        next(err);
    }
};
exports.getRecentEntries = getRecentEntries;
const getFrequentVisitors = async (req, res, next) => {
    try {
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        // Get recent distinct visitors (using group by or distinct on entry table)
        // Prisma distinct is applied after where.
        const entries = await prisma_1.prisma.entry.findMany({
            where: { unit: { propertyId: guard.propertyId }, method: 'MANUAL_GUARD' },
            select: { visitorName: true, vehicleNumber: true, entryAt: true },
            distinct: ['visitorName'],
            orderBy: { entryAt: 'desc' },
            take: 20,
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Frequent visitors fetched', entries);
    }
    catch (err) {
        next(err);
    }
};
exports.getFrequentVisitors = getFrequentVisitors;
const getUnitsForGuard = async (req, res, next) => {
    try {
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard profile not found', 404));
        const units = await prisma_1.prisma.unit.findMany({
            where: {
                propertyId: guard.propertyId,
                residents: { some: {} }
            },
            select: { id: true, unitNumber: true, tower: true, _count: { select: { residents: true } } },
            orderBy: { unitNumber: 'asc' },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Units fetched', units);
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitsForGuard = getUnitsForGuard;
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
            include: { entryPoint: { select: { name: true } } },
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
        // For Manager / Committee — with offset pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const [entries, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.entry.findMany({
                include: { unit: true, guard: true, pass: true },
                orderBy: { entryAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.entry.count(),
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