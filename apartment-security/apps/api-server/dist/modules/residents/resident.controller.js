"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnitSummary = exports.deactivateResident = exports.onboardHousehold = exports.onboardResident = exports.getAllResidents = exports.onboardSelf = exports.getUnitsByTower = exports.getTowers = exports.removeHouseholdMember = exports.addHouseholdMember = exports.getUnitResidents = exports.updateAlertPreferences = exports.updateMyProfile = exports.getMyProfile = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
        const { name, emergencyContact, emergencyContactName, showUnitInCommunity } = req.body;
        // First find the resident using userId
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const resident = await prisma_1.prisma.resident.update({
            where: { id: currentResident.id },
            data: { name, emergencyContact, emergencyContactName, showUnitInCommunity },
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
        else {
            const existingResident = await prisma_1.prisma.resident.findUnique({ where: { userId: user.id } });
            if (existingResident)
                return next(new error_middleware_1.AppError('User is already registered to a unit', 409));
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
const getTowers = async (_req, res, next) => {
    try {
        const units = await prisma_1.prisma.unit.findMany({
            where: { tower: { not: null } },
            distinct: ['tower'],
            select: { tower: true },
            orderBy: { tower: 'asc' },
        });
        const towers = units.map((u) => u.tower).filter((t) => !!t);
        return (0, response_util_1.sendSuccess)(res, 200, 'Towers fetched successfully', towers.length ? towers : ['Tower A']);
    }
    catch (err) {
        next(err);
    }
};
exports.getTowers = getTowers;
const getUnitsByTower = async (req, res, next) => {
    try {
        const tower = req.query.tower;
        if (!tower)
            return next(new error_middleware_1.AppError('tower query param is required', 400));
        const units = await prisma_1.prisma.unit.findMany({
            where: { tower },
            select: { id: true, unitNumber: true, tower: true },
            orderBy: { unitNumber: 'asc' },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Units fetched successfully', units);
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitsByTower = getUnitsByTower;
const onboardSelf = async (req, res, next) => {
    try {
        const { name, tower, flatNumber, type, vehicleNumber } = req.body;
        const userId = req.user.userId;
        const existing = await prisma_1.prisma.resident.findUnique({ where: { userId } });
        if (existing) {
            return next(new error_middleware_1.AppError('Your resident profile is already set up', 400));
        }
        let property = await prisma_1.prisma.property.findFirst();
        if (!property) {
            property = await prisma_1.prisma.property.create({
                data: { name: 'Default Property', address: 'Address', city: 'City', pincode: '000000', totalUnits: 100 },
            });
        }
        // Unit numbers are unique per property, so look up by that key rather than
        // by (tower, unitNumber) — otherwise creating a duplicate number in a
        // different tower violates @@unique([propertyId, unitNumber]).
        let unit = await prisma_1.prisma.unit.findUnique({
            where: { propertyId_unitNumber: { propertyId: property.id, unitNumber: flatNumber } },
        });
        if (!unit) {
            unit = await prisma_1.prisma.unit.create({
                data: {
                    unitNumber: flatNumber,
                    tower,
                    floor: 1,
                    propertyId: property.id,
                    isOccupied: true,
                },
            });
        }
        else if (unit.tower !== tower) {
            return next(new error_middleware_1.AppError(`Flat ${flatNumber} belongs to ${unit.tower}, not ${tower}`, 400));
        }
        const existingUnitResidents = await prisma_1.prisma.resident.count({ where: { unitId: unit.id } });
        const resident = await prisma_1.prisma.resident.create({
            data: {
                userId,
                unitId: unit.id,
                name,
                residentType: type || 'Owner',
                isPrimary: existingUnitResidents === 0,
            },
            include: { unit: { include: { property: true } } },
        });
        if (vehicleNumber) {
            await prisma_1.prisma.vehicle.create({
                data: {
                    unitId: unit.id,
                    registrationNo: vehicleNumber,
                    isResident: true,
                },
            });
        }
        if (!unit.isOccupied) {
            await prisma_1.prisma.unit.update({ where: { id: unit.id }, data: { isOccupied: true } });
        }
        await (0, audit_util_1.auditLog)(userId, 'SELF_ONBOARD_RESIDENT', 'Resident', resident.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Profile created successfully', resident);
    }
    catch (err) {
        next(err);
    }
};
exports.onboardSelf = onboardSelf;
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
        const { name, phone, unit: unitNumber, tower, floor, isPrimary } = req.body;
        // Find or create property (assuming single property deployment for now)
        let property = await prisma_1.prisma.property.findFirst();
        if (!property) {
            property = await prisma_1.prisma.property.create({
                data: { name: "Default Property", address: "Address", city: "City", pincode: "000000", totalUnits: 100 }
            });
        }
        // Find or create unit
        let unit = await prisma_1.prisma.unit.findFirst({
            where: { unitNumber, propertyId: property.id }
        });
        if (!unit) {
            unit = await prisma_1.prisma.unit.create({
                data: {
                    unitNumber,
                    floor: parseInt(floor) || 1,
                    tower: tower || 'Tower A',
                    propertyId: property.id,
                    isOccupied: true
                }
            });
        }
        // Ensure phone has + prefix for consistency if it doesn't already
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
        // Create user
        let user = await prisma_1.prisma.user.findUnique({
            where: { phone: formattedPhone },
            include: { resident: true }
        });
        if (user && user.resident) {
            return next(new error_middleware_1.AppError('This phone number is already registered to a resident.', 400));
        }
        if (!user) {
            user = await prisma_1.prisma.user.create({
                data: { phone: formattedPhone, role: 'RESIDENT' },
                include: { resident: true }
            });
        }
        const resident = await prisma_1.prisma.resident.create({
            data: {
                userId: user.id,
                unitId: unit.id,
                name,
                isPrimary
            }
        });
        // Mark unit as occupied
        if (!unit.isOccupied) {
            await prisma_1.prisma.unit.update({
                where: { id: unit.id },
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
const onboardHousehold = async (req, res, next) => {
    try {
        const { familyName, familyPassword, unit: unitNumber, tower, floor, members } = req.body;
        const passwordHash = await bcryptjs_1.default.hash(familyPassword, 10);
        let property = await prisma_1.prisma.property.findFirst();
        if (!property) {
            property = await prisma_1.prisma.property.create({
                data: { name: "Default Property", address: "Address", city: "City", pincode: "000000", totalUnits: 100 }
            });
        }
        let unit = await prisma_1.prisma.unit.findFirst({
            where: { unitNumber, propertyId: property.id }
        });
        if (!unit) {
            unit = await prisma_1.prisma.unit.create({
                data: {
                    unitNumber,
                    floor: parseInt(floor) || 1,
                    tower: tower || 'Tower A',
                    propertyId: property.id,
                    isOccupied: true
                }
            });
        }
        const createdResidents = [];
        // Process each member
        for (const member of members) {
            const formattedPhone = member.phone.startsWith('+') ? member.phone : `+91${member.phone}`;
            let user = await prisma_1.prisma.user.findUnique({
                where: { phone: formattedPhone },
                include: { resident: true }
            });
            if (user && user.resident) {
                // If a user is already a resident somewhere, skip or return error? We'll just skip them in this batch for simplicity, or throw error.
                return next(new error_middleware_1.AppError(`Phone ${formattedPhone} is already registered to a resident.`, 400));
            }
            if (!user) {
                user = await prisma_1.prisma.user.create({
                    data: { phone: formattedPhone, email: member.email, role: 'RESIDENT', passwordHash },
                    include: { resident: true }
                });
            }
            else {
                // Update email if provided and user doesn't have one, and update password
                user = await prisma_1.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        email: (!user.email && member.email) ? member.email : undefined,
                        passwordHash
                    },
                    include: { resident: true }
                });
            }
            const resident = await prisma_1.prisma.resident.create({
                data: {
                    userId: user.id,
                    unitId: unit.id,
                    name: member.name,
                    relationship: member.relationship,
                    isPrimary: member.isPrimary
                }
            });
            createdResidents.push(resident);
        }
        if (!unit.isOccupied) {
            await prisma_1.prisma.unit.update({
                where: { id: unit.id },
                data: { isOccupied: true }
            });
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'ONBOARD_HOUSEHOLD', 'Unit', unit.id);
        return (0, response_util_1.sendSuccess)(res, 201, 'Household onboarded successfully', createdResidents);
    }
    catch (err) {
        next(err);
    }
};
exports.onboardHousehold = onboardHousehold;
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