import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { io } from '../../server';
import { uploadBuffer } from '../../utils/objectStorage.util';
import { getResidentContext, getCallerPropertyId } from '../../utils/residentContext.util';

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
      manager: { select: { name: true } },
    },
  },
  replyTo: {
    select: {
      id: true,
      type: true,
      body: true,
      sender: { select: { id: true, resident: { select: { name: true } }, manager: { select: { name: true } } } },
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
    // Both residents (reading their own feed) and managers (moderating it)
    // call this — resolve propertyId generically rather than assuming resident.
    const propertyId = await getCallerPropertyId(req.user!.userId);
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
    const propertyId = await getCallerPropertyId(req.user!.userId);
    const {
      type, body, mediaUrl, mediaMimeType, mediaDurationSec,
      fileName, fileSizeBytes, replyToId, mentionedUserIds, poll,
    } = req.body;

    if (req.user!.role === 'RESIDENT') {
      const { mutedFromCommunity } = await getResidentContext(req.user!.userId);
      if (mutedFromCommunity) {
        return next(new AppError('You have been muted from posting in the community', 403));
      }
    }

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
    const propertyId = await getCallerPropertyId(req.user!.userId);
    const messageId = req.params.id as string;
    const userId = req.user!.userId;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.propertyId !== propertyId) {
      return next(new AppError('Message not found', 404));
    }

    // A manager can moderate any message in their property; everyone else
    // can only remove their own.
    const isModerator = req.user!.role === 'MANAGER';
    if (message.senderId !== userId && !isModerator) {
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
    const propertyId = await getCallerPropertyId(req.user!.userId);
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
    const propertyId = await getCallerPropertyId(req.user!.userId);

    const residents = await prisma.resident.findMany({
      where: { unit: { propertyId }, status: 'APPROVED' },
      select: {
        id: true,
        userId: true,
        name: true,
        residentType: true,
        isPrimary: true,
        showUnitInCommunity: true,
        unit: { select: { unitNumber: true, tower: true } },
        user: { select: { phone: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });

    const isGuardOrManager = req.user!.role === 'GUARD' || req.user!.role === 'MANAGER';

    const redacted = residents.map(({ showUnitInCommunity, user, ...r }) => ({
      ...r,
      phone: user?.phone || null,
      email: user?.email || null,
      unit: !isGuardOrManager && showUnitInCommunity === false ? null : r.unit,
    }));

    sendSuccess(res, 200, 'Members retrieved', redacted);
  } catch (err) { next(err); }
};

export const getCommunityDirectoryHub = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);

    const [property, committee, guards, workers] = await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, name: true, address: true, city: true, pincode: true, email: true, phone: true },
      }),
      prisma.committeeMember.findMany({
        where: { user: { manager: { propertyId } } },
        include: { user: { select: { phone: true, email: true } } },
      }),
      prisma.guard.findMany({
        where: { propertyId },
        include: {
          user: { select: { phone: true, email: true } },
          postCheckIns: {
            orderBy: { checkedInAt: 'desc' },
            take: 1,
            include: { entryPoint: true },
          },
        },
      }),
      prisma.domesticWorker.findMany({
        where: { unit: { propertyId } },
        select: {
          id: true,
          name: true,
          phone: true,
          type: true,
          workingDays: true,
          entryTime: true,
          exitTime: true,
          photoUrl: true,
        },
      }),
    ]);

    const formattedGuards = guards.map((g) => ({
      id: g.id,
      userId: g.userId,
      name: g.name,
      phone: g.user?.phone || '9071773204',
      gate: g.postCheckIns[0]?.entryPoint?.name || 'MAIN GATE',
      badgeNumber: g.badgeNumber,
      isOnDuty: g.isOnDuty,
    }));

    const formattedCommittee = committee.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      phone: c.user?.phone || '9845012345',
      email: c.user?.email || null,
    }));

    sendSuccess(res, 200, 'Directory hub retrieved', {
      property,
      committee: formattedCommittee,
      guards: formattedGuards,
      workers,
    });
  } catch (err) { next(err); }
};

const ALLOWED_UPLOAD_MIME = /^(image\/|video\/|audio\/|application\/pdf$|application\/msword$|application\/vnd\.)/;

export const uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);
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

// --- Moderation: resident reports a message, manager reviews the queue ---

