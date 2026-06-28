import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createPass,
  getMyPasses,
  suspendPass,
  revokePass,
  getAllPasses
} from './pass.controller';
import { createPassSchema } from './pass.schema';

const router = Router();
router.use(authenticate);

router.post('/',           requireRole('RESIDENT'), validate(createPassSchema), createPass);
router.get('/',            requireRole('RESIDENT'), getMyPasses);
router.put('/:id/suspend', requireRole('RESIDENT'), suspendPass);
router.put('/:id/revoke',  requireRole('RESIDENT', 'MANAGER'), revokePass);

// Manager / Committee
router.get('/all',         requireRole('MANAGER', 'COMMITTEE'), getAllPasses);

export { router as passRouter };
