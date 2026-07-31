import { z } from 'zod';

export const createMessageSchema = z.object({
  body: z.object({
    type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'POLL']),
    body: z.string().max(4000).optional(),
    mediaUrl: z.string().url().optional(),
    mediaMimeType: z.string().optional(),
    mediaDurationSec: z.number().int().positive().optional(),
    fileName: z.string().optional(),
    fileSizeBytes: z.number().int().positive().optional(),
    replyToId: z.string().optional(),
    mentionedUserIds: z.array(z.string()).optional(),
    poll: z.object({
      question: z.string().min(1).max(300),
      allowMultiple: z.boolean().optional(),
      options: z.array(z.string().min(1).max(120)).min(2).max(10),
    }).optional(),
  }),
});

export const reactionSchema = z.object({
  body: z.object({
    emoji: z.string().min(1).max(8),
  }),
});

export const voteSchema = z.object({
  body: z.object({
    optionId: z.string(),
  }),
});

export const reportSchema = z.object({
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
});

export const muteSchema = z.object({
  body: z.object({
    muted: z.boolean(),
  }),
});