export const reportMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const messageId = req.params.id as string;
    const { reason } = req.body;

    const message = await prisma.chatMessage.findFirst({ where: { id: messageId, propertyId } });
    if (!message) return next(new AppError('Message not found', 404));

    const report = await prisma.chatReport.create({
      data: { messageId, reporterId: req.user!.userId, reason },
    });

    sendSuccess(res, 201, 'Message reported', report);
  } catch (err) { next(err); }
};

const reportInclude = {
  reporter: { select: { resident: { select: { name: true, unit: { select: { unitNumber: true, tower: true } } } } } },
  message: { include: messageInclude },
};

export const listReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);
    const reports = await prisma.chatReport.findMany({
      where: { message: { propertyId }, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: reportInclude,
    });
    sendSuccess(res, 200, 'Reports retrieved', reports.map((r) => ({ ...r, message: redactSenderPrivacy(r.message) })));
  } catch (err) { next(err); }
};

const resolveReportStatus = async (req: Request, res: Response, next: NextFunction, status: 'DISMISSED' | 'RESOLVED') => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);
    const reportId = req.params.id as string;

    const report = await prisma.chatReport.findUnique({ where: { id: reportId }, include: { message: true } });
    if (!report || report.message.propertyId !== propertyId) return next(new AppError('Report not found', 404));

    const updated = await prisma.chatReport.update({
      where: { id: reportId },
      data: { status, resolvedAt: new Date(), resolvedBy: req.user!.userId },
    });

    sendSuccess(res, 200, `Report ${status.toLowerCase()}`, updated);
  } catch (err) { next(err); }
};

export const dismissReport = (req: Request, res: Response, next: NextFunction) => resolveReportStatus(req, res, next, 'DISMISSED');
export const resolveReport = (req: Request, res: Response, next: NextFunction) => resolveReportStatus(req, res, next, 'RESOLVED');

// --- Manager-facing member roster + moderation ---

export const listMembersForManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);

    const residents = await prisma.resident.findMany({
      where: { unit: { propertyId } },
      select: {
        id: true,
        userId: true,
        name: true,
        isPrimary: true,
        mutedFromCommunity: true,
        createdAt: true,
        unit: { select: { unitNumber: true, tower: true } },
        user: { select: { isActive: true, _count: { select: { chatMessages: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, 200, 'Members retrieved', residents.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      unit: r.unit,
      role: r.isPrimary ? 'admin' : 'member',
      joinedAt: r.createdAt,
      postCount: r.user._count.chatMessages,
      muted: r.mutedFromCommunity,
      active: r.user.isActive,
    })));
  } catch (err) { next(err); }
};

export const setMemberMute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);
    const residentId = req.params.id as string;
    const { muted } = req.body;

    const resident = await prisma.resident.findUnique({ where: { id: residentId }, include: { unit: true } });
    if (!resident || resident.unit.propertyId !== propertyId) return next(new AppError('Member not found', 404));

    const updated = await prisma.resident.update({
      where: { id: residentId },
      data: { mutedFromCommunity: !!muted },
    });

    sendSuccess(res, 200, muted ? 'Member muted' : 'Member unmuted', { id: updated.id, muted: updated.mutedFromCommunity });
  } catch (err) { next(err); }
};

// In-memory fallback if Redis is unavailable
const memoryDmStore: Record<string, any[]> = {};
const memoryUserDmIndex: Record<string, Set<string>> = {};

function getDmKey(userA: string, userB: string) {
  const sorted = [userA, userB].sort();
  return `dm_thread:${sorted[0]}:${sorted[1]}`;
}

async function recordDmIndex(userA: string, userB: string) {
  if (!memoryUserDmIndex[userA]) memoryUserDmIndex[userA] = new Set();
  if (!memoryUserDmIndex[userB]) memoryUserDmIndex[userB] = new Set();
  memoryUserDmIndex[userA].add(userB);
  memoryUserDmIndex[userB].add(userA);

  try {
    const { redis } = await import('../../config/redis');
    await Promise.all([
      redis.sadd(`dm_partners:${userA}`, userB),
      redis.sadd(`dm_partners:${userB}`, userA),
    ]);
  } catch {
    // Redis unavailable
  }
}

