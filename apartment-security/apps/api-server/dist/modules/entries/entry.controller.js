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
exports.getAllEntries = exports.getUnitEntries = exports.getUnitsForGuard = exports.getFrequentVisitors = exports.getRecentEntries = exports.getEntryPoints = exports.logExit = exports.logEntry = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const qr_util_1 = require("../../utils/qr.util");
const parking_util_1 = require("../../utils/parking.util");
const server_1 = require("../../server");
const logEntry = async (req, res, next) => {
    try {
        const { entryPointId, method, vehicleNumber, qrPayload, otpCode, notes, gatePhotoUrl } = req.body;
        let { unitId, visitorName, visitorPhone } = req.body;
        if (method !== 'QR_SCAN' && method !== 'OTP' && (!unitId || !visitorName)) {
            return next(new error_middleware_1.AppError('unitId and visitorName are required for this method', 400));
        }
        const guard = await prisma_1.prisma.guard.findUnique({ where: { userId: req.user.userId } });
        if (!guard || !guard.isOnDuty)
            return next(new error_middleware_1.AppError('Guard must be on an active shift', 400));
        let resolvedPassId = null;
        let status = 'APPROVED';
        let denialReason = null;
        let qrApproval = null;
        if (method === 'QR_SCAN' || method === 'OTP') {
            const candidateCode = (qrPayload || otpCode || req.body.passId || '').trim();
            if (!candidateCode) {
                return next(new error_middleware_1.AppError('QR Payload or OTP code required', 400));
            }
            let pass = null;
            // 1. Try cryptographic signed QR payload
            const parsedQr = (0, qr_util_1.verifySignedQRPayload)(candidateCode);
            if (parsedQr?.passId) {
                pass = await prisma_1.prisma.pass.findFirst({
                    where: {
                        id: parsedQr.passId,
                        unit: { propertyId: guard.propertyId },
                    },
                    include: {
                        unit: { include: { residents: { include: { user: true } } } },
                        resident: { include: { user: true } },
                    },
                });
            }
            // 2. If not a signed QR, search by 6-digit OTP or Pass ID / Code
            if (!pass) {
                const cleanCode = candidateCode.replace(/^OTP:\s*/i, '').replace(/^PASS-\s*/i, '').trim();
                // ponytail: check active pass strictly scoped to this property
                pass = await prisma_1.prisma.pass.findFirst({
                    where: {
                        otpCode: cleanCode,
                        status: 'ACTIVE',
                        unit: { propertyId: guard.propertyId },
                    },
                    include: {
                        unit: { include: { residents: { include: { user: true } } } },
                        resident: { include: { user: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                // Also check by ID / suffix if not found by OTP
                if (!pass) {
                    pass = await prisma_1.prisma.pass.findFirst({
                        where: {
                            OR: [
                                { id: cleanCode },
                                { id: candidateCode },
                                { id: { endsWith: cleanCode } },
                            ],
                            status: 'ACTIVE',
                            unit: { propertyId: guard.propertyId },
                        },
                        include: {
                            unit: { include: { residents: { include: { user: true } } } },
                            resident: { include: { user: true } },
                        },
                        orderBy: { createdAt: 'desc' },
                    });
                }
                // Check if there is an expired/revoked/suspended pass for meaningful denial message
                if (!pass) {
                    const matchedAny = await prisma_1.prisma.pass.findFirst({
                        where: {
                            OR: [
                                { otpCode: cleanCode },
                                { id: cleanCode },
                                { id: candidateCode },
                                { id: { endsWith: cleanCode } },
                            ],
                            unit: { propertyId: guard.propertyId },
                        },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (matchedAny) {
                        return (0, response_util_1.sendSuccess)(res, 200, 'Entry logged as DENIED', {
                            status: 'DENIED',
                            reason: `Pass is ${matchedAny.status.toLowerCase()}`,
                        });
                    }
                }
            }
            if (!pass) {
                return (0, response_util_1.sendSuccess)(res, 200, 'Entry logged as DENIED', {
                    status: 'DENIED',
                    reason: 'Invalid or unrecognized QR code / OTP',
                });
            }
            const entryPoint = await prisma_1.prisma.entryPoint.findUnique({ where: { id: entryPointId } });
            const now = new Date();
            unitId = pass.unitId;
            visitorName = pass.visitorName;
            visitorPhone = pass.visitorPhone;
            // Check if visitor is ALREADY INSIDE (Active open entry without exitAt)
            // If so, this QR / OTP entry is the EXIT SCAN (leaving the building)!
            const openEntry = await prisma_1.prisma.entry.findFirst({
                where: {
                    passId: pass.id,
                    status: 'APPROVED',
                    exitAt: null,
                },
                include: {
                    entryPoint: true,
                },
                orderBy: { entryAt: 'desc' },
            });
            if (openEntry) {
                // ========== PHASE 2: EXIT SCAN (Leaving the building) ==========
                const exitAt = now;
                const entryAt = new Date(openEntry.entryAt);
                const durationMs = Math.max(0, exitAt.getTime() - entryAt.getTime());
                const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
                const durationHours = (durationMinutes / 60).toFixed(1);
                const durationFormatted = durationMinutes < 60 ? `${durationMinutes}m` : `${durationHours}h (${durationMinutes}m)`;
                // 1. Mark entry as exited
                await prisma_1.prisma.entry.update({
                    where: { id: openEntry.id },
                    data: { exitAt },
                });
                // 2. Expire pass after successful exit (2 of 2 scans used)
                if (pass.type === 'ONE_TIME' || pass.type === 'DELIVERY' || pass.type === 'CONTRACTOR') {
                    await prisma_1.prisma.pass.update({
                        where: { id: pass.id },
                        data: { status: 'EXPIRED' },
                    });
                }
                // 3. Record PassUsageHistory outcome as EXITED
                await prisma_1.prisma.passUsageHistory.create({
                    data: {
                        passId: pass.id,
                        entryId: openEntry.id,
                        outcome: 'EXITED',
                    },
                });
                // 4. Release allocated parking
                await (0, parking_util_1.releaseParkingSlot)(openEntry.id);
                // 5. Notify resident via Real-time Socket & Push Notification
                server_1.io?.to(`unit_${pass.unitId}`).emit('visitor_exit_logged', {
                    entryId: openEntry.id,
                    passId: pass.id,
                    visitorName: pass.visitorName,
                    entryAt: entryAt.toISOString(),
                    exitAt: exitAt.toISOString(),
                    durationMinutes,
                    durationFormatted,
                    gateName: entryPoint?.name || 'Gate',
                    unitNumber: pass.unit.unitNumber,
                    tower: pass.unit.tower,
                });
                const { triggerAlert } = await Promise.resolve().then(() => __importStar(require('../../utils/alert.util')));
                await triggerAlert({
                    priority: 'P3',
                    title: 'Visitor Left Building',
                    body: `${pass.visitorName} has left via ${entryPoint?.name || 'Gate'} (Duration: ${durationFormatted}). Pass completed & expired.`,
                    targetUserIds: pass.unit.residents.map((r) => r.userId),
                    propertyId: guard.propertyId,
                    entryId: openEntry.id,
                });
                await (0, audit_util_1.auditLog)(req.user.userId, 'LOG_EXIT_SCAN', 'Entry', openEntry.id);
                return (0, response_util_1.sendSuccess)(res, 200, 'Visitor exit verified and logged. Pass completed & expired.', {
                    id: openEntry.id,
                    status: 'APPROVED',
                    direction: 'EXIT',
                    isExit: true,
                    visitorName: pass.visitorName,
                    visitorPhone: pass.visitorPhone,
                    vehicleNumber: openEntry.vehicleNumber || vehicleNumber,
                    unit: { unitNumber: pass.unit.unitNumber, tower: pass.unit.tower },
                    gateName: entryPoint?.name,
                    entryAt: openEntry.entryAt,
                    exitAt,
                    durationFormatted,
                    durationMinutes,
                    passStatus: 'EXPIRED',
                    message: `Visitor exit logged. Stay duration: ${durationFormatted}. Pass is now expired (2/2 entries used).`,
                });
            }
            // ========== PHASE 1: ENTRY SCAN (Entering the building) ==========
            const alreadyExited = await prisma_1.prisma.passUsageHistory.findFirst({
                where: { passId: pass.id, outcome: 'EXITED' },
            });
            if (alreadyExited && (pass.type === 'ONE_TIME' || pass.type === 'DELIVERY')) {
                denialReason = 'Pass has already been completed and visitor exited (Pass expired)';
            }
            else if (pass.status !== 'ACTIVE') {
                denialReason = `Pass is ${pass.status.toLowerCase()}`;
            }
            else if (now < pass.validFrom) {
                denialReason = 'Pass is not valid yet';
            }
            else if (now > pass.validUntil) {
                denialReason = 'Pass has expired';
            }
            else if (!entryPoint || entryPoint.propertyId !== guard.propertyId) {
                denialReason = 'Gate does not belong to your property';
            }
            else if (pass.unit.propertyId !== guard.propertyId) {
                denialReason = 'Pass does not belong to your property';
            }
            else if (pass.entryPointIds.length > 0 && !pass.entryPointIds.includes(entryPointId)) {
                denialReason = 'Pass is not valid at this gate';
            }
            if (denialReason) {
                status = 'DENIED';
            }
            else {
                resolvedPassId = pass.id;
                status = 'APPROVED'; // Pre-approved pass clear for entry
                qrApproval = { pass, unit: pass.unit, entryPoint };
            }
        }
        else if (method === 'MANUAL_GUARD') {
            // Manual guard entry for walk-in or delivery
            status = 'APPROVED';
        }
        const { entry } = await prisma_1.prisma.$transaction(async (tx) => {
            const createdEntry = await tx.entry.create({
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
                    gatePhotoUrl,
                },
            });
            if (resolvedPassId) {
                const outcome = status === 'APPROVED' ? 'ENTERED' : (status === 'PENDING_APPROVAL' ? 'PENDING' : 'DENIED');
                await tx.passUsageHistory.create({
                    data: { passId: resolvedPassId, entryId: createdEntry.id, outcome },
                });
            }
            return { entry: createdEntry };
        });
        let enriched = denialReason ? { reason: denialReason } : {};
        if (qrApproval && status === 'APPROVED') {
            const { pass, unit, entryPoint } = qrApproval;
            // Notify resident that visitor has entered and live timer has started
            server_1.io?.to(`unit_${unitId}`).emit('visitor_entry_logged', {
                entryId: entry.id,
                passId: pass.id,
                visitorName,
                visitorPhone,
                visitorPhoto: pass.visitorPhoto,
                purpose: pass.purpose,
                vehicleNumber,
                apartment: unit.unitNumber,
                tower: unit.tower,
                gateName: entryPoint?.name || 'Gate',
                entryAt: entry.entryAt.toISOString(),
            });
            const { triggerAlert } = await Promise.resolve().then(() => __importStar(require('../../utils/alert.util')));
            await triggerAlert({
                priority: 'P3',
                title: 'Visitor Entered Building',
                body: `${visitorName} has entered via ${entryPoint?.name || 'Gate'}. Visit timer started. Destination: Tower ${unit.tower || ''} Flat ${unit.unitNumber}.`,
                targetUserIds: unit.residents.map((r) => r.userId),
                propertyId: guard.propertyId,
                entryId: entry.id,
                imageUrl: pass.visitorPhoto ?? undefined,
            });
            enriched = {
                visitorPhoto: pass.visitorPhoto,
                residentPhone: pass.resident?.user?.phone,
                unit: { unitNumber: unit.unitNumber, tower: unit.tower },
                gateName: entryPoint?.name,
                direction: 'ENTRY',
                isEntry: true,
                entryAt: entry.entryAt,
                message: `${visitorName} entered building. Timer started (1/2 scans used).`,
            };
        }
        await (0, parking_util_1.assignParkingSlot)(entry.id, guard.propertyId, vehicleNumber);
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
        const entry = await prisma_1.prisma.entry.findUnique({
            where: { id },
            include: {
                pass: true,
                unit: { include: { residents: { select: { userId: true } } } },
                entryPoint: true,
            },
        });
        if (!entry)
            return next(new error_middleware_1.AppError('Entry not found', 404));
        const exitTime = exitAt ? new Date(exitAt) : new Date();
        const durationMs = Math.max(0, exitTime.getTime() - new Date(entry.entryAt).getTime());
        const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
        const durationHours = (durationMinutes / 60).toFixed(1);
        const durationFormatted = durationMinutes < 60 ? `${durationMinutes}m` : `${durationHours}h (${durationMinutes}m)`;
        const updated = await prisma_1.prisma.entry.update({
            where: { id },
            data: { exitAt: exitTime },
        });
        if (entry.passId) {
            if (entry.pass?.type === 'ONE_TIME' || entry.pass?.type === 'DELIVERY' || entry.pass?.type === 'CONTRACTOR') {
                await prisma_1.prisma.pass.update({
                    where: { id: entry.passId },
                    data: { status: 'EXPIRED' },
                });
            }
            await prisma_1.prisma.passUsageHistory.create({
                data: { passId: entry.passId, entryId: id, outcome: 'EXITED' },
            });
        }
        await (0, parking_util_1.releaseParkingSlot)(id);
        // Notify resident via socket
        server_1.io?.to(`unit_${entry.unitId}`).emit('visitor_exit_logged', {
            entryId: id,
            passId: entry.passId,
            visitorName: entry.visitorName,
            entryAt: entry.entryAt.toISOString(),
            exitAt: exitTime.toISOString(),
            durationMinutes,
            durationFormatted,
            gateName: entry.entryPoint?.name || 'Gate',
            unitNumber: entry.unit?.unitNumber,
            tower: entry.unit?.tower,
        });
        const { triggerAlert } = await Promise.resolve().then(() => __importStar(require('../../utils/alert.util')));
        if (entry.unit?.residents && entry.unit.residents.length > 0) {
            await triggerAlert({
                priority: 'P3',
                title: 'Visitor Left Building',
                body: `${entry.visitorName} has left the building (Total duration: ${durationFormatted}).`,
                targetUserIds: entry.unit.residents.map((r) => r.userId),
                propertyId: req.user?.propertyId || '',
                entryId: id,
            });
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'LOG_EXIT', 'Entry', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Exit logged', { ...updated, durationMinutes, durationFormatted });
    }
    catch (err) {
        next(err);
    }
};
exports.logExit = logExit;
const getEntryPoints = async (req, res, next) => {
    try {
        const propertyId = req.user.propertyId;
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
        const propertyId = req.user.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('Property context not found', 404));
        const entries = await prisma_1.prisma.entry.findMany({
            where: { unit: { propertyId }, status: 'APPROVED' },
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
        const propertyId = req.user.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('Property context not found', 404));
        // Get recent distinct visitors (using group by or distinct on entry table)
        // Prisma distinct is applied after where.
        const entries = await prisma_1.prisma.entry.findMany({
            where: { unit: { propertyId }, method: 'MANUAL_GUARD' },
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
        const propertyId = req.user.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('Property context not found', 404));
        const units = await prisma_1.prisma.unit.findMany({
            where: {
                propertyId,
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
        const unitId = req.user.unitId;
        if (!unitId)
            return next(new error_middleware_1.AppError('Resident context not found', 404));
        const entries = await prisma_1.prisma.entry.findMany({
            where: { unitId },
            include: { entryPoint: { select: { name: true } } },
            orderBy: { entryAt: 'desc' },
            take: 30
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