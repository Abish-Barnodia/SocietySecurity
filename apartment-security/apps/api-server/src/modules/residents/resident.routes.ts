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
  getFamilyDetails,
  onboardResident,
  onboardHousehold,
  updateHousehold,
  onboardSelf,
  getTowers,
  getUnitsByTower,
  deactivateResident,
  getUnitSummary,
} from './resident.controller';
import {
  onboardResidentSchema,
  onboardHouseholdSchema,
  onboardSelfSchema,
  updateProfileSchema,
  alertPreferencesSchema,
  updateHouseholdSchema,
} from './resident.schema';

const router = Router();

router.use(authenticate);

// Resident self-service
router.get('/towers',        getTowers);
router.get('/units',         getUnitsByTower);
router.post('/me/onboard',   requireRole('RESIDENT'), validate(onboardSelfSchema), onboardSelf);
router.get('/me',            requireRole('RESIDENT'), getMyProfile);
router.put('/me',            requireRole('RESIDENT'), validate(updateProfileSchema), updateMyProfile);
router.put('/me/alerts',     requireRole('RESIDENT'), validate(alertPreferencesSchema), updateAlertPreferences);
router.get('/unit',          requireRole('RESIDENT'), getUnitResidents);
router.post('/unit/members', requireRole('RESIDENT'), addHouseholdMember);
router.delete('/unit/members/:memberId', requireRole('RESIDENT'), removeHouseholdMember);

// Manager operations
router.get('/',                    requireRole('MANAGER', 'COMMITTEE'), getAllResidents);
router.get('/families/:unitId',    requireRole('MANAGER', 'COMMITTEE'), getFamilyDetails);
router.post('/',                   requireRole('MANAGER'), validate(onboardResidentSchema), onboardResident);
router.post('/household',          requireRole('MANAGER'), validate(onboardHouseholdSchema), onboardHousehold);
router.put('/families/:unitId',    requireRole('MANAGER'), validate(updateHouseholdSchema), updateHousehold);
router.delete('/:id',              requireRole('MANAGER'), deactivateResident);
router.get('/:id/summary',         requireRole('MANAGER', 'COMMITTEE'), getUnitSummary);

export { router as residentRouter };
