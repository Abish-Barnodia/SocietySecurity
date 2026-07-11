import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createPass,
  getMyPasses,
  suspendPass,
  revokePass,
  getAllPasses,
  deletePass,
  verifyPass
} from './pass.controller';
import { createPassSchema } from './pass.schema';

const router = Router();
router.use(authenticate);

router.post('/',           requireRole('RESIDENT'), validate(createPassSchema), createPass);
router.get('/',            requireRole('RESIDENT'), getMyPasses);
router.put('/:id/suspend', requireRole('RESIDENT'), suspendPass);
router.put('/:id/revoke',  requireRole('RESIDENT', 'MANAGER'), revokePass);
router.delete('/:id',      requireRole('RESIDENT'), deletePass);

// Manager / Committee
router.get('/all',         requireRole('MANAGER', 'COMMITTEE'), getAllPasses);

// Guard
router.get('/verify/:id',  requireRole('GUARD', 'MANAGER'), verifyPass);

export { router as passRouter };
