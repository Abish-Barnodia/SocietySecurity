"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkVehicle = exports.registerVehicle = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const alert_util_1 = require("../../utils/alert.util");
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
        const guardId = req.user.guardId;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { id: guardId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard not found', 404));
        const vehicle = await prisma_1.prisma.vehicle.findFirst({
            where: {
                registrationNo: registrationNo.toUpperCase(),
                unit: { propertyId: guard.propertyId },
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
                propertyId: guard.propertyId,
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