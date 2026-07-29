import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';

export const getAllBroadcasts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      orderBy: { sentAt: 'desc' }
    });
    return sendSuccess(res, 200, 'All broadcasts fetched', broadcasts);
  } catch (err) { next(err); }
};

export const createBroadcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body, targetScope } = req.body;
    
    // Quick hack for ponytail MVP: just grab the first property since we assume single-property deployment
    const property = await prisma.property.findFirst();
    const propertyId = property ? property.id : "prop_123";
    
    const broadcast = await prisma.broadcast.create({
      data: {
        title,
        body,
        targetScope,
        propertyId,
        sentBy: req.user?.userId || "System"
      }
    });
    
    return sendSuccess(res, 201, 'Broadcast created successfully', broadcast);
  } catch (err) { next(err); }
};
