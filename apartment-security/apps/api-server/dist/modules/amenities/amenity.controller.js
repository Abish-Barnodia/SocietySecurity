"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelBooking = exports.bookAmenity = exports.updateAmenity = exports.createAmenity = exports.getAmenities = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const getAmenities = async (req, res, next) => {
    try {
        let propertyId;
        if (req.user.role === 'RESIDENT') {
            const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId }, include: { unit: true } });
            if (!resident)
                return next(new error_middleware_1.AppError('Resident not found', 404));
            propertyId = resident.unit.propertyId;
        }
        else {
            const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
            propertyId = manager?.propertyId;
        }
        if (!propertyId)
            return next(new error_middleware_1.AppError('No property context found', 400));
        let amenities = await prisma_1.prisma.amenity.findMany({
            where: { propertyId },
            orderBy: { createdAt: 'desc' },
        });
        if (amenities.length === 0) {
            await prisma_1.prisma.amenity.createMany({
                data: [
                    { propertyId, name: 'Fitness Gym', capacity: 15, openTime: '06:00', closeTime: '22:00', status: 'AVAILABLE' },
                    { propertyId, name: 'Swimming Pool', capacity: 20, openTime: '07:00', closeTime: '21:00', status: 'AVAILABLE' },
                    { propertyId, name: 'Clubhouse Hall', capacity: 50, openTime: '09:00', closeTime: '23:00', status: 'AVAILABLE' },
                    { propertyId, name: 'Tennis Court', capacity: 4, openTime: '06:00', closeTime: '20:00', status: 'AVAILABLE' },
                    { propertyId, name: 'Badminton Court', capacity: 4, openTime: '06:00', closeTime: '22:00', status: 'AVAILABLE' },
                ],
            });
            amenities = await prisma_1.prisma.amenity.findMany({
                where: { propertyId },
                orderBy: { createdAt: 'desc' },
            });
        }
        if (req.user.role === 'RESIDENT') {
            amenities = amenities.filter((a) => a.status === 'AVAILABLE');
        }
        (0, response_util_1.sendSuccess)(res, 200, 'Amenities fetched', amenities);
    }
    catch (err) {
        next(err);
    }
};
exports.getAmenities = getAmenities;
const createAmenity = async (req, res, next) => {
    try {
        const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
        if (!manager)
            return next(new error_middleware_1.AppError('Manager profile not found', 404));
        const { name, capacity, openTime, closeTime, status } = req.body;
        const amenity = await prisma_1.prisma.amenity.create({
            data: { propertyId: manager.propertyId, name, capacity, openTime, closeTime, status: status ?? 'AVAILABLE' },
        });
        (0, response_util_1.sendSuccess)(res, 201, 'Amenity created', amenity);
    }
    catch (err) {
        next(err);
    }
};
exports.createAmenity = createAmenity;
const updateAmenity = async (req, res, next) => {
    try {
        const id = req.params.id;
        const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
        if (!manager)
            return next(new error_middleware_1.AppError('Manager profile not found', 404));
        const amenity = await prisma_1.prisma.amenity.findUnique({ where: { id } });
        if (!amenity || amenity.propertyId !== manager.propertyId)
            return next(new error_middleware_1.AppError('Amenity not found', 404));
        const { name, capacity, openTime, closeTime, status } = req.body;
        const updated = await prisma_1.prisma.amenity.update({
            where: { id },
            data: { name, capacity, openTime, closeTime, status },
        });
        (0, response_util_1.sendSuccess)(res, 200, 'Amenity updated', updated);
    }
    catch (err) {
        next(err);
    }
};
exports.updateAmenity = updateAmenity;
const bookAmenity = async (req, res, next) => {
    try {
        const { amenityId, date, startTime, endTime } = req.body;
        const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const residentId = resident.id;
        const amenity = await prisma_1.prisma.amenity.findUnique({ where: { id: amenityId } });
        if (!amenity)
            return next(new error_middleware_1.AppError('Amenity not found', 404));
        if (amenity.status !== 'AVAILABLE')
            return next(new error_middleware_1.AppError('Amenity not available', 400));
        // Check capacity: count overlapping bookings
        const overlapping = await prisma_1.prisma.amenityBooking.count({
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
            return next(new error_middleware_1.AppError('Amenity is fully booked for this time slot', 409));
        }
        const booking = await prisma_1.prisma.amenityBooking.create({
            data: { amenityId, residentId, date: new Date(date), startTime, endTime },
        });
        (0, response_util_1.sendSuccess)(res, 201, 'Amenity booked', booking);
    }
    catch (err) {
        next(err);
    }
};
exports.bookAmenity = bookAmenity;
const cancelBooking = async (req, res, next) => {
    try {
        const id = req.params.id;
        const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const booking = await prisma_1.prisma.amenityBooking.findUnique({ where: { id } });
        if (!booking || booking.residentId !== resident.id) {
            return next(new error_middleware_1.AppError('Booking not found', 404));
        }
        if (booking.status !== 'CONFIRMED')
            return next(new error_middleware_1.AppError('Booking already cancelled', 400));
        await prisma_1.prisma.amenityBooking.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
        (0, response_util_1.sendSuccess)(res, 200, 'Booking cancelled');
    }
    catch (err) {
        next(err);
    }
};
exports.cancelBooking = cancelBooking;
//# sourceMappingURL=amenity.controller.js.map