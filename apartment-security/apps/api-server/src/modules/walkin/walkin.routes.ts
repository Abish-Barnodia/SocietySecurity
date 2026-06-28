import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  requestWalkin,
  respondWalkin
} from './walkin.controller';
import {
  requestWalkinSchema,
  respondWalkinSchema
} from './walkin.schema';

const router = Router();
router.use(authenticate);

// Guard initiates walkin request
router.post('/request', requireRole('GUARD'), validate(requestWalkinSchema), requestWalkin);

// Resident responds
router.post('/:id/respond', requireRole('RESIDENT'), validate(respondWalkinSchema), respondWalkin);

export { router as walkinRouter };
