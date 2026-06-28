"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnitSummary = exports.deactivateResident = exports.onboardResident = exports.getAllResidents = exports.removeHouseholdMember = exports.addHouseholdMember = exports.getUnitResidents = exports.updateAlertPreferences = exports.updateMyProfile = exports.getMyProfile = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const getMyProfile = async (req, res, next) => {
    try {
        const resident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId },
            include: {
                unit: { include: { property: true } },
                user: { select: { phone: true, email: true, fcmTokens: true } },
            },
        });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident profile not found', 404));
        return (0, response_util_1.sendSuccess)(res, 200, 'Profile fetched successfully', resident);
    }
    catch (err) {
        next(err);
    }
};
exports.getMyProfile = getMyProfile;
const updateMyProfile = async (req, res, next) => {
    try {
        const { name, emergencyContact, emergencyContactName } = req.body;
        // First find the resident using userId
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const resident = await prisma_1.prisma.resident.update({
            where: { id: currentResident.id },
            data: { name, emergencyContact, emergencyContactName },
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'UPDATE_PROFILE', 'Resident', resident.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Profile updated successfully', resident);
    }
    catch (err) {
        next(err);
    }
};
exports.updateMyProfile = updateMyProfile;
const updateAlertPreferences = async (req, res, next) => {
    try {
        const { preferences } = req.body;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const resident = await prisma_1.prisma.resident.update({
            where: { id: currentResident.id },
            data: { alertPreferences: preferences },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Alert preferences updated', resident.alertPreferences);
    }
    catch (err) {
        next(err);
    }
};
exports.updateAlertPreferences = updateAlertPreferences;
const getUnitResidents = async (req, res, next) => {
    try {
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const residents = await prisma_1.prisma.resident.findMany({
            where: { unitId: currentResident.unitId },
            include: { user: { select: { phone: true } } }
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Unit residents fetched', residents);
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitResidents = getUnitResidents;
const addHouseholdMember = async (req, res, next) => {
    try {
        // Assume resident can add another resident to their unit. The added user might need an OTP to verify phone later.
        const { name, phone, isPrimary } = req.body;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        if (!currentResident.isPrimary)
            return next(new error_middleware_1.AppError('Only primary residents can add members', 403));
        // Ensure user doesn't already exist
        let user = await prisma_1.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await prisma_1.prisma.user.create({
                data: {
                    phone,
                    role: 'RESIDENT',
                }
            });
        }
        else if (user.role !== 'RESIDENT') {
            return next(new error_middleware_1.AppError('User exists with a different role', 400));
        }
        const newResident = await prisma_1.prisma.resident.create({
            data: {
                userId: user.id,
                unitId: currentResident.unitId,
                name,
                isPrimary: isPrimary || false
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'ADD_HOUSEHOLD_MEMBER', 'Resident', newResident.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Household member added successfully', newResident);
    }
    catch (err) {
        next(err);
    }
};
exports.addHouseholdMember = addHouseholdMember;
const removeHouseholdMember = async (req, res, next) => {
    try {
        const memberId = req.params.memberId;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        if (!currentResident.isPrimary)
            return next(new error_middleware_1.AppError('Only primary residents can remove members', 403));
        const memberToRemove = await prisma_1.prisma.resident.findUnique({ where: { id: memberId } });
        if (!memberToRemove || memberToRemove.unitId !== currentResident.unitId) {
            return next(new error_middleware_1.AppError('Member not found in your unit', 404));
        }
        await prisma_1.prisma.resident.delete({ where: { id: memberId } });
        await prisma_1.prisma.user.update({
            where: { id: memberToRemove.userId },
            data: { isActive: false }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'REMOVE_HOUSEHOLD_MEMBER', 'Resident', memberId);
        return (0, response_util_1.sendSuccess)(res, 200, 'Household member removed successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.removeHouseholdMember = removeHouseholdMember;
const getAllResidents = async (req, res, next) => {
    try {
        const residents = await prisma_1.prisma.resident.findMany({
            include: { unit: true, user: { select: { phone: true, isActive: true } } }
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'All residents fetched', residents);
    }
    catch (err) {
        next(err);
    }
};
exports.getAllResidents = getAllResidents;
const onboardResident = async (req, res, next) => {
    try {
        const { name, phone, unitId, isPrimary } = req.body;
        // Check unit
        const unit = await prisma_1.prisma.unit.findUnique({ where: { id: unitId } });
        if (!unit)
            return next(new error_middleware_1.AppError('Unit not found', 404));
        // Create user
        let user = await prisma_1.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await prisma_1.prisma.user.create({
                data: { phone, role: 'RESIDENT' }
            });
        }
        const resident = await prisma_1.prisma.resident.create({
            data: {
                userId: user.id,
                unitId,
                name,
                isPrimary
            }
        });
        // Mark unit as occupied
        if (!unit.isOccupied) {
            await prisma_1.prisma.unit.update({
                where: { id: unitId },
                data: { isOccupied: true }
            });
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'ONBOARD_RESIDENT', 'Resident', resident.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Resident onboarded successfully', resident);
    }
    catch (err) {
        next(err);
    }
};
exports.onboardResident = onboardResident;
const deactivateResident = async (req, res, next) => {
    try {
        const id = req.params.id;
        const resident = await prisma_1.prisma.resident.findUnique({ where: { id } });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        await prisma_1.prisma.user.update({
            where: { id: resident.userId },
            data: { isActive: false }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'DEACTIVATE_RESIDENT', 'Resident', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Resident deactivated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deactivateResident = deactivateResident;
const getUnitSummary = async (req, res, next) => {
    try {
        const id = req.params.id; // resident id
        const resident = await prisma_1.prisma.resident.findUnique({
            where: { id },
            include: { unit: { include: { vehicles: true } } }
        });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        return (0, response_util_1.sendSuccess)(res, 200, 'Unit summary fetched', resident.unit);
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitSummary = getUnitSummary;
//# sourceMappingURL=resident.controller.js.map