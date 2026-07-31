import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { getEscalationChains } from './escalation.controller';

const router = Router();
router.use(authenticate);

router.get('/chains', requireRole('MANAGER', 'COMMITTEE'), getEscalationChains);

export { router as escalationRouter };
