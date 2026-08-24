import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  startShift,
  endShift,
  checkInPost,
  getDirectory,
  getActiveGuards,
  createGuard,
  updateGuard,
  deleteGuard,
  getGuardProfile,
  getShiftSummary,
  getRoster,
  getMyProfile,
  assignGuardToPost,
  createLeave,
  getLeaves,
  cancelLeave,
  getSalarySlip,
  listSalaries,
  createSalaryOrder,
  verifySalaryPayment,
} from './guard.controller';
import {
  startShiftSchema,
  endShiftSchema,
  checkInPostSchema,
  createGuardSchema,
  updateGuardSchema
} from './guard.schema';

const router = Router();
router.use(authenticate);

router.post('/shift/start', requireRole('GUARD'), validate(startShiftSchema), startShift);
router.post('/shift/end',   requireRole('GUARD'), validate(endShiftSchema), endShift);
router.get('/shift/summary', requireRole('GUARD'), getShiftSummary);
router.post('/post/checkin', requireRole('GUARD'), validate(checkInPostSchema), checkInPost);

router.get('/roster', requireRole('GUARD'), getRoster);
router.get('/me', requireRole('GUARD'), getMyProfile);

router.get('/directory', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('guards'), getDirectory);
router.get('/active', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('guards'), getActiveGuards);

// Leave management (manager only) — surfaced on the Workforce Mgmt page
router.get('/leaves',              requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('workforce'), getLeaves);
router.post('/leaves',             requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('workforce'), createLeave);
router.patch('/leaves/:id/cancel', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('workforce'), cancelLeave);

// Salary management (manager only) — also Workforce Mgmt
router.get('/salaries',                 requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('workforce'), listSalaries);
router.post('/salary/:id/create-order', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('workforce'), createSalaryOrder);
router.post('/salary/:id/verify',      requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('workforce'), verifySalaryPayment);

router.post('/', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('guards'), validate(createGuardSchema), createGuard);
router.post('/:id/assign',   requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('guards'), assignGuardToPost);
router.put('/:id',           requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('guards'), validate(updateGuardSchema), updateGuard);
router.delete('/:id',        requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('guards'), deleteGuard);
router.get('/:id/salary',    requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('workforce'), getSalarySlip);
router.get('/:id/profile',   requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('guards'), getGuardProfile);

export { router as guardRouter };
