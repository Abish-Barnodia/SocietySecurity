import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  requestWalkin,
  respondWalkin,
  getPendingWalkins,
  callResident,
  getWalkin
} from './walkin.controller';
import {
  requestWalkinSchema,
  respondWalkinSchema
} from './walkin.schema';

const router = Router();
router.use(authenticate);

// Guard initiates walkin request
router.post('/request', requireRole('GUARD'), validate(requestWalkinSchema), requestWalkin);

// Get pending walkins (for Dashboard/Guard)
router.get('/pending', requireRole('MANAGER', 'COMMITTEE', 'GUARD'), requireManagerPermission('expected'), getPendingWalkins);

// Resident responds
router.post('/:id/respond', requireRole('RESIDENT'), validate(respondWalkinSchema), respondWalkin);

// Guard calls the resident after their approval window timed out
router.post('/:id/call-resident', requireRole('GUARD'), callResident);

// Resident fetches a single entry/walkin by entry id (for notification tap-through)
router.get('/:id', requireRole('RESIDENT'), getWalkin);

export { router as walkinRouter };
