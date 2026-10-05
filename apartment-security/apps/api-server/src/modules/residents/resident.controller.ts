import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { io } from '../../server';
import bcrypt from 'bcryptjs';
import {
  sendResidentRegistrationEmailToManager,
  sendResidentApprovalNotificationToResident,
} from '../../utils/email.service';



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
        const residents = await prisma.resident.findMany({
            where: {
                unit: {
                    residents: {
                        some: { userId: req.user!.userId }
                    }
                }
            },
            include: { user: { select: { phone: true } } }
        });
        return sendSuccess(res, 200, 'Unit residents fetched', residents);
    } catch (err) { next(err); }
};

export const addHouseholdMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Assume resident can add another resident to their unit. The added user might need an OTP to verify phone later.
        const { name, phone, isPrimary } = req.body;
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
        
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));
        if (!currentResident.isPrimary) return next(new AppError('Only primary residents can add members', 403));
        
        // Ensure user doesn't already exist
        let user = await prisma.user.findFirst({
          where: { OR: [{ phone: formattedPhone }, { phone }] }
        });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    phone: formattedPhone,
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
        io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });

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
        io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });

        return sendSuccess(res, 200, 'Household member removed successfully');
    } catch (err) { next(err); }
};

export const getUnitVehicles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));

        const vehicles = await prisma.vehicle.findMany({
            where: { unitId: currentResident.unitId, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        return sendSuccess(res, 200, 'Unit vehicles fetched', vehicles);
    } catch (err) { next(err); }
};

export const addUnitVehicle = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { registrationNo, make, model, color, type, photoUrl } = req.body;
        if (!registrationNo || !registrationNo.trim()) {
            return next(new AppError('Vehicle registration number is required', 400));
        }

        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));

        const normalizedRegNo = registrationNo.trim().toUpperCase();

        const existing = await prisma.vehicle.findFirst({
            where: { unitId: currentResident.unitId, registrationNo: normalizedRegNo }
        });

        let vehicle;
        if (existing) {
            vehicle = await prisma.vehicle.update({
                where: { id: existing.id },
                data: {
                    isActive: true,
                    make: make?.trim() || existing.make,
                    model: model?.trim() || existing.model,
                    color: color?.trim() || existing.color,
                    type: type?.toUpperCase() || existing.type,
                    photoUrl: photoUrl !== undefined ? (photoUrl || null) : existing.photoUrl,
                }
            });
        } else {
            vehicle = await prisma.vehicle.create({
                data: {
                    unitId: currentResident.unitId,
                    registrationNo: normalizedRegNo,
                    make: make?.trim() || null,
                    model: model?.trim() || null,
                    color: color?.trim() || null,
                    type: type?.toUpperCase() || 'CAR',
                    photoUrl: photoUrl || null,
                    isResident: true,
                    isActive: true,
                }
            });
        }

        await auditLog(req.user!.userId, 'ADD_UNIT_VEHICLE', 'Vehicle', vehicle.id);
        io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });

        return sendSuccess(res, 201, 'Vehicle added successfully', vehicle);
    } catch (err) { next(err); }
};

export const removeUnitVehicle = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const vehicleId = req.params.vehicleId as string;
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));

        const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle || vehicle.unitId !== currentResident.unitId) {
            return next(new AppError('Vehicle not found in your unit', 404));
        }

        await prisma.vehicle.delete({ where: { id: vehicleId } });
        await auditLog(req.user!.userId, 'REMOVE_UNIT_VEHICLE', 'Vehicle', vehicleId);
        io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });

        return sendSuccess(res, 200, 'Vehicle removed successfully');
    } catch (err) { next(err); }
};

export const getUnitPets = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));

        const pets = await prisma.pet.findMany({
            where: { unitId: currentResident.unitId },
            orderBy: { createdAt: 'desc' }
        });
        return sendSuccess(res, 200, 'Unit pets fetched', pets);
    } catch (err) { next(err); }
};

