import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { getCallerPropertyId } from '../../utils/residentContext.util';

// Get all events for the property — residents get their own RSVP status on
// each event; managers/committee (no RSVP of their own) just get the counts.
export const getEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);
    const resident = req.user!.role === 'RESIDENT'
      ? await prisma.resident.findUnique({ where: { userId: req.user!.userId } })
      : null;

    const { status } = req.query;
    const where: any = { propertyId };
    if (status) where.status = status;

    const events = await prisma.event.findMany({
      where,
      include: {
        rsvps: resident ? { where: { residentId: resident.id }, select: { status: true } } : false,
        _count: { select: { rsvps: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return sendSuccess(res, 200, 'Events fetched', events);
  } catch (err) { next(err); }
};

// RSVP to an event
export const rsvpEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id as string;
    const { status = 'GOING' } = req.body;

    const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
    if (!resident) return next(new AppError('Resident not found', 404));

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return next(new AppError('Event not found', 404));

    const rsvp = await prisma.eventRSVP.upsert({
      where: { eventId_residentId: { eventId, residentId: resident.id } },
      create: { eventId, residentId: resident.id, status },
      update: { status },
    });

    return sendSuccess(res, 200, 'RSVP updated', rsvp);
  } catch (err) { next(err); }
};

// Manager: Create event
export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, location, startDate, endDate, status = 'UPCOMING' } = req.body;

    // Get the manager's property
    const manager = await prisma.manager.findUnique({
      where: { userId: req.user!.userId },
      select: { propertyId: true },
    });
    if (!manager) return next(new AppError('Manager not found', 404));

    const event = await prisma.event.create({
      data: {
        propertyId: manager.propertyId,
        title,
        description,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        organizerId: req.user!.userId,
        status,
      },
    });

    const io = req.app.get('io');
    io?.to(`property:${manager.propertyId}`).emit('event:new', event);

    return sendSuccess(res, 201, 'Event created', event);
  } catch (err) { next(err); }
};

// Manager: Update event
export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { title, description, location, startDate, endDate, status } = req.body;

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(location !== undefined && { location }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
      },
    });

    const io = req.app.get('io');
    io?.to(`property:${event.propertyId}`).emit('event:update', event);
    return sendSuccess(res, 200, 'Event updated', event);
  } catch (err) { next(err); }
};
