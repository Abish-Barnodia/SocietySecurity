import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';

export const getAmenities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resident = await prisma.resident.findUnique({ where: { userId: req.user!.userId } });
    if (!resident) return next(new AppError('Resident not found', 404));

    const unitId = resident.unitId;
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) return next(new AppError('Unit not found', 404));

    const amenities = await prisma.amenity.findMany({
      where: { propertyId: unit.propertyId, status: 'AVAILABLE' },
    });
    sendSuccess(res, 200, 'Amenities fetched', amenities);
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
