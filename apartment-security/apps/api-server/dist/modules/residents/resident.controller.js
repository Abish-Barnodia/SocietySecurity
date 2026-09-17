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
exports.getUnitSummary = exports.shareResidentCredential = exports.restoreFamily = exports.deleteFamily = exports.deactivateResident = exports.updateHousehold = exports.onboardHousehold = exports.onboardResident = exports.getFamilyDetails = exports.getAllResidents = exports.onboardSelf = exports.getUnitsByTower = exports.getTowers = exports.removeHouseholdMember = exports.addHouseholdMember = exports.getUnitResidents = exports.updateAlertPreferences = exports.updateMyProfile = exports.getMyProfile = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const audit_util_1 = require("../../utils/audit.util");
const server_1 = require("../../server");
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
        // Scope to the caller's own property. req.user!.propertyId is undefined
        // for COMMITTEE (no property link in the schema today), which leaves
        // committee access unscoped exactly as before — this only tightens the
        // MANAGER path, which previously leaked residents across all properties.
        // ?deleted=true surfaces the "Delete Family" history view instead of
        // the normal directory — same shape, just the opposite isDeleted filter.
        const showDeleted = req.query.deleted === 'true';
        const residents = await prisma_1.prisma.resident.findMany({
            where: {
                unit: {
                    isDeleted: showDeleted,
                    ...(req.user.propertyId ? { propertyId: req.user.propertyId } : {}),
                },
            },
            include: {
                unit: true,
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
                    totalMembers: 0,
                    primaryResident: null,
                    members: [],
                });
            }
            const family = familyMap.get(uid);
            const member = {
                id: r.id,
                name: r.name,
                relationship: r.relationship,
                isPrimary: r.isPrimary,
                phone: r.user?.phone || null,
                email: r.user?.email || null,
                isActive: r.user?.isActive ?? true,
                createdAt: r.createdAt,
            };
            family.members.push(member);
            family.totalMembers += 1;
            if (r.isPrimary || !family.primaryResident) {
                family.primaryResident = { id: r.id, name: r.name, phone: r.user?.phone || null, email: r.user?.email || null };
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
            totalMembers: unit.residents.length,
            primaryResident: primary ? { id: primary.id, name: primary.name } : null,
            members: unit.residents.map(r => ({
                id: r.id,
                name: r.name,
                relationship: r.relationship,
                isPrimary: r.isPrimary,
                phone: r.user?.phone || null,
                email: r.user?.email || null,
                isActive: r.user?.isActive ?? true,
                createdAt: r.createdAt,
            })),
        };
        return (0, response_util_1.sendSuccess)(res, 200, 'Family details fetched', result);
    }
    catch (err) {
        next(err);
    }
};
exports.getFamilyDetails = getFamilyDetails;
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