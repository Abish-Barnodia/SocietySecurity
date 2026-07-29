import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { getAllBroadcasts, createBroadcast } from './broadcast.controller';

const router = Router();

router.use(authenticate);

// Everyone can view broadcasts
router.get('/', getAllBroadcasts);

// Only managers/committee can create them
router.post('/', requireRole('MANAGER', 'COMMITTEE'), createBroadcast);

export { router as broadcastRouter };
