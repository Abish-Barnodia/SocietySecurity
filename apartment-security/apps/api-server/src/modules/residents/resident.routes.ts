import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  getMyProfile,
  updateMyProfile,
  getUnitResidents,
  addHouseholdMember,
  removeHouseholdMember,
  updateAlertPreferences,
  getAllResidents,
  onboardResident,
  deactivateResident,
  getUnitSummary,
} from './resident.controller';
import {
  onboardResidentSchema,
  updateProfileSchema,
  alertPreferencesSchema,
} from './resident.schema';

const router = Router();

router.use(authenticate);

// Resident self-service
router.get('/me',            requireRole('RESIDENT'), getMyProfile);
router.put('/me',            requireRole('RESIDENT'), validate(updateProfileSchema), updateMyProfile);
router.put('/me/alerts',     requireRole('RESIDENT'), validate(alertPreferencesSchema), updateAlertPreferences);
router.get('/unit',          requireRole('RESIDENT'), getUnitResidents);
router.post('/unit/members', requireRole('RESIDENT'), addHouseholdMember);
router.delete('/unit/members/:memberId', requireRole('RESIDENT'), removeHouseholdMember);

// Manager operations
router.get('/',              requireRole('MANAGER', 'COMMITTEE'), getAllResidents);
router.post('/',             requireRole('MANAGER'), validate(onboardResidentSchema), onboardResident);
router.delete('/:id',        requireRole('MANAGER'), deactivateResident);
router.get('/:id/summary',   requireRole('MANAGER', 'COMMITTEE'), getUnitSummary);

export { router as residentRouter };
