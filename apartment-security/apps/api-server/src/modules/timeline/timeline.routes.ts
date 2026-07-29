import { Router } from 'express';
import { getTimelineEvents } from './timeline.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getTimelineEvents);

export default router;
