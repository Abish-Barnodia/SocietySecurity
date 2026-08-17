import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';

export const getEscalationChains = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId;
    if (!propertyId) return next(new AppError('No property context found', 403));

    const chains = await prisma.escalationChain.findMany({
      where: { propertyId },
      orderBy: { priority: 'asc' },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            user: {
              select: {
                resident: { select: { name: true } },
                guard: { select: { name: true } },
                manager: { select: { name: true } },
                committee: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const formatted = chains.map((chain) => ({
      id: chain.id,
      priority: chain.priority,
      steps: chain.steps.map((step) => ({
        order: step.order,
        roleLabel: step.roleLabel,
        name: step.user?.manager?.name
          ?? step.user?.committee?.name
          ?? step.user?.guard?.name
          ?? step.user?.resident?.name
          ?? step.contactName
          ?? 'Unassigned',
        delayMinutes: step.delayMinutes,
        channel: step.channel,
      })),
    }));

    return sendSuccess(res, 200, 'Escalation chains fetched', formatted);
  } catch (err) { next(err); }
};
