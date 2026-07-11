import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { io } from '../../server';

export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = req.user!;
    const limit = parseInt(req.query.limit as string) || 50;
    const cursor = req.query.cursor as string | undefined;

    if (!propertyId) {
      throw new AppError('User does not belong to a property', 400);
    }

    const messages = await prisma.communityMessage.findMany({
      where: { propertyId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            resident: { select: { name: true, unit: { select: { unitNumber: true } } } },
            guard: { select: { name: true } },
            manager: { select: { name: true } },
            committee: { select: { name: true } },
          },
        },
      },
    });

    // Formatting sender name for frontend
    const formattedMessages = messages.map(msg => {
      let senderName = 'Unknown';
      let unitNumber = null;
      let senderRole = 'RESIDENT';
      if (msg.sender.resident) {
        senderName = msg.sender.resident.name;
        unitNumber = msg.sender.resident.unit?.unitNumber;
      } else if (msg.sender.guard) {
        senderName = msg.sender.guard.name;
        senderRole = 'GUARD';
      } else if (msg.sender.manager) {
        senderName = msg.sender.manager.name;
        senderRole = 'MANAGER';
      } else if (msg.sender.committee) {
        senderName = msg.sender.committee.name;
        senderRole = 'COMMITTEE';
      }

      return {
        id: msg.id,
        content: msg.content,
        type: msg.type,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
        replyToId: msg.replyToId,
        isPinned: msg.isPinned,
        isEdited: msg.isEdited,
        senderId: msg.senderId,
        senderName,
        senderRole,
        unitNumber,
      };
    });

    return sendSuccess(res, 200, 'Messages retrieved', {
      messages: formattedMessages.reverse(), // reverse to show oldest first in UI
      nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, userId } = req.user!;
    const { content, type, metadata, replyToId } = req.body;

    if (!propertyId) {
      throw new AppError('User does not belong to a property', 400);
    }

    const message = await prisma.communityMessage.create({
      data: {
        propertyId,
        senderId: userId,
        content: content || '',
        type: type || 'TEXT',
        metadata: metadata || null,
        replyToId: replyToId || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            resident: { select: { name: true, unit: { select: { unitNumber: true } } } },
            guard: { select: { name: true } },
            manager: { select: { name: true } },
            committee: { select: { name: true } },
          },
        },
      },
    });

    let senderName = 'Unknown';
    let unitNumber = null;
    let senderRole = 'RESIDENT';
    if (message.sender.resident) {
      senderName = message.sender.resident.name;
      unitNumber = message.sender.resident.unit?.unitNumber;
    } else if (message.sender.guard) {
      senderName = message.sender.guard.name;
      senderRole = 'GUARD';
    } else if (message.sender.manager) {
      senderName = message.sender.manager.name;
      senderRole = 'MANAGER';
    } else if (message.sender.committee) {
      senderName = message.sender.committee.name;
      senderRole = 'COMMITTEE';
    }

    const formattedMessage = {
      id: message.id,
      content: message.content,
      type: message.type,
      metadata: message.metadata,
      createdAt: message.createdAt,
      replyToId: message.replyToId,
      isPinned: message.isPinned,
      isEdited: message.isEdited,
      senderId: message.senderId,
      senderName,
      senderRole,
      unitNumber,
    };

    // Broadcast to everyone in the property via Socket.io
    io.to(`property:${propertyId}`).emit('new_community_message', formattedMessage);

    return sendSuccess(res, 201, 'Message sent', formattedMessage);
  } catch (error) {
    next(error);
  }
};

// ponytail: Physical delete, minimum effective code.
export const deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, userId, role } = req.user!;
    const id = String(req.params.id);

    const message = await prisma.communityMessage.findUnique({ where: { id } });
    if (!message) throw new AppError('Message not found', 404);
    if (message.propertyId !== propertyId) throw new AppError('Forbidden: Message belongs to a different property', 403);

    // Only sender or Manager can delete
    if (message.senderId !== userId && role !== 'MANAGER') {
      throw new AppError('Unauthorized to delete this message', 403);
    }

    await prisma.communityMessage.delete({ where: { id } });

    io.to(`property:${propertyId}`).emit('delete_community_message', id);

    return sendSuccess(res, 200, 'Message deleted');
  } catch (error) {
    next(error);
  }
};

export const votePoll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, userId } = req.user!;
    const id = String(req.params.id);
    const { optionId } = req.body;

    const message = await prisma.communityMessage.findUnique({ where: { id } });
    if (!message || message.type !== 'POLL' || !message.metadata) {
      throw new AppError('Poll not found', 404);
    }
    if (message.propertyId !== propertyId) throw new AppError('Forbidden: Poll belongs to a different property', 403);

    let metadata = message.metadata as any;
    let options = metadata.options || [];

    // Remove user's previous vote if any
    options = options.map((opt: any) => ({
      ...opt,
      votes: (opt.votes || []).filter((vId: string) => vId !== userId),
    }));

    // Add user's new vote
    options = options.map((opt: any) => {
      if (opt.id === optionId) {
        return { ...opt, votes: [...(opt.votes || []), userId] };
      }
      return opt;
    });

    metadata.options = options;

    const updatedMessage = await prisma.communityMessage.update({
      where: { id },
      data: { metadata } as any,
    });

    io.to(`property:${propertyId}`).emit('poll_voted', { messageId: id, metadata });

    return sendSuccess(res, 200, 'Voted successfully');
  } catch (error) {
    next(error);
  }
};

