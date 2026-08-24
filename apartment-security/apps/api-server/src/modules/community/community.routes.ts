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
  uploadMedia,
  deleteMessage,
  reportMessage,
  listReports,
  dismissReport,
  resolveReport,
  listMembersForManager,
  setMemberMute,
} from './community.controller';
import { createMessageSchema, reactionSchema, voteSchema, reportSchema, muteSchema } from './community.schema';

const router = Router();
router.use(authenticate);
router.use(requireManagerPermission('community'));

// Resident + Manager: participate in the chat
router.post('/messages', requireRole('RESIDENT', 'MANAGER'), validate(createMessageSchema), createMessage);
router.post('/messages/:id/reactions', requireRole('RESIDENT'), validate(reactionSchema), toggleReaction);
router.post('/messages/:id/report', requireRole('RESIDENT'), validate(reportSchema), reportMessage);
router.post('/polls/:pollId/vote', requireRole('RESIDENT'), validate(voteSchema), votePoll);
router.get('/search', requireRole('RESIDENT'), searchMessages);
router.get('/members', requireRole('RESIDENT'), listMembers);
router.post('/uploads', requireRole('RESIDENT', 'MANAGER'), upload.single('file'), uploadMedia);

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