export const addUnitPet = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, type, breed, age, notes, photoUrl } = req.body;
        if (!name || !name.trim()) {
            return next(new AppError('Pet name is required', 400));
        }

        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));

        const pet = await prisma.pet.create({
            data: {
                unitId: currentResident.unitId,
                name: name.trim(),
                type: type?.toUpperCase() || 'DOG',
                breed: breed?.trim() || null,
                age: age?.trim() || null,
                notes: notes?.trim() || null,
                photoUrl: photoUrl || null,
            }
        });

        await auditLog(req.user!.userId, 'ADD_UNIT_PET', 'Pet', pet.id);
        io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });

        return sendSuccess(res, 201, 'Pet added successfully', pet);
    } catch (err) { next(err); }
};

export const removeUnitPet = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const petId = req.params.petId as string;
        const currentResident = await prisma.resident.findUnique({
            where: { userId: req.user!.userId }
        });
        if (!currentResident) return next(new AppError('Resident not found', 404));

        const pet = await prisma.pet.findUnique({ where: { id: petId } });
        if (!pet || pet.unitId !== currentResident.unitId) {
            return next(new AppError('Pet not found in your unit', 404));
        }

        await prisma.pet.delete({ where: { id: petId } });
        await auditLog(req.user!.userId, 'REMOVE_UNIT_PET', 'Pet', petId);
        io?.to(`unit_${currentResident.unitId}`).emit('household_updated', { unitId: currentResident.unitId });

        return sendSuccess(res, 200, 'Pet removed successfully');
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
    const { name, tower, flatNumber, type, vehicleNumber, propertyId, societyName, tenantSubtype, occupancyStatus, documentUrl, documentName } = req.body;
    const userId = req.user!.userId;

    const existing = await prisma.resident.findUnique({ where: { userId } });
    if (existing) {
      return next(new AppError('Your resident profile is already set up', 400));
    }

    let property = null;
    if (propertyId) {
      property = await prisma.property.findUnique({ where: { id: propertyId } });
    }
    if (!property && societyName) {
      property = await prisma.property.findFirst({
        where: { name: { contains: societyName, mode: 'insensitive' } },
      });
    }
    if (!property) {
      property = await prisma.property.findFirst();
    }
    if (!property) {
      property = await prisma.property.create({
        data: { name: societyName || 'Aban Humming Bees', address: 'Address', city: req.body.city || 'Bengaluru', pincode: '560001', totalUnits: 100 },
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
          tower: tower || 'Block A',
          floor: 1,
          propertyId: property.id,
          isOccupied: true,
        },
      });
    } else if (unit.tower !== tower && tower) {
      // update tower if unit exists
      await prisma.unit.update({
        where: { id: unit.id },
        data: { tower },
      });
    }

    const existingUnitResidents = await prisma.resident.count({ where: { unitId: unit.id } });

    const resident = await prisma.resident.create({
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

    // Fetch user for email and managers for notification
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const managers = await prisma.manager.findMany({
      where: { propertyId: property.id },
      include: { user: true },
    });

    const managerEmails = managers
      .map((m) => m.user?.email)
      .filter((e): e is string => !!e);

    const targetManagerEmail = managerEmails.length > 0 ? managerEmails.join(', ') : null;

    // Send email alert to manager via SMTP
    sendResidentRegistrationEmailToManager({
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

    return sendSuccess(res, 201, 'Registration request submitted for approval', resident);
  } catch (err) { next(err); }
};

export const getPendingResidents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user?.propertyId;
    const pending = await prisma.resident.findMany({
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
    return sendSuccess(res, 200, 'Pending resident requests fetched', pending);
  } catch (err) { next(err); }
};

export const approveResident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const resident = await prisma.resident.findUnique({
      where: { id },
      include: { unit: { include: { property: true } }, user: true },
    });
    if (!resident) return next(new AppError('Resident request not found', 404));

    const updated = await prisma.resident.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { unit: { include: { property: true } }, user: true },
    });

    await auditLog(req.user!.userId, 'APPROVE_RESIDENT', 'Resident', resident.id);

    // Send confirmation email via SMTP to resident
    if (resident.user?.email) {
      sendResidentApprovalNotificationToResident(
        resident.user.email,
        resident.name,
        resident.unit?.property?.name || 'Society Security',
        resident.unit?.unitNumber || '',
        resident.unit?.tower || 'Block A'
      ).catch((err) => console.error('Failed to send resident approval email:', err));
    }

    return sendSuccess(res, 200, 'Resident approved successfully', updated);
  } catch (err) { next(err); }
};