export const reactMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, userId } = req.user!;
    const id = String(req.params.id);
    const { reaction } = req.body;

    const message = await prisma.communityMessage.findUnique({ where: { id } });
    if (!message) throw new AppError('Message not found', 404);
    if (message.propertyId !== propertyId) throw new AppError('Forbidden: Message belongs to a different property', 403);

    let metadata: any = message.metadata || {};
    let reactions: any = metadata.reactions || {};

    if (!reactions[reaction]) reactions[reaction] = [];

    const userIndex = reactions[reaction].indexOf(userId);
    if (userIndex > -1) {
      reactions[reaction].splice(userIndex, 1); // remove reaction
      if (reactions[reaction].length === 0) delete reactions[reaction];
    } else {
      reactions[reaction].push(userId); // add reaction
    }

    metadata.reactions = reactions;

    const updatedMessage = await prisma.communityMessage.update({
      where: { id },
      data: { metadata } as any,
    });

    io.to(`property:${propertyId}`).emit('message_updated', { messageId: id, updates: { metadata } });

    return sendSuccess(res, 200, 'Reaction updated');
  } catch (error) {
    next(error);
  }
};

export const editMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, userId } = req.user!;
    const id = String(req.params.id);
    const { content } = req.body;

    const message = await prisma.communityMessage.findUnique({ where: { id } });
    if (!message) throw new AppError('Message not found', 404);
    if (message.propertyId !== propertyId) throw new AppError('Forbidden: Message belongs to a different property', 403);

    if (message.senderId !== userId) {
      throw new AppError('Unauthorized to edit this message', 403);
    }

    // Time limit: 15 minutes to edit
    const timeDiff = new Date().getTime() - message.createdAt.getTime();
    if (timeDiff > 15 * 60 * 1000) {
      throw new AppError('Edit time limit expired', 400);
    }

    const updatedMessage = await prisma.communityMessage.update({
      where: { id },
      data: { content, isEdited: true } as any,
    });

    io.to(`property:${propertyId}`).emit('message_updated', { messageId: id, updates: { content, isEdited: true } });

    return sendSuccess(res, 200, 'Message edited');
  } catch (error) {
    next(error);
  }
};

export const pinMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, role } = req.user!;
    const id = String(req.params.id);
    const { isPinned } = req.body;

    // Only Managers or Committee can pin
    if (role !== 'MANAGER' && role !== 'COMMITTEE') {
      throw new AppError('Unauthorized to pin messages', 403);
    }

    const message = await prisma.communityMessage.findUnique({ where: { id } });
    if (!message) throw new AppError('Message not found', 404);
    if (message.propertyId !== propertyId) throw new AppError('Forbidden: Message belongs to a different property', 403);

    const updatedMessage = await prisma.communityMessage.update({
      where: { id },
      data: { isPinned } as any,
    });

    io.to(`property:${propertyId}`).emit('message_updated', { messageId: id, updates: { isPinned } });

    return sendSuccess(res, 200, 'Message pinned status updated');
  } catch (error) {
    next(error);
  }
};

export const uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, userId } = req.user!;
    const { replyToId } = req.body;
    
    if (!propertyId) throw new AppError('User does not belong to a property', 400);

    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'audio/mpeg', 'audio/aac'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      throw new AppError('Invalid file type uploaded. Allowed types: JPEG, PNG, WEBP, GIF, PDF, MP4, MP3, AAC.', 400);
    }

    const fileUrl = `/public/uploads/${req.file.filename}`;
    // simple heuristic for type
    const mime = req.file.mimetype;
    let type = 'TEXT';
    if (mime.startsWith('image/')) type = 'IMAGE';
    else if (mime.startsWith('audio/') || mime.startsWith('video/')) type = 'VOICE';
    else type = 'DOCUMENT';

    const message = await prisma.communityMessage.create({
      data: {
        propertyId,
        senderId: userId,
        content: '',
        type: 'TEXT', // Wait, type in schema doesn't have IMAGE/VOICE/DOCUMENT yet, let's keep TEXT and use metadata
        metadata: { mediaUrl: fileUrl, mediaType: type, fileName: req.file.originalname },
        replyToId: replyToId ? String(replyToId) : null,
      } as any,
      include: {
        sender: {
          select: {
            id: true,
            resident: { select: { name: true, unit: { select: { unitNumber: true } } } },
            guard: { select: { name: true } },
            manager: { select: { name: true } },
            committee: { select: { name: true } },
          },
        },
      },
    });

    let senderName = 'Unknown';
    let unitNumber = null;
    let senderRole = 'RESIDENT';
    const msg: any = message;
    if (msg.sender?.resident) {
      senderName = msg.sender.resident.name;
      unitNumber = msg.sender.resident.unit?.unitNumber;
    } else if (msg.sender?.guard) {
      senderName = msg.sender.guard.name;
      senderRole = 'GUARD';
    } else if (msg.sender?.manager) {
      senderName = msg.sender.manager.name;
      senderRole = 'MANAGER';
    } else if (msg.sender?.committee) {
      senderName = msg.sender.committee.name;
      senderRole = 'COMMITTEE';
    }

    const formattedMessage = {
      id: msg.id,
      content: msg.content,
      type: msg.type,
      metadata: msg.metadata,
      createdAt: msg.createdAt,
      replyToId: msg.replyToId,
      isPinned: msg.isPinned,
      isEdited: msg.isEdited,
      senderId: msg.senderId,
      senderName,
      senderRole,
      unitNumber,
    };

    io.to(`property:${propertyId}`).emit('new_community_message', formattedMessage);

    return sendSuccess(res, 201, 'Media uploaded successfully', formattedMessage);
  } catch (error) {
    next(error);
  }
};

