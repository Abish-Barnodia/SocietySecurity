import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { uploadBuffer } from '../../utils/objectStorage.util';
import { getResidentContext } from '../../utils/residentContext.util';

// Workers are registered per-unit and visible to every resident of that unit
// (household members share the same domestic staff), matching how Household
// members already share a unit in resident.controller.ts's getUnitResidents.
export const listWorkers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitId } = await getResidentContext(req.user!.userId);

    const workers = await prisma.domesticWorker.findMany({
      where: { unitId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, 200, 'Domestic workers retrieved', workers);
  } catch (err) { next(err); }
};

export const createWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { residentId, unitId } = await getResidentContext(req.user!.userId);
    const { name, phone, type, address, photoUrl, govtIdType, govtIdNumber, workingDays, entryTime, exitTime, notes } = req.body;

    const worker = await prisma.domesticWorker.create({
      data: {
        unitId,
        registeredById: residentId,
        name,
        phone,
        type,
        address,
        photoUrl,
        govtIdType,
        govtIdNumber,
        workingDays,
        entryTime,
        exitTime,
        notes,
      },
    });

    await auditLog(req.user!.userId, 'REGISTER_DOMESTIC_WORKER', 'DomesticWorker', worker.id);

    sendSuccess(res, 201, 'Domestic worker registered', worker);
  } catch (err) { next(err); }
};

const findOwnedWorker = async (workerId: string, unitId: string) => {
  const worker = await prisma.domesticWorker.findUnique({ where: { id: workerId } });
  if (!worker || worker.unitId !== unitId || !worker.isActive) return null;
  return worker;
};

export const getWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitId } = await getResidentContext(req.user!.userId);
    const worker = await findOwnedWorker(req.params.id as string, unitId);
    if (!worker) return next(new AppError('Domestic worker not found', 404));

    sendSuccess(res, 200, 'Domestic worker retrieved', worker);
  } catch (err) { next(err); }
};

export const updateWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitId } = await getResidentContext(req.user!.userId);
    const existing = await findOwnedWorker(req.params.id as string, unitId);
    if (!existing) return next(new AppError('Domestic worker not found', 404));

    const { name, phone, type, address, photoUrl, govtIdType, govtIdNumber, workingDays, entryTime, exitTime, notes } = req.body;

    const worker = await prisma.domesticWorker.update({
      where: { id: existing.id },
      data: { name, phone, type, address, photoUrl, govtIdType, govtIdNumber, workingDays, entryTime, exitTime, notes },
    });

    await auditLog(req.user!.userId, 'UPDATE_DOMESTIC_WORKER', 'DomesticWorker', worker.id);

    sendSuccess(res, 200, 'Domestic worker updated', worker);
  } catch (err) { next(err); }
};

export const deleteWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitId } = await getResidentContext(req.user!.userId);
    const existing = await findOwnedWorker(req.params.id as string, unitId);
    if (!existing) return next(new AppError('Domestic worker not found', 404));

    await prisma.domesticWorker.update({
      where: { id: existing.id },
      data: { isActive: false }
    });

    await auditLog(req.user!.userId, 'DELETE_DOMESTIC_WORKER', 'DomesticWorker', existing.id);

    sendSuccess(res, 200, 'Domestic worker removed');
  } catch (err) { next(err); }
};

const ALLOWED_PHOTO_MIME = /^image\//;

export const uploadWorkerPhoto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const file = req.file;
    if (!file) return next(new AppError('No file uploaded', 400));
    if (!ALLOWED_PHOTO_MIME.test(file.mimetype)) {
      return next(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
    }

    const path = `domestic-workers/${propertyId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const url = await uploadBuffer(file.buffer, path, file.mimetype);

    sendSuccess(res, 201, 'Uploaded', { url, mimeType: file.mimetype, sizeBytes: file.size, fileName: file.originalname });
  } catch (err) { next(err); }
};