export const rejectResident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const resident = await prisma.resident.findUnique({ where: { id } });
    if (!resident) return next(new AppError('Resident request not found', 404));

    const updated = await prisma.resident.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await auditLog(req.user!.userId, 'REJECT_RESIDENT', 'Resident', resident.id);

    return sendSuccess(res, 200, 'Resident request rejected', updated);
  } catch (err) { next(err); }
};


export const getAllResidents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Scope to the caller's own property. req.user!.propertyId is undefined
        // for COMMITTEE (no property link in the schema today), which leaves
        // committee access unscoped exactly as before — this only tightens the
        // MANAGER path, which previously leaked residents across all properties.
        // ?deleted=true surfaces the "Delete Family" history view instead of
        // the normal directory — same shape, just the opposite isDeleted filter.
        const showDeleted = req.query.deleted === 'true';
        const residents = await prisma.resident.findMany({
            where: {
                status: 'APPROVED',
                unit: {
                    isDeleted: showDeleted,
                    ...(req.user!.propertyId ? { propertyId: req.user!.propertyId } : {}),
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
        const familyMap = new Map<string, any>();

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
                    vehicles: (r.unit as any).vehicles || [],
                    pets: (r.unit as any).pets || [],
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
        return sendSuccess(res, 200, 'Families fetched', families);
    } catch (err) { next(err); }
};

export const getFamilyDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unitId = req.params.unitId as string;
        const unit = await prisma.unit.findUnique({
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
        if (!unit) return next(new AppError('Unit not found', 404));

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
        return sendSuccess(res, 200, 'Family details fetched', result);
    } catch (err) { next(err); }
};

export const uploadResidentDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = req.file;
        if (!file) return next(new AppError('No document file uploaded', 400));

        const { uploadBuffer } = await import('../../utils/objectStorage.util');
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `resident-documents/${Date.now()}-${safeFilename}`;
        const url = await uploadBuffer(file.buffer, path, file.mimetype);

        return sendSuccess(res, 201, 'Document uploaded successfully', {
            url,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
        });
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
                data: { phone: formattedPhone, role: 'RESIDENT' },
                include: { resident: true }
            });
        }
        
        const resident = await prisma.resident.create({
            data: {
                userId: user!.id,
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

export const onboardHousehold = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { familyName, unit: unitNumber, tower, floor, members } = req.body;
        
        const result = await prisma.$transaction(async (tx) => {
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
            } else if (familyName && !unit.familyName) {
                unit = await tx.unit.update({
                    where: { id: unit.id },
                    data: { familyName }
                });
            }
            
            const allFormattedPhones = members.map((m: any) => m.phone ? (m.phone.startsWith('+') ? m.phone : `+91${m.phone}`) : undefined).filter(Boolean);
            const allEmails = members.map((m: any) => m.email).filter(Boolean);

            const existingUsers = await tx.user.findMany({
                where: {
                    OR: [
                        { phone: { in: allFormattedPhones as string[] } },
                        { email: { in: allEmails as string[] } }
                    ]
                },
                include: { resident: true }
            });
            
            const createdResidents = [];
            
            for (const member of members) {
                if (!member.phone && !member.email) {
                    throw new AppError('Each member must have at least a phone number or email.', 400);
                }

                if (!member.password || member.password.length < 6) {
                    throw new AppError(`Password for ${member.name} must be at least 6 characters.`, 400);
                }

                const passwordHash = await bcrypt.hash(member.password, 10);
                const formattedPhone = member.phone 
                    ? (member.phone.startsWith('+') ? member.phone : `+91${member.phone}`)
                    : undefined;

                let user = existingUsers.find((u: any) => 
                    (formattedPhone && u.phone === formattedPhone) || 
                    (member.email && u.email === member.email)
                );

                if (user) {
                    if (user.role !== 'RESIDENT') {
                        throw new AppError(`${formattedPhone || member.email} belongs to a staff or admin account and cannot be modified.`, 403);
                    }
                    if (user.resident) {
                        throw new AppError(`${formattedPhone || member.email} is already registered to a resident.`, 400);
                    }
                }

                if (!user) {
                    user = await tx.user.create({
                        data: { phone: formattedPhone, email: member.email, role: 'RESIDENT', passwordHash },
                        include: { resident: true }
                    });
                } else {
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
                        userId: user!.id,
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
        
        await auditLog(req.user!.userId, 'ONBOARD_HOUSEHOLD', 'Unit', result.unitId);
        io?.to(`unit_${result.unitId}`).emit('household_updated', { unitId: result.unitId });

        return sendSuccess(res, 201, 'Household onboarded successfully', result.createdResidents);
    } catch (err) { next(err); }
};

export const updateHousehold = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unitId = req.params.unitId as string;
        const { familyName, unit: unitNumber, tower, floor, members } = req.body;
        
        const result = await prisma.$transaction(async (tx) => {
            let unit = await tx.unit.findUnique({ 
                where: { id: unitId },
                include: { residents: { include: { user: true } } }
            });
            if (!unit) {
                throw new AppError('Household not found', 404);
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
            const incomingMemberIds = members.filter((m: any) => m.id).map((m: any) => m.id);
            
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

            const allFormattedPhones = members.map((m: any) => m.phone ? (m.phone.startsWith('+') ? m.phone : `+91${m.phone}`) : undefined).filter(Boolean);
            const allEmails = members.map((m: any) => m.email).filter(Boolean);

            const existingUsers = await tx.user.findMany({
                where: {
                    OR: [
                        { phone: { in: allFormattedPhones as string[] } },
                        { email: { in: allEmails as string[] } }
                    ]
                },
                include: { resident: true }
            });

            const updatedResidents = [];
            
            for (const member of members) {
                if (!member.phone && !member.email) {
                    throw new AppError('Each member must have at least a phone number or email.', 400);
                }

                const formattedPhone = member.phone 
                    ? (member.phone.startsWith('+') ? member.phone : `+91${member.phone}`)
                    : null;

                let passwordHash = undefined;
                if (member.password && member.password.length >= 6) {
                    passwordHash = await bcrypt.hash(member.password, 10);
                }

                if (member.id) {
                    const resident = unit.residents.find(r => r.id === member.id);
                    if (!resident) continue;

                    let conflictingUser = existingUsers.find((u: any) => 
                        u.id !== resident.userId &&
                        ((formattedPhone && u.phone === formattedPhone) || 
                        (member.email && u.email === member.email))
                    );
                    if (conflictingUser) {
                        throw new AppError(`Phone or email is already in use by another user.`, 400);
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
                } else {
                    if (!member.password || member.password.length < 6) {
                        throw new AppError(`Password for ${member.name} must be at least 6 characters.`, 400);
                    }
                    const newPasswordHash = await bcrypt.hash(member.password, 10);

                    let user = existingUsers.find((u: any) => 
                        (formattedPhone && u.phone === formattedPhone) || 
                        (member.email && u.email === member.email)
                    );

                    if (user) {
                        if (user.role !== 'RESIDENT') {
                            throw new AppError(`${formattedPhone || member.email} belongs to a staff or admin account and cannot be modified.`, 403);
                        }
                        if (user.resident) {
                            throw new AppError(`${formattedPhone || member.email} is already registered to a resident.`, 400);
                        }
                    }

                    if (!user) {
                        user = await tx.user.create({
                            data: { phone: formattedPhone, email: member.email, role: 'RESIDENT', passwordHash: newPasswordHash },
                            include: { resident: true }
                        });
                    } else {
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
                            userId: user!.id,
                            unitId: unit!.id,
                            name: member.name,
                            relationship: member.relationship,
                            isPrimary: member.isPrimary
                        }
                    });
                    updatedResidents.push(resident);
                }
            }
            return { unitId: unit!.id, updatedResidents };
        });
        
        await auditLog(req.user!.userId, 'UPDATE_HOUSEHOLD', 'Unit', result.unitId);
        io?.to(`unit_${result.unitId}`).emit('household_updated', { unitId: result.unitId });

        return sendSuccess(res, 200, 'Household updated successfully', result.updatedResidents);
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
        io?.to(`unit_${resident.unitId}`).emit('household_updated', { unitId: resident.unitId });

        return sendSuccess(res, 200, 'Resident deactivated successfully');
    } catch (err) { next(err); }
};

// "Delete Family" — deactivates every member's login (same effect as
// suspending each of them) and hides the unit from the directory going
// forward, but keeps the unit/residents and everything tied to them
// (passes, complaints, entries, invoices) intact for history/audit.
export const deleteFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unitId = req.params.unitId as string;
        const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { residents: true } });
        if (!unit || unit.propertyId !== req.user!.propertyId) {
            return next(new AppError('Household not found', 404));
        }

        await prisma.$transaction([
            ...unit.residents.map(r => prisma.user.update({ where: { id: r.userId }, data: { isActive: false } })),
            prisma.unit.update({ where: { id: unitId }, data: { isDeleted: true } }),
        ]);

        await auditLog(req.user!.userId, 'DELETE_FAMILY', 'Unit', unitId);
        return sendSuccess(res, 200, 'Family deleted successfully');
    } catch (err) { next(err); }
};

