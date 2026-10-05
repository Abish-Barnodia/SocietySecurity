"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnitSummary = exports.shareResidentCredential = exports.restoreFamily = exports.deleteFamily = exports.deactivateResident = exports.updateHousehold = exports.onboardHousehold = exports.onboardResident = exports.uploadResidentDocument = exports.getFamilyDetails = exports.getAllResidents = exports.rejectResident = exports.approveResident = exports.getPendingResidents = exports.onboardSelf = exports.getUnitsByTower = exports.getTowers = exports.removeUnitPet = exports.addUnitPet = exports.getUnitPets = exports.removeUnitVehicle = exports.addUnitVehicle = exports.getUnitVehicles = exports.removeHouseholdMember = exports.addHouseholdMember = exports.getUnitResidents = exports.updateAlertPreferences = exports.updateMyProfile = exports.getMyProfile = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const server_1 = require("../../server");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const email_service_1 = require("../../utils/email.service");
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
        const residents = await prisma_1.prisma.resident.findMany({
            where: {
                unit: {
                    residents: {
                        some: { userId: req.user.userId }
                    }
                }
            },
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
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        if (!currentResident.isPrimary)
            return next(new error_middleware_1.AppError('Only primary residents can add members', 403));
        // Ensure user doesn't already exist
        let user = await prisma_1.prisma.user.findFirst({
            where: { OR: [{ phone: formattedPhone }, { phone }] }
        });
        if (!user) {
            user = await prisma_1.prisma.user.create({
                data: {
                    phone: formattedPhone,
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
        server_1.io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });
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
        server_1.io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });
        return (0, response_util_1.sendSuccess)(res, 200, 'Household member removed successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.removeHouseholdMember = removeHouseholdMember;
const getUnitVehicles = async (req, res, next) => {
    try {
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const vehicles = await prisma_1.prisma.vehicle.findMany({
            where: { unitId: currentResident.unitId, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Unit vehicles fetched', vehicles);
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitVehicles = getUnitVehicles;
const addUnitVehicle = async (req, res, next) => {
    try {
        const { registrationNo, make, model, color, type } = req.body;
        if (!registrationNo || !registrationNo.trim()) {
            return next(new error_middleware_1.AppError('Vehicle registration number is required', 400));
        }
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const normalizedRegNo = registrationNo.trim().toUpperCase();
        const existing = await prisma_1.prisma.vehicle.findFirst({
            where: { unitId: currentResident.unitId, registrationNo: normalizedRegNo }
        });
        let vehicle;
        if (existing) {
            vehicle = await prisma_1.prisma.vehicle.update({
                where: { id: existing.id },
                data: {
                    isActive: true,
                    make: make?.trim() || existing.make,
                    model: model?.trim() || existing.model,
                    color: color?.trim() || existing.color,
                    type: type?.toUpperCase() || existing.type,
                }
            });
        }
        else {
            vehicle = await prisma_1.prisma.vehicle.create({
                data: {
                    unitId: currentResident.unitId,
                    registrationNo: normalizedRegNo,
                    make: make?.trim() || null,
                    model: model?.trim() || null,
                    color: color?.trim() || null,
                    type: type?.toUpperCase() || 'CAR',
                    isResident: true,
                    isActive: true,
                }
            });
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'ADD_UNIT_VEHICLE', 'Vehicle', vehicle.id);
        server_1.io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });
        return (0, response_util_1.sendSuccess)(res, 201, 'Vehicle added successfully', vehicle);
    }
    catch (err) {
        next(err);
    }
};
exports.addUnitVehicle = addUnitVehicle;
const removeUnitVehicle = async (req, res, next) => {
    try {
        const vehicleId = req.params.vehicleId;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle || vehicle.unitId !== currentResident.unitId) {
            return next(new error_middleware_1.AppError('Vehicle not found in your unit', 404));
        }
        await prisma_1.prisma.vehicle.delete({ where: { id: vehicleId } });
        await (0, audit_util_1.auditLog)(req.user.userId, 'REMOVE_UNIT_VEHICLE', 'Vehicle', vehicleId);
        server_1.io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });
        return (0, response_util_1.sendSuccess)(res, 200, 'Vehicle removed successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.removeUnitVehicle = removeUnitVehicle;
const getUnitPets = async (req, res, next) => {
    try {
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const pets = await prisma_1.prisma.pet.findMany({
            where: { unitId: currentResident.unitId },
            orderBy: { createdAt: 'desc' }
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Unit pets fetched', pets);
    }
    catch (err) {
        next(err);
    }
};
exports.getUnitPets = getUnitPets;
const addUnitPet = async (req, res, next) => {
    try {
        const { name, type, breed, age, notes } = req.body;
        if (!name || !name.trim()) {
            return next(new error_middleware_1.AppError('Pet name is required', 400));
        }
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const pet = await prisma_1.prisma.pet.create({
            data: {
                unitId: currentResident.unitId,
                name: name.trim(),
                type: type?.toUpperCase() || 'DOG',
                breed: breed?.trim() || null,
                age: age?.trim() || null,
                notes: notes?.trim() || null,
            }
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'ADD_UNIT_PET', 'Pet', pet.id);
        server_1.io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });
        return (0, response_util_1.sendSuccess)(res, 201, 'Pet added successfully', pet);
    }
    catch (err) {
        next(err);
    }
};
exports.addUnitPet = addUnitPet;
const removeUnitPet = async (req, res, next) => {
    try {
        const petId = req.params.petId;
        const currentResident = await prisma_1.prisma.resident.findUnique({
            where: { userId: req.user.userId }
        });
        if (!currentResident)
            return next(new error_middleware_1.AppError('Resident not found', 404));
        const pet = await prisma_1.prisma.pet.findUnique({ where: { id: petId } });
        if (!pet || pet.unitId !== currentResident.unitId) {
            return next(new error_middleware_1.AppError('Pet not found in your unit', 404));
        }
        await prisma_1.prisma.pet.delete({ where: { id: petId } });
        await (0, audit_util_1.auditLog)(req.user.userId, 'REMOVE_UNIT_PET', 'Pet', petId);
        server_1.io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });
        return (0, response_util_1.sendSuccess)(res, 200, 'Pet removed successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.removeUnitPet = removeUnitPet;
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
        const { name, tower, flatNumber, type, vehicleNumber, propertyId, societyName, tenantSubtype, occupancyStatus, documentUrl, documentName } = req.body;
        const userId = req.user.userId;
        const existing = await prisma_1.prisma.resident.findUnique({ where: { userId } });
        if (existing) {
            return next(new error_middleware_1.AppError('Your resident profile is already set up', 400));
        }
        let property = null;
        if (propertyId) {
            property = await prisma_1.prisma.property.findUnique({ where: { id: propertyId } });
        }
        if (!property && societyName) {
            property = await prisma_1.prisma.property.findFirst({
                where: { name: { contains: societyName, mode: 'insensitive' } },
            });
        }
        if (!property) {
            property = await prisma_1.prisma.property.findFirst();
        }
        if (!property) {
            property = await prisma_1.prisma.property.create({
                data: { name: societyName || 'Aban Humming Bees', address: 'Address', city: req.body.city || 'Bengaluru', pincode: '560001', totalUnits: 100 },
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
                    tower: tower || 'Block A',
                    floor: 1,
                    propertyId: property.id,
                    isOccupied: true,
                },
            });
        }
        else if (unit.tower !== tower && tower) {
            // update tower if unit exists
            await prisma_1.prisma.unit.update({
                where: { id: unit.id },
                data: { tower },
            });
        }
        const existingUnitResidents = await prisma_1.prisma.resident.count({ where: { unitId: unit.id } });
        const resident = await prisma_1.prisma.resident.create({
            data: {
                userId,
                unitId: unit.id,
                name,
                residentType: type || 'Owner',
                relationship: tenantSubtype || 'Primary',
                status: 'PENDING',
                occupancyStatus: occupancyStatus || 'Currently residing',
                documentUrl: documentUrl || null,
                documentName: documentName || null,
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
        // Fetch user for email and managers for notification
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        const managers = await prisma_1.prisma.manager.findMany({
            where: { propertyId: property.id },
            include: { user: true },
        });
        const managerEmails = managers
            .map((m) => m.user?.email)
            .filter((e) => !!e);
        const targetManagerEmail = managerEmails.length > 0 ? managerEmails.join(', ') : null;
        // Send email alert to manager via SMTP
        (0, email_service_1.sendResidentRegistrationEmailToManager)({
            managerEmail: targetManagerEmail,
            societyName: property.name,
            residentName: name,
            residentEmail: user?.email || null,
            residentPhone: user?.phone || null,
            unitNumber: flatNumber,
            tower: tower || 'Block A',
            residentType: type || 'Owner',
            tenantSubtype: tenantSubtype || null,
            occupancyStatus: occupancyStatus || 'Currently residing',
            documentUrl: documentUrl || null,
            documentName: documentName || null,
        }).catch((err) => {
            console.error('Failed to send manager alert email:', err);
        });
        return (0, response_util_1.sendSuccess)(res, 201, 'Registration request submitted for approval', resident);
    }
    catch (err) {
        next(err);
    }
};
exports.onboardSelf = onboardSelf;
const getPendingResidents = async (req, res, next) => {
    try {
        const propertyId = req.user?.propertyId;
        const pending = await prisma_1.prisma.resident.findMany({
            where: {
                status: 'PENDING',
                ...(propertyId ? { unit: { propertyId } } : {}),
            },
            include: {
                unit: { include: { property: true } },
                user: { select: { phone: true, email: true, createdAt: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return (0, response_util_1.sendSuccess)(res, 200, 'Pending resident requests fetched', pending);
    }
    catch (err) {
        next(err);
    }
};
exports.getPendingResidents = getPendingResidents;
const approveResident = async (req, res, next) => {
    try {
        const id = req.params.id;
        const resident = await prisma_1.prisma.resident.findUnique({
            where: { id },
            include: { unit: { include: { property: true } }, user: true },
        });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident request not found', 404));
        const updated = await prisma_1.prisma.resident.update({
            where: { id },
            data: { status: 'APPROVED' },
            include: { unit: { include: { property: true } }, user: true },
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'APPROVE_RESIDENT', 'Resident', resident.id);
        // Send confirmation email via SMTP to resident
        if (resident.user?.email) {
            (0, email_service_1.sendResidentApprovalNotificationToResident)(resident.user.email, resident.name, resident.unit?.property?.name || 'Society Security', resident.unit?.unitNumber || '', resident.unit?.tower || 'Block A').catch((err) => console.error('Failed to send resident approval email:', err));
        }
        return (0, response_util_1.sendSuccess)(res, 200, 'Resident approved successfully', updated);
    }
    catch (err) {
        next(err);
    }
};
exports.approveResident = approveResident;
const rejectResident = async (req, res, next) => {
    try {
        const id = req.params.id;
        const resident = await prisma_1.prisma.resident.findUnique({ where: { id } });
        if (!resident)
            return next(new error_middleware_1.AppError('Resident request not found', 404));
        const updated = await prisma_1.prisma.resident.update({
            where: { id },
            data: { status: 'REJECTED' },
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'REJECT_RESIDENT', 'Resident', resident.id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Resident request rejected', updated);
    }
    catch (err) {
        next(err);
    }
};
exports.rejectResident = rejectResident;
const getAllResidents = async (req, res, next) => {
    try {
        // Scope to the caller's own property. req.user!.propertyId is undefined
        // for COMMITTEE (no property link in the schema today), which leaves
        // committee access unscoped exactly as before — this only tightens the
        // MANAGER path, which previously leaked residents across all properties.
        // ?deleted=true surfaces the "Delete Family" history view instead of
        // the normal directory — same shape, just the opposite isDeleted filter.
        const showDeleted = req.query.deleted === 'true';
        const residents = await prisma_1.prisma.resident.findMany({
            where: {
                status: 'APPROVED',
                unit: {
                    isDeleted: showDeleted,
                    ...(req.user.propertyId ? { propertyId: req.user.propertyId } : {}),
                },
            },
            include: {
                unit: {
                    include: {
                        vehicles: { where: { isActive: true } },
                        pets: true,
                    }
                },
                user: { select: { phone: true, email: true, isActive: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        // Group residents by unit → one family entry per unit
        const familyMap = new Map();
        for (const r of residents) {
            const uid = r.unitId;
            if (!familyMap.has(uid)) {
                familyMap.set(uid, {
                    unitId: uid,
                    familyName: r.unit.familyName || null,
                    apartmentNumber: r.unit.unitNumber,
                    tower: r.unit.tower || 'Tower A',
                    floor: r.unit.floor,
                    residentType: r.residentType,
                    occupancyStatus: r.occupancyStatus,
                    documentUrl: r.documentUrl,
                    documentName: r.documentName,
                    totalMembers: 0,
                    primaryResident: null,
                    members: [],
                    vehicles: r.unit.vehicles || [],
                    pets: r.unit.pets || [],
                });
            }
            const family = familyMap.get(uid);
            const member = {
                id: r.id,
                name: r.name,
                relationship: r.relationship,
                residentType: r.residentType,
                occupancyStatus: r.occupancyStatus,
                documentUrl: r.documentUrl,
                documentName: r.documentName,
                status: r.status,
                isPrimary: r.isPrimary,
                phone: r.user?.phone || null,
                email: r.user?.email || null,
                isActive: r.user?.isActive ?? true,
                createdAt: r.createdAt,
            };
            family.members.push(member);
            family.totalMembers += 1;
            if (r.isPrimary || !family.primaryResident) {
                family.primaryResident = {
                    id: r.id,
                    name: r.name,
                    phone: r.user?.phone || null,
                    email: r.user?.email || null,
                    residentType: r.residentType,
                    occupancyStatus: r.occupancyStatus,
                    relationship: r.relationship,
                    documentUrl: r.documentUrl,
                    documentName: r.documentName,
                };
                family.residentType = r.residentType;
                family.occupancyStatus = r.occupancyStatus;
                family.documentUrl = r.documentUrl;
                family.documentName = r.documentName;
            }
        }
        const families = Array.from(familyMap.values());
        return (0, response_util_1.sendSuccess)(res, 200, 'Families fetched', families);
    }
    catch (err) {
        next(err);
    }
};
exports.getAllResidents = getAllResidents;
const getFamilyDetails = async (req, res, next) => {
    try {
        const unitId = req.params.unitId;
        const unit = await prisma_1.prisma.unit.findUnique({
            where: { id: unitId },
            include: {
                residents: {
                    include: { user: { select: { phone: true, email: true, isActive: true } } },
                    orderBy: { isPrimary: 'desc' }
                },
                vehicles: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' }
                },
                pets: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!unit)
            return next(new error_middleware_1.AppError('Unit not found', 404));
        const primary = unit.residents.find(r => r.isPrimary) || unit.residents[0];
        const result = {
            unitId: unit.id,
            familyName: unit.familyName || null,
            apartmentNumber: unit.unitNumber,
            tower: unit.tower || 'Tower A',
            floor: unit.floor,
            residentType: primary?.residentType || 'Owner',
            occupancyStatus: primary?.occupancyStatus || 'Currently residing',
            documentUrl: primary?.documentUrl || null,
            documentName: primary?.documentName || null,
            totalMembers: unit.residents.length,
            primaryResident: primary ? {
                id: primary.id,
                name: primary.name,
                residentType: primary.residentType,
                occupancyStatus: primary.occupancyStatus,
                relationship: primary.relationship,
                documentUrl: primary.documentUrl,
                documentName: primary.documentName,
            } : null,
            members: unit.residents.map(r => ({
                id: r.id,
                name: r.name,
                relationship: r.relationship,
                residentType: r.residentType,
                occupancyStatus: r.occupancyStatus,
                documentUrl: r.documentUrl,
                documentName: r.documentName,
                status: r.status,
                isPrimary: r.isPrimary,
                phone: r.user?.phone || null,
                email: r.user?.email || null,
                isActive: r.user?.isActive ?? true,
                createdAt: r.createdAt,
            })),
            vehicles: unit.vehicles || [],
            pets: unit.pets || [],
        };
        return (0, response_util_1.sendSuccess)(res, 200, 'Family details fetched', result);
    }
    catch (err) {
        next(err);
    }
};
exports.getFamilyDetails = getFamilyDetails;
const uploadResidentDocument = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file)
            return next(new error_middleware_1.AppError('No document file uploaded', 400));
        const { uploadBuffer } = await Promise.resolve().then(() => __importStar(require('../../utils/objectStorage.util')));
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `resident-documents/${Date.now()}-${safeFilename}`;
        const url = await uploadBuffer(file.buffer, path, file.mimetype);
        return (0, response_util_1.sendSuccess)(res, 201, 'Document uploaded successfully', {
            url,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.uploadResidentDocument = uploadResidentDocument;
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
        const { familyName, unit: unitNumber, tower, floor, members } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            let property = await tx.property.findFirst();
            if (!property) {
                property = await tx.property.create({
                    data: { name: "Default Property", address: "Address", city: "City", pincode: "000000", totalUnits: 100 }
                });
            }
            let unit = await tx.unit.findFirst({
                where: { unitNumber, propertyId: property.id }
            });
            if (!unit) {
                unit = await tx.unit.create({
                    data: {
                        unitNumber,
                        floor: parseInt(floor) || 1,
                        tower: tower || 'Tower A',
                        familyName: familyName || null,
                        propertyId: property.id,
                        isOccupied: true
                    }
                });
            }
            else if (familyName && !unit.familyName) {
                unit = await tx.unit.update({
                    where: { id: unit.id },
                    data: { familyName }
                });
            }
            const allFormattedPhones = members.map((m) => m.phone ? (m.phone.startsWith('+') ? m.phone : `+91${m.phone}`) : undefined).filter(Boolean);
            const allEmails = members.map((m) => m.email).filter(Boolean);
            const existingUsers = await tx.user.findMany({
                where: {
                    OR: [
                        { phone: { in: allFormattedPhones } },
                        { email: { in: allEmails } }
                    ]
                },
                include: { resident: true }
            });
            const createdResidents = [];
            for (const member of members) {
                if (!member.phone && !member.email) {
                    throw new error_middleware_1.AppError('Each member must have at least a phone number or email.', 400);
                }
                if (!member.password || member.password.length < 6) {
                    throw new error_middleware_1.AppError(`Password for ${member.name} must be at least 6 characters.`, 400);
                }
                const passwordHash = await bcryptjs_1.default.hash(member.password, 10);
                const formattedPhone = member.phone
                    ? (member.phone.startsWith('+') ? member.phone : `+91${member.phone}`)
                    : undefined;
                let user = existingUsers.find((u) => (formattedPhone && u.phone === formattedPhone) ||
                    (member.email && u.email === member.email));
                if (user) {
                    if (user.role !== 'RESIDENT') {
                        throw new error_middleware_1.AppError(`${formattedPhone || member.email} belongs to a staff or admin account and cannot be modified.`, 403);
                    }
                    if (user.resident) {
                        throw new error_middleware_1.AppError(`${formattedPhone || member.email} is already registered to a resident.`, 400);
                    }
                }
                if (!user) {
                    user = await tx.user.create({
                        data: { phone: formattedPhone, email: member.email, role: 'RESIDENT', passwordHash },
                        include: { resident: true }
                    });
                }
                else {
                    user = await tx.user.update({
                        where: { id: user.id },
                        data: {
                            email: (!user.email && member.email) ? member.email : undefined,
                            passwordHash
                        },
                        include: { resident: true }
                    });
                }
                const resident = await tx.resident.create({
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
                await tx.unit.update({
                    where: { id: unit.id },
                    data: { isOccupied: true }
                });
            }
            return { unitId: unit.id, createdResidents };
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'ONBOARD_HOUSEHOLD', 'Unit', result.unitId);
        server_1.io?.to(`unit_${result.unitId}`).emit('household_updated', { unitId: result.unitId });
        return (0, response_util_1.sendSuccess)(res, 201, 'Household onboarded successfully', result.createdResidents);
    }
    catch (err) {
        next(err);
    }
};
exports.onboardHousehold = onboardHousehold;
const updateHousehold = async (req, res, next) => {
    try {
        const unitId = req.params.unitId;
        const { familyName, unit: unitNumber, tower, floor, members } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            let unit = await tx.unit.findUnique({
                where: { id: unitId },
                include: { residents: { include: { user: true } } }
            });
            if (!unit) {
                throw new error_middleware_1.AppError('Household not found', 404);
            }
            unit = await tx.unit.update({
                where: { id: unitId },
                data: {
                    unitNumber,
                    floor: parseInt(floor) || 1,
                    tower: tower || 'Tower A',
                    familyName: familyName || null,
                },
                include: { residents: { include: { user: true } } }
            });
            const currentMemberIds = unit.residents.map(r => r.id);
            const incomingMemberIds = members.filter((m) => m.id).map((m) => m.id);
            const membersToRemove = currentMemberIds.filter(id => !incomingMemberIds.includes(id));
            for (const residentId of membersToRemove) {
                const resident = unit.residents.find(r => r.id === residentId);
                if (resident) {
                    await tx.user.update({
                        where: { id: resident.userId },
                        data: { isActive: false }
                    });
                }
            }
            const allFormattedPhones = members.map((m) => m.phone ? (m.phone.startsWith('+') ? m.phone : `+91${m.phone}`) : undefined).filter(Boolean);
            const allEmails = members.map((m) => m.email).filter(Boolean);
            const existingUsers = await tx.user.findMany({
                where: {
                    OR: [
                        { phone: { in: allFormattedPhones } },
                        { email: { in: allEmails } }
                    ]
                },
                include: { resident: true }
            });
            const updatedResidents = [];
            for (const member of members) {
                if (!member.phone && !member.email) {
                    throw new error_middleware_1.AppError('Each member must have at least a phone number or email.', 400);
                }
                const formattedPhone = member.phone
                    ? (member.phone.startsWith('+') ? member.phone : `+91${member.phone}`)
                    : null;
                let passwordHash = undefined;
                if (member.password && member.password.length >= 6) {
                    passwordHash = await bcryptjs_1.default.hash(member.password, 10);
                }
                if (member.id) {
                    const resident = unit.residents.find(r => r.id === member.id);
                    if (!resident)
                        continue;
                    let conflictingUser = existingUsers.find((u) => u.id !== resident.userId &&
                        ((formattedPhone && u.phone === formattedPhone) ||
                            (member.email && u.email === member.email)));
                    if (conflictingUser) {
                        throw new error_middleware_1.AppError(`Phone or email is already in use by another user.`, 400);
                    }
                    await tx.user.update({
                        where: { id: resident.userId },
                        data: {
                            phone: formattedPhone,
                            email: member.email || null,
                            ...(passwordHash && { passwordHash }),
                            isActive: true
                        }
                    });
                    const updatedResident = await tx.resident.update({
                        where: { id: resident.id },
                        data: {
                            name: member.name,
                            relationship: member.relationship,
                            isPrimary: member.isPrimary
                        }
                    });
                    updatedResidents.push(updatedResident);
                }
                else {
                    if (!member.password || member.password.length < 6) {
                        throw new error_middleware_1.AppError(`Password for ${member.name} must be at least 6 characters.`, 400);
                    }
                    const newPasswordHash = await bcryptjs_1.default.hash(member.password, 10);
                    let user = existingUsers.find((u) => (formattedPhone && u.phone === formattedPhone) ||
                        (member.email && u.email === member.email));
                    if (user) {
                        if (user.role !== 'RESIDENT') {
                            throw new error_middleware_1.AppError(`${formattedPhone || member.email} belongs to a staff or admin account and cannot be modified.`, 403);
                        }
                        if (user.resident) {
                            throw new error_middleware_1.AppError(`${formattedPhone || member.email} is already registered to a resident.`, 400);
                        }
                    }
                    if (!user) {
                        user = await tx.user.create({
                            data: { phone: formattedPhone, email: member.email, role: 'RESIDENT', passwordHash: newPasswordHash },
                            include: { resident: true }
                        });
                    }
                    else {
                        user = await tx.user.update({
                            where: { id: user.id },
                            data: {
                                email: (!user.email && member.email) ? member.email : undefined,
                                passwordHash: newPasswordHash
                            },
                            include: { resident: true }
                        });
                    }
                    const resident = await tx.resident.create({
                        data: {
                            userId: user.id,
                            unitId: unit.id,
                            name: member.name,
                            relationship: member.relationship,
                            isPrimary: member.isPrimary
                        }
                    });
                    updatedResidents.push(resident);
                }
            }
            return { unitId: unit.id, updatedResidents };
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'UPDATE_HOUSEHOLD', 'Unit', result.unitId);
        server_1.io?.to(`unit_${result.unitId}`).emit('household_updated', { unitId: result.unitId });
        return (0, response_util_1.sendSuccess)(res, 200, 'Household updated successfully', result.updatedResidents);
    }
    catch (err) {
        next(err);
    }
};
exports.updateHousehold = updateHousehold;
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
        server_1.io?.to(`unit_${resident.unitId}`).emit('household_updated', { unitId: resident.unitId });
        return (0, response_util_1.sendSuccess)(res, 200, 'Resident deactivated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deactivateResident = deactivateResident;
// "Delete Family" — deactivates every member's login (same effect as
// suspending each of them) and hides the unit from the directory going
// forward, but keeps the unit/residents and everything tied to them
// (passes, complaints, entries, invoices) intact for history/audit.
const deleteFamily = async (req, res, next) => {
    try {
        const unitId = req.params.unitId;
        const unit = await prisma_1.prisma.unit.findUnique({ where: { id: unitId }, include: { residents: true } });
        if (!unit || unit.propertyId !== req.user.propertyId) {
            return next(new error_middleware_1.AppError('Household not found', 404));
        }
        await prisma_1.prisma.$transaction([
            ...unit.residents.map(r => prisma_1.prisma.user.update({ where: { id: r.userId }, data: { isActive: false } })),
            prisma_1.prisma.unit.update({ where: { id: unitId }, data: { isDeleted: true } }),
        ]);
        await (0, audit_util_1.auditLog)(req.user.userId, 'DELETE_FAMILY', 'Unit', unitId);
        return (0, response_util_1.sendSuccess)(res, 200, 'Family deleted successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deleteFamily = deleteFamily;
// Undoes deleteFamily — reinstates the unit in the directory and restores
// every member's login access.
const restoreFamily = async (req, res, next) => {
    try {
        const unitId = req.params.unitId;
        const unit = await prisma_1.prisma.unit.findUnique({ where: { id: unitId }, include: { residents: true } });
        if (!unit || unit.propertyId !== req.user.propertyId) {
            return next(new error_middleware_1.AppError('Household not found', 404));
        }
        await prisma_1.prisma.$transaction([
            ...unit.residents.map(r => prisma_1.prisma.user.update({ where: { id: r.userId }, data: { isActive: true } })),
            prisma_1.prisma.unit.update({ where: { id: unitId }, data: { isDeleted: false } }),
        ]);
        await (0, audit_util_1.auditLog)(req.user.userId, 'RESTORE_FAMILY', 'Unit', unitId);
        return (0, response_util_1.sendSuccess)(res, 200, 'Family restored successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.restoreFamily = restoreFamily;
// Gate for sharing a resident's plaintext login credentials (PDF via
// WhatsApp/email) — caps how many times a manager can re-send the same
// account's password. Doesn't send anything itself, just claims one of the
// limited shares; the frontend generates/shares the PDF only if this succeeds.
const shareResidentCredential = async (req, res, next) => {
    try {
        const id = req.params.id;
        const resident = await prisma_1.prisma.resident.findUnique({ where: { id }, include: { unit: { select: { propertyId: true } } } });
        if (!resident || resident.unit.propertyId !== req.user.propertyId) {
            return next(new error_middleware_1.AppError('Resident not found', 404));
        }
        const { tryConsumeCredentialShare, MAX_CREDENTIAL_SHARES } = await Promise.resolve().then(() => __importStar(require('../../utils/credentialShare.util')));
        const allowed = await tryConsumeCredentialShare(resident.userId);
        if (!allowed) {
            return next(new error_middleware_1.AppError(`This resident's credentials have already been shared the maximum of ${MAX_CREDENTIAL_SHARES} times.`, 403));
        }
        await (0, audit_util_1.auditLog)(req.user.userId, 'SHARE_RESIDENT_CREDENTIAL', 'Resident', id);
        return (0, response_util_1.sendSuccess)(res, 200, 'Credential share allowed');
    }
    catch (err) {
        next(err);
    }
};
exports.shareResidentCredential = shareResidentCredential;
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