export const getConversationsSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const [callerGuard, callerResident] = await Promise.all([
      prisma.guard.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
      prisma.resident.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
    ]);

    const callerAliases = Array.from(new Set([
      currentUserId,
      callerGuard?.userId,
      callerGuard?.id,
      callerResident?.userId,
      callerResident?.id,
    ].filter(Boolean) as string[]));

    let partnerIds: string[] = [];

    for (const alias of callerAliases) {
      try {
        const { redis } = await import('../../config/redis');
        const redisPartners = await redis.smembers(`dm_partners:${alias}`);
        const memoryPartners = memoryUserDmIndex[alias] ? Array.from(memoryUserDmIndex[alias]) : [];
        partnerIds.push(...redisPartners, ...memoryPartners);
      } catch {
        const memoryPartners = memoryUserDmIndex[alias] ? Array.from(memoryUserDmIndex[alias]) : [];
        partnerIds.push(...memoryPartners);
      }
    }

    // Also scan all keys in memoryDmStore and Redis for threads involving callerAliases
    for (const key of Object.keys(memoryDmStore)) {
      if (key.startsWith('dm_thread:')) {
        const parts = key.split(':');
        if (parts.length === 3) {
          const [, u1, u2] = parts;
          if (callerAliases.includes(u1)) partnerIds.push(u2);
          if (callerAliases.includes(u2)) partnerIds.push(u1);
        }
      }
    }

    try {
      const { redis } = await import('../../config/redis');
      const threadKeys = await redis.keys('dm_thread:*');
      for (const key of threadKeys) {
        const parts = key.split(':');
        if (parts.length === 3) {
          const [, u1, u2] = parts;
          if (callerAliases.includes(u1)) partnerIds.push(u2);
          if (callerAliases.includes(u2)) partnerIds.push(u1);
        }
      }
    } catch {
      // Redis keys scan fallback
    }

    partnerIds = Array.from(new Set(partnerIds.filter((p) => !callerAliases.includes(p))));

    const processedPartnerKeys = new Set<string>();
    const conversations: any[] = [];
    let totalUnreadCount = 0;

    for (const partnerId of partnerIds) {
      // Resolve partner identity info & aliases
      const [resident, guard, manager] = await Promise.all([
        prisma.resident.findFirst({
          where: { OR: [{ userId: partnerId }, { id: partnerId }] },
          include: { unit: true, user: true },
        }),
        prisma.guard.findFirst({
          where: { OR: [{ userId: partnerId }, { id: partnerId }] },
          include: { user: true },
        }),
        prisma.manager.findFirst({
          where: { OR: [{ userId: partnerId }, { id: partnerId }] },
          include: { user: true },
        }),
      ]);

      const partnerAliases = Array.from(new Set([
        partnerId,
        resident?.userId,
        resident?.id,
        guard?.userId,
        guard?.id,
        manager?.userId,
        manager?.id,
      ].filter(Boolean) as string[]));

      const dedupeKey = partnerAliases.sort().join('|');
      if (processedPartnerKeys.has(dedupeKey)) continue;
      processedPartnerKeys.add(dedupeKey);

      // Collect all messages across all callerAliases x partnerAliases
      const msgMap = new Map<string, any>();
      for (const cAlias of callerAliases) {
        for (const pAlias of partnerAliases) {
          const key = getDmKey(cAlias, pAlias);
          try {
            const { redis } = await import('../../config/redis');
            const raw = await redis.get(key);
            if (raw) {
              const list = JSON.parse(raw);
              list.forEach((m: any) => msgMap.set(m.id, m));
            } else if (memoryDmStore[key]?.length) {
              memoryDmStore[key].forEach((m: any) => msgMap.set(m.id, m));
            }
          } catch {
            if (memoryDmStore[key]?.length) {
              memoryDmStore[key].forEach((m: any) => msgMap.set(m.id, m));
            }
          }
        }
      }

      const messages = Array.from(msgMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        const unreadCount = messages.filter((m) => callerAliases.includes(m.recipientId) && !m.read).length;
        totalUnreadCount += unreadCount;

        let partnerName = 'Member';
        let partnerUnit: string | undefined = undefined;
        let partnerRole = 'RESIDENT';
        let partnerPhone: string | null = null;
        let finalPartnerUserId = partnerId;
        let finalPartnerMemberId = partnerId;

        if (resident) {
          partnerName = resident.name;
          partnerRole = resident.residentType || 'RESIDENT';
          partnerPhone = resident.user?.phone || resident.emergencyContact || null;
          finalPartnerUserId = resident.userId;
          finalPartnerMemberId = resident.id;
          if (resident.unit) {
            partnerUnit = `${resident.unit.tower ? `${resident.unit.tower} • ` : ''}Flat ${resident.unit.unitNumber}`;
          }
        } else if (guard) {
          partnerName = guard.name;
          partnerRole = 'GUARD';
          partnerUnit = 'Security Station';
          partnerPhone = guard.user?.phone || null;
          finalPartnerUserId = guard.userId;
          finalPartnerMemberId = guard.id;
        } else if (manager) {
          partnerName = manager.name;
          partnerRole = 'MANAGER';
          partnerUnit = 'Management Office';
          partnerPhone = manager.user?.phone || null;
          finalPartnerUserId = manager.userId;
          finalPartnerMemberId = manager.id;
        }

        conversations.push({
          partnerId: finalPartnerUserId || partnerId,
          partnerUserId: finalPartnerUserId,
          partnerMemberId: finalPartnerMemberId,
          partnerName,
          partnerUnit,
          partnerRole,
          partnerPhone,
          lastMessage: lastMsg,
          unreadCount,
        });
      }
    }

    // Sort by latest message timestamp descending
    conversations.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());

    sendSuccess(res, 200, 'Conversations summary retrieved', {
      conversations,
      totalUnreadCount,
    });
  } catch (err) { next(err); }
};

