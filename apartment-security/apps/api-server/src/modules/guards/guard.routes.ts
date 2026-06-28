import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  startShift,
  endShift,
  checkInPost
} from './guard.controller';
import {
  startShiftSchema,
  endShiftSchema,
  checkInPostSchema
} from './guard.schema';

const router = Router();
router.use(authenticate);

router.post('/shift/start', requireRole('GUARD'), validate(startShiftSchema), startShift);
router.post('/shift/end',   requireRole('GUARD'), validate(endShiftSchema), endShift);
router.post('/post/checkin', requireRole('GUARD'), validate(checkInPostSchema), checkInPost);

export { router as guardRouter };
