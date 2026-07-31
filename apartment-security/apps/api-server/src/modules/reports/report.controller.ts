import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { generateMonthlyPDF } from '../../utils/pdf.util';
import { auditLog } from '../../utils/audit.util';
import { AppError } from '../../middlewares/error.middleware';
import { getCallerPropertyId } from '../../utils/residentContext.util';
import { SLA_MINUTES } from '../../jobs/alertEscalation.job';

export const getOperationsOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { manager: true, committee: true }
    });

    // Quick fix: For now we assume Manager
    if (!user?.manager) return next(new AppError('Only managers can access this', 403));
    const pId = user.manager.propertyId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalEntriesToday,
      activeVisitors,
      guardsOnDuty,
      openIncidents,
      unacknowledgedAlerts,
      pendingWalkins,
    ] = await Promise.all([
      prisma.entry.count({ where: { unit: { propertyId: pId }, entryAt: { gte: today }, status: 'APPROVED' } }),
      prisma.entry.count({ where: { unit: { propertyId: pId }, status: 'APPROVED', exitAt: null } }),
      prisma.guard.count({ where: { propertyId: pId, isOnDuty: true } }),
      prisma.incident.count({ where: { propertyId: pId, status: { not: 'CLOSED' } } }),
      prisma.alert.count({ where: { propertyId: pId, status: 'SENT', priority: { in: ['P1', 'P2'] } } }),
      prisma.walkinApproval.count({
        where: {
          entry: { unit: { propertyId: pId } },
          respondedAt: null,
          timeoutAt: { gt: new Date() },
        },
      }),
    ]);

    sendSuccess(res, 200, 'Operations overview fetched', {
      totalEntriesToday,
      activeVisitors,
      guardsOnDuty,
      openIncidents,
      unacknowledgedAlerts,
      pendingWalkins,
      generatedAt: new Date(),
    });
  } catch (err) { next(err); }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);

    const logs = await prisma.auditLog.findMany({
      where: {
        user: {
          OR: [
            { manager: { propertyId } },
            { guard: { propertyId } },
            { resident: { unit: { propertyId } } },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            role: true,
            manager: { select: { name: true } },
            guard: { select: { name: true } },
            resident: { select: { name: true } },
          },
        },
      },
    });

    const data = logs.map(({ user, ...log }) => ({
      ...log,
      actorName: user.manager?.name ?? user.guard?.name ?? user.resident?.name ?? 'Unknown',
      actorRole: user.role,
    }));

    sendSuccess(res, 200, 'Audit logs retrieved', data);
  } catch (err) { next(err); }
};

const computeMonthlyReportData = async (propertyId: string, month: string, year: string) => {
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const [
      property,
      totalEntries,
      digitalEntries,
      incidents,
      guardCompliance,
      activePassCount,
      anomalyFlags,
    ] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId } }),
      prisma.entry.count({
        where: { unit: { propertyId }, entryAt: { gte: startDate, lte: endDate }, status: 'APPROVED' },
      }),
      prisma.entry.count({
        where: {
          unit: { propertyId },
          entryAt: { gte: startDate, lte: endDate },
          status: 'APPROVED',
          method: { in: ['QR_SCAN', 'OTP'] },
        },
      }),
      prisma.incident.findMany({
        where: { propertyId, createdAt: { gte: startDate, lte: endDate } },
        include: { actions: { orderBy: { createdAt: 'desc' } } },
      }),
      prisma.shift.findMany({
        where: {
          guard: { propertyId },
          startedAt: { gte: startDate, lte: endDate },
          signedOffAt: { not: null },
        },
        include: { guard: true },
      }),
      prisma.pass.count({ where: { unit: { propertyId }, status: 'ACTIVE' } }),
      prisma.pass.findMany({
        where: {
          unit: { propertyId },
          status: { in: ['ACTIVE', 'SUSPENDED'] },
          validUntil: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        },
        include: { unit: true, resident: true },
      }),
    ]);

    const reportData = {
      property: property!,
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
    };

    return reportData;
};

export const generateMonthlyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    if (!month || !year) return next(new AppError('month and year are required', 400));

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { manager: true }
    });
    if (!user?.manager) return next(new AppError('Only managers can generate reports', 403));

    const reportData = await computeMonthlyReportData(user.manager.propertyId, month, year);
    await auditLog(req.user!.userId, 'GENERATE_REPORT', 'Report', `${year}-${month}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=security-report-${year}-${month}.pdf`);

    const pdfStream = generateMonthlyPDF(reportData);
    pdfStream.pipe(res);
  } catch (err) { next(err); }
};

export const getMonthlyReportSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    if (!month || !year) return next(new AppError('month and year are required', 400));

    const propertyId = await getCallerPropertyId(req.user!.userId);
    const { incidents, ...reportData } = await computeMonthlyReportData(propertyId, month, year);
    const { list, ...incidentsSummary } = incidents;

    sendSuccess(res, 200, 'Monthly report summary fetched', { ...reportData, incidents: incidentsSummary });
  } catch (err) { next(err); }
};

export const getComplianceMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [acknowledgedAlerts, allAlerts, p1Alerts, shiftsTotal, shiftsHandedOver] = await Promise.all([
      prisma.alert.count({ where: { propertyId, createdAt: { gte: since }, acknowledgedAt: { not: null } } }),
      prisma.alert.count({ where: { propertyId, createdAt: { gte: since } } }),
      prisma.alert.findMany({
        where: { propertyId, priority: 'P1', createdAt: { gte: since } },
        select: { createdAt: true, acknowledgedAt: true },
      }),
      prisma.shift.count({ where: { guard: { propertyId }, startedAt: { gte: since }, signedOffAt: { not: null } } }),
      prisma.shift.count({ where: { guard: { propertyId }, startedAt: { gte: since }, signedOffAt: { not: null }, handedOverToId: { not: null } } }),
    ]);

    const p1WithinSla = p1Alerts.filter((a) => {
      if (!a.acknowledgedAt) return false;
      const minutes = (a.acknowledgedAt.getTime() - a.createdAt.getTime()) / 60000;
      return minutes <= SLA_MINUTES.P1;
    }).length;

    sendSuccess(res, 200, 'Compliance metrics fetched', {
      periodDays: 30,
      alertAcknowledgementRate: allAlerts ? Math.round((acknowledgedAlerts / allAlerts) * 100) : null,
      p1SlaComplianceRate: p1Alerts.length ? Math.round((p1WithinSla / p1Alerts.length) * 100) : null,
      p1SlaMinutes: SLA_MINUTES.P1,
      shiftHandoverCompletionRate: shiftsTotal ? Math.round((shiftsHandedOver / shiftsTotal) * 100) : null,
      shiftsCompleted: shiftsTotal,
      alertsTotal: allAlerts,
      p1AlertsTotal: p1Alerts.length,
    });
  } catch (err) { next(err); }
};

const groupBy = <T extends Record<string, any>>(arr: T[], key: string) =>
  arr.reduce((acc, item) => {
    const k = item[key];
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