export const markDirectMessagesRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const rawPartnerId = req.params.partnerId as string;
    if (!rawPartnerId) return next(new AppError('Partner ID required', 400));

    const [callerGuard, callerResident, targetResident, targetGuard, targetManager] = await Promise.all([
      prisma.guard.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
      prisma.resident.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
      prisma.resident.findFirst({ where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] }, select: { id: true, userId: true } }),
      prisma.guard.findFirst({ where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] }, select: { id: true, userId: true } }),
      prisma.manager.findFirst({ where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] }, select: { id: true, userId: true } }),
    ]);

    const callerAliases = Array.from(new Set([
      currentUserId,
      callerGuard?.userId,
      callerGuard?.id,
      callerResident?.userId,
      callerResident?.id,
    ].filter(Boolean) as string[]));

    const partnerAliases = Array.from(new Set([
      rawPartnerId,
      targetResident?.userId,
      targetResident?.id,
      targetGuard?.userId,
      targetGuard?.id,
      targetManager?.userId,
      targetManager?.id,
    ].filter(Boolean) as string[]));

    let markedAny = false;

    for (const cAlias of callerAliases) {
      for (const pAlias of partnerAliases) {
        const key = getDmKey(cAlias, pAlias);
        let messages: any[] = [];
        let updated = false;

        try {
          const { redis } = await import('../../config/redis');
          const data = await redis.get(key);
          if (data) messages = JSON.parse(data);
          else messages = memoryDmStore[key] || [];

          messages = messages.map((m) => {
            if (callerAliases.includes(m.recipientId) && !m.read) {
              updated = true;
              markedAny = true;
              return { ...m, read: true, readAt: new Date().toISOString() };
            }
            return m;
          });

          if (updated) {
            await redis.setex(key, 86400 * 30, JSON.stringify(messages));
            memoryDmStore[key] = messages;
          }
        } catch {
          messages = (memoryDmStore[key] || []).map((m) => {
            if (callerAliases.includes(m.recipientId) && !m.read) {
              updated = true;
              markedAny = true;
              return { ...m, read: true, readAt: new Date().toISOString() };
            }
            return m;
          });
          if (updated) memoryDmStore[key] = messages;
        }
      }
    }

    if (markedAny) {
      partnerAliases.forEach((pAlias) => {
        io.to(`user:${pAlias}`).emit('dm:read', { partnerId: currentUserId, readerId: currentUserId });
      });
      callerAliases.forEach((cAlias) => {
        io.to(`user:${cAlias}`).emit('dm:read', { partnerId: rawPartnerId, readerId: currentUserId });
      });
    }

    sendSuccess(res, 200, 'Messages marked as read', { partnerId: rawPartnerId });
  } catch (err) { next(err); }
};

