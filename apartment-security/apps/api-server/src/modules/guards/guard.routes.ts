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
  getGuardProfile,
  getShiftSummary,
  getRoster,
  getMyProfile,
  assignGuardToPost,
  createLeave,
  getLeaves,
  cancelLeave,
  getSalarySlip,
  createSalaryOrder,
  verifySalaryPayment,
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
router.get('/shift/summary', requireRole('GUARD'), getShiftSummary);
router.post('/post/checkin', requireRole('GUARD'), validate(checkInPostSchema), checkInPost);

router.get('/roster', requireRole('GUARD'), getRoster);
router.get('/me', requireRole('GUARD'), getMyProfile);

router.get('/directory', requireRole('MANAGER', 'COMMITTEE'), getDirectory);
router.get('/active', requireRole('MANAGER', 'COMMITTEE'), getActiveGuards);

// Leave management (manager only)
router.get('/leaves',              requireRole('MANAGER', 'COMMITTEE'), getLeaves);
router.post('/leaves',             requireRole('MANAGER', 'COMMITTEE'), createLeave);
router.patch('/leaves/:id/cancel', requireRole('MANAGER', 'COMMITTEE'), cancelLeave);

// Salary management (manager only)
router.get('/salary/:id/create-order', requireRole('MANAGER', 'COMMITTEE'), createSalaryOrder);
router.post('/salary/:id/verify',      requireRole('MANAGER', 'COMMITTEE'), verifySalaryPayment);

router.post('/', requireRole('MANAGER', 'COMMITTEE'), validate(createGuardSchema), createGuard);
router.post('/:id/assign',   requireRole('MANAGER', 'COMMITTEE'), assignGuardToPost);
router.get('/:id/salary',    requireRole('MANAGER', 'COMMITTEE'), getSalarySlip);
router.get('/:id/profile',   requireRole('MANAGER', 'COMMITTEE'), getGuardProfile);

export { router as guardRouter };
