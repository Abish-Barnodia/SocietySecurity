"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkVehicle = exports.registerVehicle = exports.getParkingSlots = exports.updateParkingCapacity = exports.getVehicleLog = exports.getParkingSummary = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const alert_util_1 = require("../../utils/alert.util");
const parking_util_1 = require("../../utils/parking.util");
// ponytail: no per-entry "expected duration" is tracked today, so overstay is
// a flat threshold per vehicle type rather than derived from a real booking
// window. Swap for Pass.validUntil (or a stored expected-duration) if that
// becomes available.
const OVERSTAY_THRESHOLD_MIN = {
    DELIVERY: 30,
    CONTRACTOR: 240,
    VISITOR: 240,
};
const formatDuration = (mins) => {
    const m = Math.max(0, mins);
    return m < 60 ? `${m} min` : `${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? '' : 's'}`;
};
const getResidentVehicleRegs = async (propertyId) => {
    const vehicles = await prisma_1.prisma.vehicle.findMany({
        where: { unit: { propertyId }, isResident: true, isActive: true },
        select: { registrationNo: true, make: true, model: true, color: true },
    });
    return new Map(vehicles.map((v) => [v.registrationNo.toUpperCase(), { make: v.make, model: v.model, color: v.color }]));
};
const shapeVehicleEntry = (entry, residentRegs) => {
    const plate = (entry.vehicleNumber || '').toUpperCase();
    const residentVehicle = residentRegs.get(plate);
    const type = residentVehicle ? 'Resident'
        : entry.pass?.type === 'DELIVERY' ? 'Delivery'
            : entry.pass?.type === 'CONTRACTOR' ? 'Service'
                : 'Visitor';
    const isPresent = !entry.exitAt;
    const elapsedMin = Math.round((Date.now() - new Date(entry.entryAt).getTime()) / 60000);
    const threshold = OVERSTAY_THRESHOLD_MIN[type === 'Delivery' ? 'DELIVERY' : type === 'Service' ? 'CONTRACTOR' : 'VISITOR'];
    const overstay = type !== 'Resident' && isPresent && elapsedMin >= threshold;
    const vehicleDetails = residentVehicle
        ? [residentVehicle.color, residentVehicle.make, residentVehicle.model].filter(Boolean).join(' ') || null
        : null;
    return {
        id: entry.id,
        plate: entry.vehicleNumber,
        type,
        ownerName: entry.unit?.residents?.[0]?.name ?? 'Unknown',
        unit: entry.unit ? `${entry.unit.tower ? entry.unit.tower + '-' : ''}${entry.unit.unitNumber}` : 'N/A',
        phone: entry.visitorPhone ?? null,
        vehicleDetails,
        entryAt: entry.entryAt,
        exitAt: entry.exitAt,
        status: isPresent ? 'present' : 'exited',
        duration: type === 'Resident' || !isPresent ? null : formatDuration(elapsedMin),
        overstay,
        passCode: entry.passId ? `PASS-${entry.passId.slice(-4).toUpperCase()}` : null,
    };
};
const entryVehicleInclude = {
    unit: { select: { unitNumber: true, tower: true, residents: { where: { isPrimary: true }, select: { name: true }, take: 1 } } },
    pass: { select: { id: true, type: true } },
};
const getParkingSummary = async (req, res, next) => {
    try {
        const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
        if (!manager)
            return next(new error_middleware_1.AppError('Manager profile not found', 404));
        const property = await prisma_1.prisma.property.findUnique({ where: { id: manager.propertyId } });
        if (!property)
            return next(new error_middleware_1.AppError('Property not found', 404));
        const presentEntries = await prisma_1.prisma.entry.findMany({
            where: { unit: { propertyId: manager.propertyId }, vehicleNumber: { not: null }, exitAt: null },
            include: entryVehicleInclude,
            orderBy: { entryAt: 'desc' },
        });
        const residentRegs = await getResidentVehicleRegs(manager.propertyId);
        const currentlyPresent = presentEntries.map((e) => shapeVehicleEntry(e, residentRegs));
        const residentOccupied = currentlyPresent.filter((e) => e.type === 'Resident').length;
        const visitorOccupied = currentlyPresent.length - residentOccupied;
        const overstays = currentlyPresent.filter((e) => e.overstay).length;
        const totalSlots = property.residentParkingSlots + property.visitorParkingSlots;
        const availableSlots = Math.max(0, totalSlots - currentlyPresent.length);
        (0, response_util_1.sendSuccess)(res, 200, 'Parking summary fetched', {
            residentOccupied,
            residentTotal: property.residentParkingSlots,
            visitorOccupied,
            visitorTotal: property.visitorParkingSlots,
            overstays,
            availableSlots,
            currentlyPresent,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getParkingSummary = getParkingSummary;
const getVehicleLog = async (req, res, next) => {
    try {
        const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
        if (!manager)
            return next(new error_middleware_1.AppError('Manager profile not found', 404));
        const entries = await prisma_1.prisma.entry.findMany({
            where: { unit: { propertyId: manager.propertyId }, vehicleNumber: { not: null } },
            include: entryVehicleInclude,
            orderBy: { entryAt: 'desc' },
            take: 100,
        });
        const residentRegs = await getResidentVehicleRegs(manager.propertyId);
        (0, response_util_1.sendSuccess)(res, 200, 'Vehicle log fetched', entries.map((e) => shapeVehicleEntry(e, residentRegs)));
    }
    catch (err) {
        next(err);
    }
};
exports.getVehicleLog = getVehicleLog;
const updateParkingCapacity = async (req, res, next) => {
    try {
        const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
        if (!manager)
            return next(new error_middleware_1.AppError('Manager profile not found', 404));
        const { residentParkingSlots, visitorParkingSlots } = req.body;
        const updated = await prisma_1.prisma.property.update({
            where: { id: manager.propertyId },
            data: { residentParkingSlots, visitorParkingSlots },
        });
        await (0, parking_util_1.syncParkingSlots)(manager.propertyId, residentParkingSlots + visitorParkingSlots);
        (0, response_util_1.sendSuccess)(res, 200, 'Parking capacity updated', updated);
    }
    catch (err) {
        next(err);
    }
};
exports.updateParkingCapacity = updateParkingCapacity;
const getParkingSlots = async (req, res, next) => {
    try {
        const manager = await prisma_1.prisma.manager.findUnique({ where: { userId: req.user.userId } });
        if (!manager)
            return next(new error_middleware_1.AppError('Manager profile not found', 404));
        const slots = await prisma_1.prisma.parkingSlot.findMany({
            where: { propertyId: manager.propertyId },
            orderBy: { code: 'asc' },
            include: { entry: { include: entryVehicleInclude } },
        });
        const residentRegs = await getResidentVehicleRegs(manager.propertyId);
        (0, response_util_1.sendSuccess)(res, 200, 'Parking slots fetched', slots.map((s) => ({
            id: s.id,
            code: s.code,
            zone: s.zone,
            vehicle: s.entry ? shapeVehicleEntry(s.entry, residentRegs) : null,
        })));
    }
    catch (err) {
        next(err);
    }
};
exports.getParkingSlots = getParkingSlots;
const registerVehicle = async (req, res, next) => {
    try {
        const { registrationNo, make, model, color } = req.body;
        // We assume the user is a resident for this route based on RBAC
        const resident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const unitId = resident.unitId;
        const existing = await prisma_1.prisma.vehicle.findFirst({
            where: { unitId, registrationNo: registrationNo.toUpperCase() },
        });
        if (existing)
            return next(new error_middleware_1.AppError('Vehicle already registered to this unit', 409));
        const vehicle = await prisma_1.prisma.vehicle.create({
            data: {
                unitId,
                registrationNo: registrationNo.toUpperCase(),
                make,
                model,
                color,
                isResident: true,
            },
        });
        (0, response_util_1.sendSuccess)(res, 201, 'Vehicle registered', vehicle);
    }
    catch (err) {
        next(err);
    }
};
exports.registerVehicle = registerVehicle;
const checkVehicle = async (req, res, next) => {
    try {
        // Called by guard on ANPR match or manual plate lookup
        const registrationNo = req.params.registrationNo;
        const propertyId = req.user.propertyId;
        if (!propertyId)
            return next(new error_middleware_1.AppError('Guard not found', 404));
        const vehicle = await prisma_1.prisma.vehicle.findFirst({
            where: {
                registrationNo: registrationNo.toUpperCase(),
                unit: { propertyId },
                isActive: true,
            },
            include: { unit: { include: { residents: { where: { isPrimary: true } } } } },
        });
        if (!vehicle) {
            // Unregistered — fire P2 alert
            await (0, alert_util_1.triggerAlert)({
                priority: 'P2',
                title: 'Unregistered vehicle',
                body: `Vehicle ${registrationNo.toUpperCase()} is not in the registry`,
                targetRoles: ['MANAGER'],
                propertyId,
            });
            return (0, response_util_1.sendSuccess)(res, 200, 'Unregistered', { registered: false, registrationNo });
        }
        (0, response_util_1.sendSuccess)(res, 200, 'Registered', {
            registered: true,
            vehicle,
            unit: vehicle.unit.unitNumber,
            resident: vehicle.unit.residents[0]?.name,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.checkVehicle = checkVehicle;
//# sourceMappingURL=vehicle.controller.js.map