import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { io } from '../../server';
import { uploadBuffer } from '../../utils/firebaseStorage.util';
import { getResidentContext } from '../../utils/residentContext.util';

const messageInclude = {
  sender: {
    select: {
      id: true,
      role: true,
      resident: {
        select: {
          name: true,
          showUnitInCommunity: true,
          unit: { select: { unitNumber: true, tower: true } },
        },
      },
    },
  },
  replyTo: {
    select: {
      id: true,
      type: true,
      body: true,
      sender: { select: { id: true, resident: { select: { name: true } } } },
    },
  },
  reactions: true,
  poll: {
    include: {
      options: {
        orderBy: { order: 'asc' as const },
        include: { votes: { select: { userId: true, optionId: true } } },
      },
    },
  },
};

// A resident can opt out of showing their unit number in Community (Privacy
// setting) — strip it here rather than trusting the client to hide it, and
// drop the flag itself since it's an internal-only field.
const redactSenderPrivacy = (message: any) => {
  const resident = message.sender?.resident;
  if (!resident) return message;
  const { showUnitInCommunity, ...rest } = resident;
  return {
    ...message,
    sender: { ...message.sender, resident: { ...rest, unit: showUnitInCommunity === false ? null : rest.unit } },
  };
};

export const listMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const messages = await prisma.chatMessage.findMany({
      where: { propertyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: messageInclude,
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? page[page.length - 1]!.id : null;

    sendSuccess(res, 200, 'Messages retrieved', { messages: page.map(redactSenderPrivacy), nextCursor });
  } catch (err) { next(err); }
};

export const createMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { residentId, propertyId } = await getResidentContext(req.user!.userId);
    const {
      type, body, mediaUrl, mediaMimeType, mediaDurationSec,
      fileName, fileSizeBytes, replyToId, mentionedUserIds, poll,
    } = req.body;

    if (type === 'POLL' && !poll) {
      return next(new AppError('poll is required when type is POLL', 400));
    }

    const created = await prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          propertyId,
          senderId: req.user!.userId,
          type,
          body,
          mediaUrl,
          mediaMimeType,
          mediaDurationSec,
          fileName,
          fileSizeBytes,
          replyToId,
          mentionedUserIds: mentionedUserIds ?? [],
        },
      });

      if (type === 'POLL' && poll) {
        await tx.chatPoll.create({
          data: {
            messageId: message.id,
            question: poll.question,
            allowMultiple: poll.allowMultiple ?? false,
            options: {
              create: poll.options.map((text: string, order: number) => ({ text, order })),
            },
          },
        });
      }

      return message;
    });

    const full = await prisma.chatMessage.findUnique({
      where: { id: created.id },
      include: messageInclude,
    });
    const redacted = redactSenderPrivacy(full);

    io?.to(`property:${propertyId}`).emit('community:message:new', redacted);

    sendSuccess(res, 201, 'Message sent', redacted);
  } catch (err) { next(err); }
};

export const deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const messageId = req.params.id as string;
    const userId = req.user!.userId;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.propertyId !== propertyId) {
      return next(new AppError('Message not found', 404));
    }

    if (message.senderId !== userId) {
      return next(new AppError('You can only delete your own messages', 403));
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    io?.to(`property:${propertyId}`).emit('community:message:delete', { messageId });

    sendSuccess(res, 200, 'Message deleted', null);
  } catch (err) { next(err); }
};

export const toggleReaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const messageId = req.params.id as string;
    const { emoji } = req.body;
    const userId = req.user!.userId;

    const message = await prisma.chatMessage.findFirst({ where: { id: messageId, propertyId } });
    if (!message) return next(new AppError('Message not found', 404));

    const existing = await prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await prisma.chatReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.chatReaction.create({ data: { messageId, userId, emoji } });
    }

    const reactions = await prisma.chatReaction.findMany({ where: { messageId } });
    io?.to(`property:${propertyId}`).emit('community:reaction:update', { messageId, reactions });

    sendSuccess(res, 200, 'Reaction updated', reactions);
  } catch (err) { next(err); }
};

export const votePoll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const pollId = req.params.pollId as string;
    const { optionId } = req.body;
    const userId = req.user!.userId;

    const poll = await prisma.chatPoll.findUnique({
      where: { id: pollId },
      include: { message: { select: { propertyId: true } }, options: true },
    });
    if (!poll || poll.message.propertyId !== propertyId) return next(new AppError('Poll not found', 404));

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) return next(new AppError('Option not found on this poll', 404));

    await prisma.$transaction(async (tx) => {
      if (!poll.allowMultiple) {
        await tx.chatPollVote.deleteMany({
          where: { userId, optionId: { in: poll.options.map((o) => o.id) }, NOT: { optionId } },
        });
      }
      await tx.chatPollVote.upsert({
        where: { optionId_userId: { optionId, userId } },
        create: { optionId, userId },
        update: {},
      });
    });

    const options = await prisma.chatPollOption.findMany({
      where: { pollId },
      orderBy: { order: 'asc' },
      include: { votes: { select: { userId: true, optionId: true } } },
    });

    io?.to(`property:${propertyId}`).emit('community:poll:vote', { pollId, options });

    sendSuccess(res, 200, 'Vote recorded', options);
  } catch (err) { next(err); }
};

export const searchMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return sendSuccess(res, 200, 'Search results', []);

    const messages = await prisma.chatMessage.findMany({
      where: { propertyId, deletedAt: null, body: { contains: q, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: messageInclude,
    });

    sendSuccess(res, 200, 'Search results', messages.map(redactSenderPrivacy));
  } catch (err) { next(err); }
};

export const listMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);

    const residents = await prisma.resident.findMany({
      where: { unit: { propertyId } },
      select: {
        id: true,
        userId: true,
        name: true,
        showUnitInCommunity: true,
        unit: { select: { unitNumber: true, tower: true } },
      },
      orderBy: { name: 'asc' },
    });

    const redacted = residents.map(({ showUnitInCommunity, ...r }) => ({
      ...r,
      unit: showUnitInCommunity === false ? null : r.unit,
    }));

    sendSuccess(res, 200, 'Members retrieved', redacted);
  } catch (err) { next(err); }
};

const ALLOWED_UPLOAD_MIME = /^(image\/|video\/|audio\/|application\/pdf$|application\/msword$|application\/vnd\.)/;

export const uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const file = req.file;
    if (!file) return next(new AppError('No file uploaded', 400));
    if (!ALLOWED_UPLOAD_MIME.test(file.mimetype)) {
      return next(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
    }

    const path = `community/${propertyId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const url = await uploadBuffer(file.buffer, path, file.mimetype);

    sendSuccess(res, 201, 'Uploaded', {
      url,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      fileName: file.originalname,
    });
  } catch (err) { next(err); }
};