export const getDirectMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const rawPartnerId = req.params.partnerId as string;
    if (!rawPartnerId) return next(new AppError('Partner ID required', 400));

    const [callerGuard, callerResident, targetResident, targetGuard, targetManager] = await Promise.all([
      prisma.guard.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
      prisma.resident.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
      prisma.resident.findFirst({ where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] }, select: { id: true, userId: true } }),
      prisma.guard.findFirst({ where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] }, select: { id: true, userId: true } }),
      prisma.manager.findFirst({ where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] }, select: { id: true, userId: true } }),
    ]);

    const callerAliases = Array.from(new Set([
      currentUserId,
      callerGuard?.userId,
      callerGuard?.id,
      callerResident?.userId,
      callerResident?.id,
    ].filter(Boolean) as string[]));

    const partnerAliases = Array.from(new Set([
      rawPartnerId,
      targetResident?.userId,
      targetResident?.id,
      targetGuard?.userId,
      targetGuard?.id,
      targetManager?.userId,
      targetManager?.id,
    ].filter(Boolean) as string[]));

    const msgMap = new Map<string, any>();
    let markedAnyRead = false;

    for (const cAlias of callerAliases) {
      for (const pAlias of partnerAliases) {
        const key = getDmKey(cAlias, pAlias);
        let list: any[] = [];
        let keyUpdated = false;

        try {
          const { redis } = await import('../../config/redis');
          const data = await redis.get(key);
          if (data) list = JSON.parse(data);
          else list = memoryDmStore[key] || [];

          list = list.map((m) => {
            if (callerAliases.includes(m.recipientId) && !m.read) {
              markedAnyRead = true;
              keyUpdated = true;
              return { ...m, read: true, readAt: new Date().toISOString() };
            }
            return m;
          });

          if (keyUpdated) {
            await redis.setex(key, 86400 * 30, JSON.stringify(list));
            memoryDmStore[key] = list;
          }
        } catch {
          list = (memoryDmStore[key] || []).map((m) => {
            if (callerAliases.includes(m.recipientId) && !m.read) {
              markedAnyRead = true;
              keyUpdated = true;
              return { ...m, read: true, readAt: new Date().toISOString() };
            }
            return m;
          });
          if (keyUpdated) memoryDmStore[key] = list;
        }

        list.forEach((m) => msgMap.set(m.id, m));
      }
    }

    if (markedAnyRead) {
      partnerAliases.forEach((pAlias) => {
        io.to(`user:${pAlias}`).emit('dm:read', { partnerId: currentUserId, readerId: currentUserId });
      });
      callerAliases.forEach((cAlias) => {
        io.to(`user:${cAlias}`).emit('dm:read', { partnerId: rawPartnerId, readerId: currentUserId });
      });
    }

    const messages = Array.from(msgMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sendSuccess(res, 200, 'Direct messages retrieved', messages);
  } catch (err) { next(err); }
};

