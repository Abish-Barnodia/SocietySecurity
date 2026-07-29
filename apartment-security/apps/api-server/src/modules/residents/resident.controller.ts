import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resident = await prisma.resident.findUnique({
      where: { userId: req.user!.userId },
      include: {
        unit: { include: { property: true } },
        user: { select: { phone: true, email: true, fcmTokens: true } },
      },
    });
    if (!resident) return next(new AppError('Resident profile not found', 404));
    
    return sendSuccess(res, 200, 'Profile fetched successfully', resident);
  } catch (err) { next(err); }
};

export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, emergencyContact, emergencyContactName, showUnitInCommunity } = req.body;

    // First find the resident using userId
    const currentResident = await prisma.resident.findUnique({
        where: { userId: req.user!.userId }
    });

    if (!currentResident) return next(new AppError('Resident not found', 404));

    const resident = await prisma.resident.update({
      where: { id: currentResident.id },
      data: { name, emergencyContact, emergencyContactName, showUnitInCommunity },
    });
    
    await auditLog(req.user!.userId, 'UPDATE_PROFILE', 'Resident', resident.id);
    return sendSuccess(res, 200, 'Profile updated successfully', resident);
  } catch (err) { next(err); }
};

export const updateAlertPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferences } = req.body;
    
    const currentResident = await prisma.resident.findUnique({
        where: { userId: req.user!.userId }
    });
    if (!currentResident) return next(new AppError('Resident not found', 404));
    
    const resident = await prisma.resident.update({
      where: { id: currentResident.id },
      data: { alertPreferences: preferences },
    });
    return sendSuccess(res, 200, 'Alert preferences updated', resident.alertPreferences);
  } catch (err) { next(err); }
};

export const getUnitResidents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));
        
        const residents = await prisma.resident.findMany({
            where: { unitId: currentResident.unitId },
            include: { user: { select: { phone: true } } }
        });
        
        return sendSuccess(res, 200, 'Unit residents fetched', residents);
    } catch (err) { next(err); }
};

export const addHouseholdMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Assume resident can add another resident to their unit. The added user might need an OTP to verify phone later.
        const { name, phone, isPrimary } = req.body;
        
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));
        if (!currentResident.isPrimary) return next(new AppError('Only primary residents can add members', 403));
        
        // Ensure user doesn't already exist
        let user = await prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    phone,
                    role: 'RESIDENT',
                }
            });
        } else if (user.role !== 'RESIDENT') {
             return next(new AppError('User exists with a different role', 400));
        }
        
        const newResident = await prisma.resident.create({
            data: {
                userId: user.id,
                unitId: currentResident.unitId,
                name,
                isPrimary: isPrimary || false
            }
        });
        
        await auditLog(req.user!.userId, 'ADD_HOUSEHOLD_MEMBER', 'Resident', newResident.id);
        
        return sendSuccess(res, 201, 'Household member added successfully', newResident);
    } catch (err) { next(err); }
};

export const removeHouseholdMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const memberId = req.params.memberId as string;
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));
        if (!currentResident.isPrimary) return next(new AppError('Only primary residents can remove members', 403));
        
        const memberToRemove = await prisma.resident.findUnique({ where: { id: memberId } });
        if (!memberToRemove || memberToRemove.unitId !== currentResident.unitId) {
            return next(new AppError('Member not found in your unit', 404));
        }
        
        await prisma.resident.delete({ where: { id: memberId } });
        await prisma.user.update({
            where: { id: memberToRemove.userId },
            data: { isActive: false }
        });
        
        await auditLog(req.user!.userId, 'REMOVE_HOUSEHOLD_MEMBER', 'Resident', memberId);
        
        return sendSuccess(res, 200, 'Household member removed successfully');
    } catch (err) { next(err); }
};

export const getTowers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const units = await prisma.unit.findMany({
      where: { tower: { not: null } },
      distinct: ['tower'],
      select: { tower: true },
      orderBy: { tower: 'asc' },
    });
    const towers = units.map((u) => u.tower).filter((t): t is string => !!t);
    return sendSuccess(res, 200, 'Towers fetched successfully', towers.length ? towers : ['Tower A']);
  } catch (err) { next(err); }
};

export const getUnitsByTower = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tower = req.query.tower as string | undefined;
    if (!tower) return next(new AppError('tower query param is required', 400));

    const units = await prisma.unit.findMany({
      where: { tower },
      select: { id: true, unitNumber: true, tower: true },
      orderBy: { unitNumber: 'asc' },
    });

    return sendSuccess(res, 200, 'Units fetched successfully', units);
  } catch (err) { next(err); }
};

