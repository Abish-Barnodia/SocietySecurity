import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  startShift,
  endShift,
  checkInPost,
  getDirectory,
  getActiveGuards,
  createGuard,
  getGuardProfile
} from './guard.controller';
import {
  startShiftSchema,
  endShiftSchema,
  checkInPostSchema,
  createGuardSchema
} from './guard.schema';

const router = Router();
router.use(authenticate);

router.post('/shift/start', requireRole('GUARD'), validate(startShiftSchema), startShift);
router.post('/shift/end',   requireRole('GUARD'), validate(endShiftSchema), endShift);
router.post('/post/checkin', requireRole('GUARD'), validate(checkInPostSchema), checkInPost);

router.get('/directory', requireRole('MANAGER', 'COMMITTEE'), getDirectory);
router.get('/active', requireRole('MANAGER', 'COMMITTEE'), getActiveGuards);

router.post('/', requireRole('MANAGER', 'COMMITTEE'), validate(createGuardSchema), createGuard);
router.get('/:id/profile', requireRole('MANAGER', 'COMMITTEE'), getGuardProfile);

export { router as guardRouter };