export const sendDirectMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const rawPartnerId = req.params.partnerId as string;
    if (!rawPartnerId) return next(new AppError('Partner ID required', 400));

    // Resolve partner User ID if residentId or guardId was provided
    let partnerId = rawPartnerId;
    const [targetResident, targetGuard] = await Promise.all([
      prisma.resident.findFirst({
        where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] },
        select: { id: true, userId: true },
      }),
      prisma.guard.findFirst({
        where: { OR: [{ id: rawPartnerId }, { userId: rawPartnerId }] },
        select: { id: true, userId: true },
      }),
    ]);

    if (targetResident?.userId) {
      partnerId = targetResident.userId;
    } else if (targetGuard?.userId) {
      partnerId = targetGuard.userId;
    }

    const { text, mediaType, mediaUri, fileName, fileSize, durationSec, replyToId, replyToText, replyToSender } = req.body;
    if (!text && !mediaUri) {
      return next(new AppError('Message text or attachment required', 400));
    }

    // Resolve sender identity for rich push / notification context
    let senderName = 'Resident';
    let senderUnit: string | undefined = undefined;

    const resident = await prisma.resident.findUnique({
      where: { userId: currentUserId },
      include: { unit: true },
    });

    if (resident) {
      senderName = resident.name;
      if (resident.unit) {
        senderUnit = `${resident.unit.tower ? `${resident.unit.tower} • ` : ''}Flat ${resident.unit.unitNumber}`;
      }
    } else {
      const guard = await prisma.guard.findUnique({
        where: { userId: currentUserId },
      });
      if (guard) {
        senderName = guard.name;
        senderUnit = 'Security Station';
      } else {
        const manager = await prisma.manager.findUnique({
          where: { userId: currentUserId },
        });
        if (manager) {
          senderName = manager.name;
          senderUnit = 'Management Office';
        }
      }
    }

    const hasValidReply = Boolean(replyToId && (replyToText || replyToSender));

    const newMsg = {
      id: `dm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: currentUserId,
      senderName,
      senderRole: req.user!.role,
      senderUnit,
      recipientId: partnerId,
      text: text ? String(text).trim() : undefined,
      mediaType: mediaType || undefined,
      mediaUri: mediaUri || undefined,
      fileName: fileName || undefined,
      fileSize: fileSize ? Number(fileSize) : undefined,
      durationSec: durationSec ? Number(durationSec) : undefined,
      replyToId: hasValidReply ? String(replyToId).trim() : undefined,
      replyToText: hasValidReply && replyToText ? String(replyToText).trim() : undefined,
      replyToSender: hasValidReply && replyToSender ? String(replyToSender).trim() : undefined,
      read: false,
      createdAt: new Date().toISOString(),
    };

    const key = getDmKey(currentUserId, partnerId);

    // Save message to Redis & in-memory cache
    try {
      const { redis } = await import('../../config/redis');
      const existingRaw = await redis.get(key);
      const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push(newMsg);
      // Keep last 300 messages per conversation
      const trimmed = existing.slice(-300);
      await redis.setex(key, 86400 * 30, JSON.stringify(trimmed));
      memoryDmStore[key] = trimmed;
    } catch {
      if (!memoryDmStore[key]) memoryDmStore[key] = [];
      memoryDmStore[key].push(newMsg);
      memoryDmStore[key] = memoryDmStore[key].slice(-300);
    }

    // Index this pair so conversations summary picks it up for all aliases
    const [callerGuard, callerResident] = await Promise.all([
      prisma.guard.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
      prisma.resident.findFirst({ where: { OR: [{ userId: currentUserId }, { id: currentUserId }] }, select: { id: true, userId: true } }),
    ]);
    const callerAliases = Array.from(new Set([
      currentUserId,
      callerGuard?.userId,
      callerGuard?.id,
      callerResident?.userId,
      callerResident?.id,
    ].filter(Boolean) as string[]));

    const partnerAliases = Array.from(new Set([
      rawPartnerId,
      partnerId,
      targetResident?.userId,
      targetResident?.id,
      targetGuard?.userId,
      targetGuard?.id,
    ].filter(Boolean) as string[]));

    for (const cAlias of callerAliases) {
      for (const pAlias of partnerAliases) {
        await recordDmIndex(cAlias, pAlias);
      }
    }

    // Real-time broadcast to recipient's personal room & sender's room
    partnerAliases.forEach((pId) => {
      io.to(`user:${pId}`).emit('dm:message', newMsg);
    });
    callerAliases.forEach((cId) => {
      io.to(`user:${cId}`).emit('dm:message', newMsg);
    });

    sendSuccess(res, 201, 'Direct message sent', newMsg);
  } catch (err) { next(err); }
};

export const deleteDirectMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const rawPartnerId = req.params.partnerId as string;
    const messageId = req.params.messageId as string;
    if (!rawPartnerId || !messageId) {
      return next(new AppError('Partner ID and Message ID required', 400));
    }

    let partnerId = rawPartnerId;
    const resident = await prisma.resident.findUnique({
      where: { id: rawPartnerId },
      select: { userId: true },
    });
    if (resident?.userId) {
      partnerId = resident.userId;
    } else {
      const guard = await prisma.guard.findUnique({
        where: { id: rawPartnerId },
        select: { userId: true },
      });
      if (guard?.userId) partnerId = guard.userId;
    }

    const key = getDmKey(currentUserId, partnerId);

    // Remove from Redis & memory
    try {
      const { redis } = await import('../../config/redis');
      const existingRaw = await redis.get(key);
      if (existingRaw) {
        let existing: any[] = JSON.parse(existingRaw);
        existing = existing.filter((m) => m.id !== messageId);
        await redis.setex(key, 86400 * 30, JSON.stringify(existing));
        memoryDmStore[key] = existing;
      }
    } catch {
      if (memoryDmStore[key]) {
        memoryDmStore[key] = memoryDmStore[key].filter((m) => m.id !== messageId);
      }
    }

    // Real-time broadcast deletion to both parties
    const deletePayload = { messageId, partnerId: currentUserId, deletedBy: currentUserId };
    io.to(`user:${partnerId}`).emit('dm:delete', deletePayload);
    io.to(`user:${currentUserId}`).emit('dm:delete', { messageId, partnerId, deletedBy: currentUserId });

    sendSuccess(res, 200, 'Direct message deleted', { messageId });
  } catch (err) { next(err); }
};
