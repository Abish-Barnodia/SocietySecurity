import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { redis } from '../../config/redis';

export const syncOfflineEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entries } = req.body;  // Array of locally queued entry records
    const guardId = req.user!.guardId!;

    const results = [];

    for (const e of entries) {
      // Idempotency: skip if already synced (use client-generated localId)
      // Usually you'd store localId on the Entry model to check this easily, 
      // but here we just check for identical entries near this time
      const exists = await prisma.entry.findFirst({
        where: { guardId, entryAt: new Date(e.entryAt), passId: e.passId ?? undefined },
      });
      if (exists) {
        results.push({ localId: e.localId, synced: false, reason: 'DUPLICATE' });
        continue;
      }

      const created = await prisma.entry.create({
        data: {
          unitId: e.unitId,
          passId: e.passId,
          guardId,
          entryPointId: e.entryPointId,
          visitorName: e.visitorName,
          visitorPhone: e.visitorPhone,
          vehicleNumber: e.vehicleNumber,
          method: e.method,
          status: e.status,
          gatePhotoUrl: e.gatePhotoUrl,
          entryAt: new Date(e.entryAt),
        },
      });
      results.push({ localId: e.localId, synced: true, serverId: created.id });
    }

    sendSuccess(res, 200, 'Synced successfully', { results, total: entries.length });
  } catch (err) { next(err); }
};

export const getPassCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Returns the active pass set for this property — used to seed guard's offline cache
    const guardId = req.user!.guardId!;
    const guard = await prisma.guard.findUnique({ where: { id: guardId } });
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
