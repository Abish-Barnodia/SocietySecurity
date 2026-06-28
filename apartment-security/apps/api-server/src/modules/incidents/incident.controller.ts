import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { triggerAlert } from '../../utils/alert.util';
import { auditLog } from '../../utils/audit.util';
import { io } from '../../server';
import { Role } from '@prisma/client';

export const createIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, description, location, photoUrls, vehicleNumber, unitId } = req.body;
    const guardId = req.user!.guardId!;

    const guard = await prisma.guard.findUnique({ where: { id: guardId } });
    if (!guard) return next(new AppError('Guard not found', 404));

    const incident = await prisma.incident.create({
      data: {
        propertyId: guard.propertyId,
        guardId,
        unitId,
        type,
        description,
        location,
        photoUrls: photoUrls ?? [],
        vehicleNumber,
        status: 'OPEN',
      },
    });

    // Create first timeline action
    await prisma.incidentAction.create({
      data: {
        incidentId: incident.id,
        actorId: req.user!.userId,
        actorRole: 'GUARD',
        action: 'INCIDENT_LOGGED',
        note: description,
      },
    });

    // Alert managers with P2
    await triggerAlert({
      priority: 'P2',
      title: `Incident: ${type.replace(/_/g, ' ')}`,
      body: `Logged by guard at ${location}. ${description.slice(0, 80)}`,
      targetRoles: ['MANAGER'],
      incidentId: incident.id,
      propertyId: guard.propertyId,
    });

    io?.to(`property:${guard.propertyId}`).emit('incident:new', {
      incidentId: incident.id,
      type,
      location,
      guardId,
    });

    sendSuccess(res, 201, 'Incident logged', incident);
  } catch (err) { next(err); }
};

export const assignIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { assignedTo, note } = req.body;

    const incident = await prisma.incident.findUnique({ where: { id } });
    
    // Authorization
    if (!incident) return next(new AppError('Incident not found', 404));

    const updated = await prisma.incident.update({
      where: { id },
      data: { assignedTo, assignedAt: new Date(), status: 'IN_PROGRESS' },
    });

    await prisma.incidentAction.create({
      data: {
        incidentId: id,
        actorId: req.user!.userId,
        actorRole: req.user!.role as Role,
        action: 'ASSIGNED',
        note,
      },
    });

    // Notify the assigned guard
    const assignee = await prisma.guard.findUnique({
      where: { id: assignedTo },
      include: { user: { select: { fcmTokens: true } } },
    });
    
    if (assignee?.user.fcmTokens.length) {
      const { sendPush } = await import('../../utils/push.util');
      await sendPush(assignee.user.fcmTokens, {
        title: 'Incident assigned to you',
        body: `${incident.type.replace(/_/g, ' ')} at ${incident.location}`,
        data: { type: 'INCIDENT_ASSIGNMENT', incidentId: id },
      });
    }

    sendSuccess(res, 200, 'Incident assigned', updated);
  } catch (err) { next(err); }
};

export const escalateIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { note } = req.body;

    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) return next(new AppError('Incident not found', 404));

    await prisma.incidentAction.create({
      data: {
        incidentId: id,
        actorId: req.user!.userId,
        actorRole: req.user!.role as Role,
        action: 'ESCALATED_TO_P1',
        note,
      },
    });

    await triggerAlert({
      priority: 'P1',
      title: 'Incident escalated to P1',
      body: `${incident.type.replace(/_/g, ' ')} at ${incident.location}. ${note ?? ''}`,
      targetRoles: ['MANAGER', 'COMMITTEE'],
      incidentId: id,
      propertyId: incident.propertyId,
    });

    sendSuccess(res, 200, 'Incident escalated to P1');
  } catch (err) { next(err); }
};

export const closeIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { resolutionNote } = req.body;

    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) return next(new AppError('Incident not found', 404));
    
    if (incident.status === 'CLOSED') return next(new AppError('Already closed', 400));

    const updated = await prisma.incident.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user!.userId, resolutionNote },
    });

    await prisma.incidentAction.create({
      data: {
        incidentId: id,
        actorId: req.user!.userId,
        actorRole: req.user!.role as Role,
        action: 'CLOSED',
        note: resolutionNote,
      },
    });

    await auditLog(req.user!.userId, 'CLOSE_INCIDENT', 'Incident', id);

    sendSuccess(res, 200, 'Incident closed', updated);
  } catch (err) { next(err); }
};
