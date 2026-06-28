"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyReport = exports.getOperationsOverview = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const pdf_util_1 = require("../../utils/pdf.util");
const audit_util_1 = require("../../utils/audit.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const getOperationsOverview = async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { manager: true, committee: true }
        });
        const propertyId = user?.manager?.propertyId || user?.committee?.id; // Committees don't have propertyId strictly?
        // Let's just find propertyId based on role
        // Quick fix: For now we assume Manager
        if (!user?.manager)
            return next(new error_middleware_1.AppError('Only managers can access this', 403));
        const pId = user.manager.propertyId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [totalEntriesToday, activeVisitors, guardsOnDuty, openIncidents, unacknowledgedAlerts, pendingWalkins,] = await Promise.all([
            prisma_1.prisma.entry.count({ where: { unit: { propertyId: pId }, entryAt: { gte: today }, status: 'APPROVED' } }),
            prisma_1.prisma.entry.count({ where: { unit: { propertyId: pId }, status: 'APPROVED', exitAt: null } }),
            prisma_1.prisma.guard.count({ where: { propertyId: pId, isOnDuty: true } }),
            prisma_1.prisma.incident.count({ where: { propertyId: pId, status: { not: 'CLOSED' } } }),
            prisma_1.prisma.alert.count({ where: { propertyId: pId, status: 'SENT', priority: { in: ['P1', 'P2'] } } }),
            prisma_1.prisma.walkinApproval.count({
                where: {
                    entry: { unit: { propertyId: pId } },
                    respondedAt: null,
                    timeoutAt: { gt: new Date() },
                },
            }),
        ]);
        (0, response_util_1.sendSuccess)(res, 200, 'Operations overview fetched', {
            totalEntriesToday,
            activeVisitors,
            guardsOnDuty,
            openIncidents,
            unacknowledgedAlerts,
            pendingWalkins,
            generatedAt: new Date(),
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getOperationsOverview = getOperationsOverview;
const generateMonthlyReport = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        if (!month || !year)
            return next(new error_middleware_1.AppError('month and year are required', 400));
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { manager: true }
        });
        if (!user?.manager)
            return next(new error_middleware_1.AppError('Only managers can generate reports', 403));
        const propertyId = user.manager.propertyId;
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        const [property, totalEntries, digitalEntries, incidents, guardCompliance, activePassCount, anomalyFlags,] = await Promise.all([
            prisma_1.prisma.property.findUnique({ where: { id: propertyId } }),
            prisma_1.prisma.entry.count({
                where: { unit: { propertyId }, entryAt: { gte: startDate, lte: endDate }, status: 'APPROVED' },
            }),
            prisma_1.prisma.entry.count({
                where: {
                    unit: { propertyId },
                    entryAt: { gte: startDate, lte: endDate },
                    status: 'APPROVED',
                    method: { in: ['QR_SCAN', 'OTP'] },
                },
            }),
            prisma_1.prisma.incident.findMany({
                where: { propertyId, createdAt: { gte: startDate, lte: endDate } },
                include: { actions: { orderBy: { createdAt: 'desc' } } },
            }),
            prisma_1.prisma.shift.findMany({
                where: {
                    guard: { propertyId },
                    startedAt: { gte: startDate, lte: endDate },
                    signedOffAt: { not: null },
                },
                include: { guard: true },
            }),
            prisma_1.prisma.pass.count({ where: { unit: { propertyId }, status: 'ACTIVE' } }),
            prisma_1.prisma.pass.findMany({
                where: {
                    unit: { propertyId },
                    status: { in: ['ACTIVE', 'SUSPENDED'] },
                    validUntil: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
                },
                include: { unit: true, resident: true },
            }),
        ]);
        const reportData = {
            property: property,
            period: { month: parseInt(month), year: parseInt(year), startDate, endDate },
            entries: {
                total: totalEntries,
                digital: digitalEntries,
                digitalRate: totalEntries ? Math.round((digitalEntries / totalEntries) * 100) : 0,
            },
            incidents: {
                total: incidents.length,
                open: incidents.filter((i) => i.status === 'OPEN').length,
                inProgress: incidents.filter((i) => i.status === 'IN_PROGRESS').length,
                closed: incidents.filter((i) => i.status === 'CLOSED').length,
                byType: groupBy(incidents, 'type'),
                list: incidents,
            },
            guards: {
                shiftsCompleted: guardCompliance.length,
                compliance: guardCompliance,
            },
            credentials: {
                activePasses: activePassCount,
                anomalies: anomalyFlags,
            },
            generatedAt: new Date(),
            generatedBy: req.user.userId,
        };
        await (0, audit_util_1.auditLog)(req.user.userId, 'GENERATE_REPORT', 'Report', `${year}-${month}`);
        // Stream PDF to response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=security-report-${year}-${month}.pdf`);
        const pdfStream = (0, pdf_util_1.generateMonthlyPDF)(reportData);
        pdfStream.pipe(res);
    }
    catch (err) {
        next(err);
    }
};
exports.generateMonthlyReport = generateMonthlyReport;
const groupBy = (arr, key) => arr.reduce((acc, item) => {
    const k = item[key];
    acc[k] = (acc[k] || 0) + 1;
    return acc;
}, {});
//# sourceMappingURL=report.controller.js.map