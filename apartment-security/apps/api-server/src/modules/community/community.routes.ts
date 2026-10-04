import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { upload } from '../../middlewares/upload.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import {
  listMessages,
  createMessage,
  toggleReaction,
  votePoll,
  searchMessages,
  listMembers,
  getCommunityDirectoryHub,
  uploadMedia,
  deleteMessage,
  reportMessage,
  listReports,
  dismissReport,
  resolveReport,
  listMembersForManager,
  setMemberMute,
  getDirectMessages,
  sendDirectMessage,
  deleteDirectMessage,
  getConversationsSummary,
  markDirectMessagesRead,
} from './community.controller';
import { createMessageSchema, reactionSchema, voteSchema, reportSchema, muteSchema } from './community.schema';

const router = Router();
router.use(authenticate);
router.use(requireManagerPermission('community'));

// Resident + Guard + Manager: 1-on-1 Direct Messaging
router.get('/dm/summary/conversations', requireRole('RESIDENT', 'MANAGER', 'GUARD'), getConversationsSummary);
router.post('/dm/:partnerId/read', requireRole('RESIDENT', 'MANAGER', 'GUARD'), markDirectMessagesRead);
router.get('/dm/:partnerId', requireRole('RESIDENT', 'MANAGER', 'GUARD'), getDirectMessages);
router.post('/dm/:partnerId', requireRole('RESIDENT', 'MANAGER', 'GUARD'), sendDirectMessage);
router.delete('/dm/:partnerId/:messageId', requireRole('RESIDENT', 'MANAGER', 'GUARD'), deleteDirectMessage);

// Resident + Manager: participate in the chat
router.post('/messages', requireRole('RESIDENT', 'MANAGER'), validate(createMessageSchema), createMessage);
router.post('/messages/:id/reactions', requireRole('RESIDENT', 'MANAGER'), validate(reactionSchema), toggleReaction);
router.post('/messages/:id/report', requireRole('RESIDENT'), validate(reportSchema), reportMessage);
router.post('/polls/:pollId/vote', requireRole('RESIDENT'), validate(voteSchema), votePoll);
router.get('/search', requireRole('RESIDENT'), searchMessages);
router.get('/members', requireRole('RESIDENT', 'MANAGER', 'GUARD'), listMembers);
router.get('/hub', requireRole('RESIDENT', 'MANAGER', 'GUARD'), getCommunityDirectoryHub);
router.post('/uploads', requireRole('RESIDENT', 'MANAGER', 'GUARD'), upload.single('file'), uploadMedia);

// Resident + Manager: read the feed, moderate messages
router.get('/messages', requireRole('RESIDENT', 'MANAGER'), listMessages);
router.delete('/messages/:id', requireRole('RESIDENT', 'MANAGER'), deleteMessage);

// Manager-only: moderation queue + member roster
router.get('/reports', requireRole('MANAGER'), listReports);
router.post('/reports/:id/dismiss', requireRole('MANAGER'), dismissReport);
router.post('/reports/:id/resolve', requireRole('MANAGER'), resolveReport);
router.get('/members/manage', requireRole('MANAGER'), listMembersForManager);
router.put('/members/:id/mute', requireRole('MANAGER'), validate(muteSchema), setMemberMute);

export { router as communityRouter };