export const onboardSelf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, tower, flatNumber, type, vehicleNumber } = req.body;
    const userId = req.user!.userId;

    const existing = await prisma.resident.findUnique({ where: { userId } });
    if (existing) {
      return next(new AppError('Your resident profile is already set up', 400));
    }

    let property = await prisma.property.findFirst();
    if (!property) {
      property = await prisma.property.create({
        data: { name: 'Default Property', address: 'Address', city: 'City', pincode: '000000', totalUnits: 100 },
      });
    }

    // Unit numbers are unique per property, so look up by that key rather than
    // by (tower, unitNumber) — otherwise creating a duplicate number in a
    // different tower violates @@unique([propertyId, unitNumber]).
    let unit = await prisma.unit.findUnique({
      where: { propertyId_unitNumber: { propertyId: property.id, unitNumber: flatNumber } },
    });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          unitNumber: flatNumber,
          tower,
          floor: 1,
          propertyId: property.id,
          isOccupied: true,
        },
      });
    } else if (unit.tower !== tower) {
      return next(new AppError(`Flat ${flatNumber} belongs to ${unit.tower}, not ${tower}`, 400));
    }

    const existingUnitResidents = await prisma.resident.count({ where: { unitId: unit.id } });

    const resident = await prisma.resident.create({
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
      await prisma.vehicle.create({
        data: {
          unitId: unit.id,
          registrationNo: vehicleNumber,
          isResident: true,
        },
      });
    }

    if (!unit.isOccupied) {
      await prisma.unit.update({ where: { id: unit.id }, data: { isOccupied: true } });
    }

    await auditLog(userId, 'SELF_ONBOARD_RESIDENT', 'Resident', resident.id);

    return sendSuccess(res, 201, 'Profile created successfully', resident);
  } catch (err) { next(err); }
};

export const getAllResidents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const residents = await prisma.resident.findMany({
            include: { unit: true, user: { select: { phone: true, isActive: true } } }
        });
        return sendSuccess(res, 200, 'All residents fetched', residents);
    } catch (err) { next(err); }
};

export const onboardResident = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, phone, unit: unitNumber, tower, floor, isPrimary } = req.body;
        
        // Find or create property (assuming single property deployment for now)
        let property = await prisma.property.findFirst();
        if (!property) {
            property = await prisma.property.create({
                data: { name: "Default Property", address: "Address", city: "City", pincode: "000000", totalUnits: 100 }
            });
        }

        // Find or create unit
        let unit = await prisma.unit.findFirst({ 
            where: { unitNumber, propertyId: property.id } 
        });
        if (!unit) {
            unit = await prisma.unit.create({
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
        let user = await prisma.user.findUnique({ 
            where: { phone: formattedPhone },
            include: { resident: true }
        });

        if (user && user.resident) {
            return next(new AppError('This phone number is already registered to a resident.', 400));
        }

        if (!user) {
            user = await prisma.user.create({
                data: { phone: formattedPhone, role: 'RESIDENT' }
            });
        }
        
        const resident = await prisma.resident.create({
            data: {
                userId: user.id,
                unitId: unit.id,
                name,
                isPrimary
            }
        });
        
        // Mark unit as occupied
        if (!unit.isOccupied) {
            await prisma.unit.update({
                where: { id: unit.id },
                data: { isOccupied: true }
            });
        }
        
        await auditLog(req.user!.userId, 'ONBOARD_RESIDENT', 'Resident', resident.id);
        
        return sendSuccess(res, 201, 'Resident onboarded successfully', resident);
    } catch (err) { next(err); }
};

export const deactivateResident = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const resident = await prisma.resident.findUnique({ where: { id } });
        if (!resident) return next(new AppError('Resident not found', 404));
        
        await prisma.user.update({
            where: { id: resident.userId },
            data: { isActive: false }
        });
        
        await auditLog(req.user!.userId, 'DEACTIVATE_RESIDENT', 'Resident', id);
        
        return sendSuccess(res, 200, 'Resident deactivated successfully');
    } catch (err) { next(err); }
};

export const getUnitSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string; // resident id
        const resident = await prisma.resident.findUnique({
            where: { id },
            include: { unit: { include: { vehicles: true } } }
        });
        
        if (!resident) return next(new AppError('Resident not found', 404));
        
        return sendSuccess(res, 200, 'Unit summary fetched', resident.unit);
    } catch (err) { next(err); }
};
