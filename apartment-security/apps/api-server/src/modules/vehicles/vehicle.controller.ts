import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { triggerAlert } from '../../utils/alert.util';
import { syncParkingSlots } from '../../utils/parking.util';

// ponytail: no per-entry "expected duration" is tracked today, so overstay is
// a flat threshold per vehicle type rather than derived from a real booking
// window. Swap for Pass.validUntil (or a stored expected-duration) if that
// becomes available.
const OVERSTAY_THRESHOLD_MIN: Record<'DELIVERY' | 'CONTRACTOR' | 'VISITOR', number> = {
  DELIVERY: 30,
  CONTRACTOR: 240,
  VISITOR: 240,
};

const formatDuration = (mins: number) => {
  const m = Math.max(0, mins);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? '' : 's'}`;
};

type ResidentVehicleDetails = { make: string | null; model: string | null; color: string | null };

const getResidentVehicleRegs = async (propertyId: string) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { unit: { propertyId }, isResident: true, isActive: true },
    select: { registrationNo: true, make: true, model: true, color: true },
  });
  return new Map<string, ResidentVehicleDetails>(
    vehicles.map((v) => [v.registrationNo.toUpperCase(), { make: v.make, model: v.model, color: v.color }])
  );
};

const shapeVehicleEntry = (entry: any, residentRegs: Map<string, ResidentVehicleDetails>) => {
  const plate = (entry.vehicleNumber || '').toUpperCase();
  const residentVehicle = residentRegs.get(plate);
  const type: 'Resident' | 'Delivery' | 'Service' | 'Visitor' =
    residentVehicle ? 'Resident'
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
    passCode: entry.passId ? `PASS-${(entry.passId as string).slice(-4).toUpperCase()}` : null,
  };
};

const entryVehicleInclude = {
  unit: { select: { unitNumber: true, tower: true, residents: { where: { isPrimary: true }, select: { name: true }, take: 1 } } },
  pass: { select: { id: true, type: true } },
};

export const getParkingSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    if (!manager) return next(new AppError('Manager profile not found', 404));

    const property = await prisma.property.findUnique({ where: { id: manager.propertyId } });
    if (!property) return next(new AppError('Property not found', 404));

    const presentEntries = await prisma.entry.findMany({
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

    sendSuccess(res, 200, 'Parking summary fetched', {
      residentOccupied,
      residentTotal: property.residentParkingSlots,
      visitorOccupied,
      visitorTotal: property.visitorParkingSlots,
      overstays,
      availableSlots,
      currentlyPresent,
    });
  } catch (err) { next(err); }
};

export const getVehicleLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    if (!manager) return next(new AppError('Manager profile not found', 404));

    const entries = await prisma.entry.findMany({
      where: { unit: { propertyId: manager.propertyId }, vehicleNumber: { not: null } },
      include: entryVehicleInclude,
      orderBy: { entryAt: 'desc' },
      take: 100,
    });

    const residentRegs = await getResidentVehicleRegs(manager.propertyId);
    sendSuccess(res, 200, 'Vehicle log fetched', entries.map((e) => shapeVehicleEntry(e, residentRegs)));
  } catch (err) { next(err); }
};

export const updateParkingCapacity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    if (!manager) return next(new AppError('Manager profile not found', 404));

    const { residentParkingSlots, visitorParkingSlots } = req.body;
    const updated = await prisma.property.update({
      where: { id: manager.propertyId },
      data: { residentParkingSlots, visitorParkingSlots },
    });
    await syncParkingSlots(manager.propertyId, residentParkingSlots + visitorParkingSlots);
    sendSuccess(res, 200, 'Parking capacity updated', updated);
  } catch (err) { next(err); }
};

export const getParkingSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = await prisma.manager.findUnique({ where: { userId: req.user!.userId } });
    if (!manager) return next(new AppError('Manager profile not found', 404));

    const slots = await prisma.parkingSlot.findMany({
      where: { propertyId: manager.propertyId },
      orderBy: { code: 'asc' },
      include: { entry: { include: entryVehicleInclude } },
    });

    const residentRegs = await getResidentVehicleRegs(manager.propertyId);
    sendSuccess(res, 200, 'Parking slots fetched', slots.map((s) => ({
      id: s.id,
      code: s.code,
      zone: s.zone,
      vehicle: s.entry ? shapeVehicleEntry(s.entry, residentRegs) : null,
    })));
  } catch (err) { next(err); }
};

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
    const propertyId = req.user!.propertyId;
    if (!propertyId) return next(new AppError('Guard not found', 404));

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        registrationNo: registrationNo.toUpperCase(),
        unit: { propertyId },
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
        propertyId,
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
