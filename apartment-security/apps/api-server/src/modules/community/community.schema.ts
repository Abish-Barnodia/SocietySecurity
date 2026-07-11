import { z } from 'zod';

export const getMessagesSchema = z.object({
  query: z.object({
    limit: z.string().optional().transform(val => (val ? parseInt(val) : 50)),
    cursor: z.string().optional(),
  }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Message cannot be empty').max(1000, 'Message too long').optional(),
    type: z.enum(['TEXT', 'POLL', 'ALERT']).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    replyToId: z.string().optional(),
  }),
});

export const votePollSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    optionId: z.string().min(1),
  }),
});

export const reactMessageSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({ reaction: z.string() }),
});

export const editMessageSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({ content: z.string().min(1) }),
});

export const pinMessageSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({ isPinned: z.boolean() }),
});
