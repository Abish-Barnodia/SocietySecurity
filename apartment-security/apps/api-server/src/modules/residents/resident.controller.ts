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
    const { name, emergencyContact, emergencyContactName } = req.body;
    
    // First find the resident using userId
    const currentResident = await prisma.resident.findUnique({
        where: { userId: req.user!.userId }
    });
    
    if (!currentResident) return next(new AppError('Resident not found', 404));
    
    const resident = await prisma.resident.update({
      where: { id: currentResident.id },
      data: { name, emergencyContact, emergencyContactName },
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
        } else {
             const existingResident = await prisma.resident.findUnique({ where: { userId: user.id } });
             if (existingResident) return next(new AppError('User is already registered to a unit', 409));
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
        const { name, phone, unitId, isPrimary } = req.body;
        
        // Check unit
        const unit = await prisma.unit.findUnique({ where: { id: unitId } });
        if (!unit) return next(new AppError('Unit not found', 404));
        
        // Create user
        let user = await prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await prisma.user.create({
                data: { phone, role: 'RESIDENT' }
            });
        }
        
        const resident = await prisma.resident.create({
            data: {
                userId: user.id,
                unitId,
                name,
                isPrimary
            }
        });
        
        // Mark unit as occupied
        if (!unit.isOccupied) {
            await prisma.unit.update({
                where: { id: unitId },
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
