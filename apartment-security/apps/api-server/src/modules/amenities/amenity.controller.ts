import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';

export const getAmenities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let propertyId: string | undefined;

    if (req.user!.role === 'RESIDENT') {
      const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId }, include: { unit: true } });
      if (!resident) return next(new AppError('Resident not found', 404));
      propertyId = resident.unit.propertyId;
    } else {
      const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
      propertyId = manager?.propertyId;
    }
    if (!propertyId) return next(new AppError('No property context found', 400));

    let amenities = await prisma.amenity.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });

    if (amenities.length === 0) {
      await prisma.amenity.createMany({
        data: [
          { propertyId, name: 'Fitness Gym', capacity: 15, openTime: '06:00', closeTime: '22:00', status: 'AVAILABLE' },
          { propertyId, name: 'Swimming Pool', capacity: 20, openTime: '07:00', closeTime: '21:00', status: 'AVAILABLE' },
          { propertyId, name: 'Clubhouse Hall', capacity: 50, openTime: '09:00', closeTime: '23:00', status: 'AVAILABLE' },
          { propertyId, name: 'Tennis Court', capacity: 4, openTime: '06:00', closeTime: '20:00', status: 'AVAILABLE' },
          { propertyId, name: 'Badminton Court', capacity: 4, openTime: '06:00', closeTime: '22:00', status: 'AVAILABLE' },
        ],
      });
      amenities = await prisma.amenity.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (req.user!.role === 'RESIDENT') {
      amenities = amenities.filter((a) => a.status === 'AVAILABLE');
    }

    sendSuccess(res, 200, 'Amenities fetched', amenities);
  } catch (err) { next(err); }
};

export const createAmenity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    if (!manager) return next(new AppError('Manager profile not found', 404));

    const { name, capacity, openTime, closeTime, status } = req.body;
    const amenity = await prisma.amenity.create({
      data: { propertyId: manager.propertyId, name, capacity, openTime, closeTime, status: status ?? 'AVAILABLE' },
    });
    sendSuccess(res, 201, 'Amenity created', amenity);
  } catch (err) { next(err); }
};

export const updateAmenity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    if (!manager) return next(new AppError('Manager profile not found', 404));

    const amenity = await prisma.amenity.findUnique({ where: { id } });
    if (!amenity || amenity.propertyId !== manager.propertyId) return next(new AppError('Amenity not found', 404));

    const { name, capacity, openTime, closeTime, status } = req.body;
    const updated = await prisma.amenity.update({
      where: { id },
      data: { name, capacity, openTime, closeTime, status },
    });
    sendSuccess(res, 200, 'Amenity updated', updated);
  } catch (err) { next(err); }
};

export const bookAmenity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amenityId, date, startTime, endTime } = req.body;
    
    const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
    if (!resident) return next(new AppError('Resident not found', 404));
    
    const residentId = resident.id;

    const amenity = await prisma.amenity.findUnique({ where: { id: amenityId } });
    if (!amenity) return next(new AppError('Amenity not found', 404));
    if (amenity.status !== 'AVAILABLE') return next(new AppError('Amenity not available', 400));

    // Check capacity: count overlapping bookings
    const overlapping = await prisma.amenityBooking.count({
      where: {
        amenityId,
        date: new Date(date),
        status: 'CONFIRMED',
        OR: [
          { startTime: { lte: endTime }, endTime: { gte: startTime } },
        ],
      },
    });
    if (overlapping >= amenity.capacity) {
      return next(new AppError('Amenity is fully booked for this time slot', 409));
    }

    const booking = await prisma.amenityBooking.create({
      data: { amenityId, residentId, date: new Date(date), startTime, endTime },
    });

    sendSuccess(res, 201, 'Amenity booked', booking);
  } catch (err) { next(err); }
};

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    
    const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
    if (!resident) return next(new AppError('Resident not found', 404));

    const booking = await prisma.amenityBooking.findUnique({ where: { id } });
    if (!booking || booking.residentId !== resident.id) {
      return next(new AppError('Booking not found', 404));
    }
    if (booking.status !== 'CONFIRMED') return next(new AppError('Booking already cancelled', 400));

    await prisma.amenityBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    sendSuccess(res, 200, 'Booking cancelled');
  } catch (err) { next(err); }
};
