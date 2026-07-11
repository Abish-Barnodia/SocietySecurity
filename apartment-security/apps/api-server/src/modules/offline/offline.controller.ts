import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { redis } from '../../config/redis';

export const syncOfflineEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entries } = req.body;  // Array of locally queued entry records
    // Resolve guard via userId (guardId is NOT in the JWT payload)
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    if (!guard) return next(new AppError('Guard record not found', 404));
    const guardId = guard.id;

    const results: any[] = [];
    
    // Bulk fetch validation data
    const unitIds = [...new Set(entries.map((e: any) => e.unitId))];
    const units = await prisma.unit.findMany({ where: { id: { in: unitIds as string[] } } });
    const validUnitIds = new Set(units.filter(u => u.propertyId === guard.propertyId).map(u => u.id));

    const entryTimestamps = entries.map((e: any) => new Date(e.entryAt));
    const existingEntries = await prisma.entry.findMany({
      where: { guardId, entryAt: { in: entryTimestamps } }
    });

    const transactions = [];
    const localIdToTxIndex = new Map();

    for (const e of entries) {
      if (!validUnitIds.has(e.unitId)) {
        results.push({ localId: e.localId, synced: false, reason: 'FORBIDDEN_PROPERTY' });
        continue;
      }

      const passId = e.passId || null;
      const isDuplicate = existingEntries.some(
        ex => ex.entryAt.getTime() === new Date(e.entryAt).getTime() && ex.passId === passId
      );

      if (isDuplicate) {
        results.push({ localId: e.localId, synced: false, reason: 'DUPLICATE' });
        continue;
      }

      transactions.push(prisma.entry.create({
        data: {
          unitId: e.unitId,
          passId,
          guardId,
          entryPointId: e.entryPointId,
          visitorName: e.visitorName,
          visitorPhone: e.visitorPhone,
          vehicleNumber: e.vehicleNumber,
          method: e.method,
          status: e.status,
          gatePhotoUrl: e.gatePhotoUrl,
          entryAt: new Date(e.entryAt),
        }
      }));
      localIdToTxIndex.set(transactions.length - 1, e.localId);
    }

    if (transactions.length > 0) {
      const createdEntries = await prisma.$transaction(transactions);
      createdEntries.forEach((created, index) => {
        results.push({ localId: localIdToTxIndex.get(index), synced: true, serverId: created.id });
      });
    }

    sendSuccess(res, 200, 'Synced successfully', { results, total: entries.length });
  } catch (err) { next(err); }
};

export const getPassCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Returns the active pass set for this property — used to seed guard's offline cache
    // Resolve guard via userId (guardId is NOT in the JWT payload)
    const guard = await prisma.guard.findUnique({ where: { userId: req.user!.userId } });
    const propertyId = guard?.propertyId;
    
    if (!propertyId) return sendSuccess(res, 400, 'Property not found', []);

    const cacheKey = `pass_cache:property:${propertyId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return sendSuccess(res, 200, 'From cache', JSON.parse(cached));
    }

    const passes = await prisma.pass.findMany({
      where: {
        unit: { propertyId },
        status: 'ACTIVE',
        validUntil: { gt: new Date() },
      },
      select: {
        id: true,
        qrPayload: true,
        otpCode: true,
        visitorName: true,
        unitId: true,
        type: true,
        validFrom: true,
        validUntil: true,
        entryPointIds: true,
        recurringRule: true,
      },
    });

    await redis.setex(cacheKey, 900, JSON.stringify(passes)); // 15 min TTL

    sendSuccess(res, 200, 'From database', passes);
  } catch (err) { next(err); }
};
