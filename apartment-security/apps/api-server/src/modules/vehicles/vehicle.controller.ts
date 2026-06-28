import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { triggerAlert } from '../../utils/alert.util';

export const registerVehicle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationNo, make, model, color } = req.body;
    
    // We assume the user is a resident for this route based on RBAC
    const resident = await prisma.resident.findUnique({
      where: { userId: req.user!.userId }
    });
    
    if (!resident) return next(new AppError('Resident not found', 404));
    const unitId = resident.unitId;

    const existing = await prisma.vehicle.findFirst({
      where: { unitId, registrationNo: registrationNo.toUpperCase() },
    });
    if (existing) return next(new AppError('Vehicle already registered to this unit', 409));

    const vehicle = await prisma.vehicle.create({
      data: {
        unitId,
        registrationNo: registrationNo.toUpperCase(),
        make,
        model,
        color,
        isResident: true,
      },
    });

    sendSuccess(res, 201, 'Vehicle registered', vehicle);
  } catch (err) { next(err); }
};

export const checkVehicle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Called by guard on ANPR match or manual plate lookup
    const registrationNo = req.params.registrationNo as string;
    const guardId = req.user!.guardId!;
    const guard = await prisma.guard.findUnique({ where: { id: guardId } });
    if (!guard) return next(new AppError('Guard not found', 404));

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        registrationNo: registrationNo.toUpperCase(),
        unit: { propertyId: guard.propertyId },
        isActive: true,
      },
      include: { unit: { include: { residents: { where: { isPrimary: true } } } } },
    });

    if (!vehicle) {
      // Unregistered — fire P2 alert
      await triggerAlert({
        priority: 'P2',
        title: 'Unregistered vehicle',
        body: `Vehicle ${registrationNo.toUpperCase()} is not in the registry`,
        targetRoles: ['MANAGER'],
        propertyId: guard.propertyId,
      });
      return sendSuccess(res, 200, 'Unregistered', { registered: false, registrationNo });
    }

    sendSuccess(res, 200, 'Registered', {
      registered: true,
      vehicle,
      unit: vehicle.unit.unitNumber,
      resident: vehicle.unit.residents[0]?.name,
    });
  } catch (err) { next(err); }
};
