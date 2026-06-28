"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelBooking = exports.bookAmenity = exports.getAmenities = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const getAmenities = async (req, res, next) => {
    try {
        const resident = await prisma_1.prisma.resident.findUnique({ where: { userId: req.user.userId } });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const unitId = resident.unitId;
        const unit = await prisma_1.prisma.unit.findUnique({ where: { id: unitId } });
        if (!unit)
            return next(new error_middleware_1.AppError('Unit not found', 404));
        const amenities = await prisma_1.prisma.amenity.findMany({
            where: { propertyId: unit.propertyId, status: 'AVAILABLE' },
        });
        (0, response_util_1.sendSuccess)(res, 200, 'Amenities fetched', amenities);
    }
    catch (err) {
        next(err);
    }
};
exports.getAmenities = getAmenities;
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