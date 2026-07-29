import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { upload } from '../../middlewares/upload.middleware';
import {
  listMessages,
  createMessage,
  toggleReaction,
  votePoll,
  searchMessages,
  listMembers,
  uploadMedia,
  deleteMessage,
} from './community.controller';
import { createMessageSchema, reactionSchema, voteSchema } from './community.schema';

const router = Router();
router.use(authenticate);
router.use(requireRole('RESIDENT'));

router.get('/messages', listMessages);
router.post('/messages', validate(createMessageSchema), createMessage);
router.delete('/messages/:id', deleteMessage);
router.post('/messages/:id/reactions', validate(reactionSchema), toggleReaction);
router.post('/polls/:pollId/vote', validate(voteSchema), votePoll);
router.get('/search', searchMessages);
router.get('/members', listMembers);
router.post('/uploads', upload.single('file'), uploadMedia);

export { router as communityRouter };