// Undoes deleteFamily — reinstates the unit in the directory and restores
// every member's login access.
export const restoreFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const unitId = req.params.unitId as string;
        const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { residents: true } });
        if (!unit || unit.propertyId !== req.user!.propertyId) {
            return next(new AppError('Household not found', 404));
        }

        await prisma.$transaction([
            ...unit.residents.map(r => prisma.user.update({ where: { id: r.userId }, data: { isActive: true } })),
            prisma.unit.update({ where: { id: unitId }, data: { isDeleted: false } }),
        ]);

        await auditLog(req.user!.userId, 'RESTORE_FAMILY', 'Unit', unitId);
        return sendSuccess(res, 200, 'Family restored successfully');
    } catch (err) { next(err); }
};

// Gate for sharing a resident's plaintext login credentials (PDF via
// WhatsApp/email) — caps how many times a manager can re-send the same
// account's password. Doesn't send anything itself, just claims one of the
// limited shares; the frontend generates/shares the PDF only if this succeeds.
export const shareResidentCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const resident = await prisma.resident.findUnique({ where: { id }, include: { unit: { select: { propertyId: true } } } });
        if (!resident || resident.unit.propertyId !== req.user!.propertyId) {
            return next(new AppError('Resident not found', 404));
        }

        const { tryConsumeCredentialShare, MAX_CREDENTIAL_SHARES } = await import('../../utils/credentialShare.util');
        const allowed = await tryConsumeCredentialShare(resident.userId);
        if (!allowed) {
            return next(new AppError(`This resident's credentials have already been shared the maximum of ${MAX_CREDENTIAL_SHARES} times.`, 403));
        }

        await auditLog(req.user!.userId, 'SHARE_RESIDENT_CREDENTIAL', 'Resident', id);
        return sendSuccess(res, 200, 'Credential share allowed');
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
