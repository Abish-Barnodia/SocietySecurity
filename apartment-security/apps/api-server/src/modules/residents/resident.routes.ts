import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
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
  deleteFamily,
  restoreFamily,
  shareResidentCredential,
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
router.get('/',                    requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('residents'), getAllResidents);
router.get('/families/:unitId',    requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('residents'), getFamilyDetails);
router.post('/',                   requireRole('MANAGER'), requireManagerPermission('residents'), validate(onboardResidentSchema), onboardResident);
router.post('/household',          requireRole('MANAGER'), requireManagerPermission('residents'), validate(onboardHouseholdSchema), onboardHousehold);
router.put('/families/:unitId',    requireRole('MANAGER'), requireManagerPermission('residents'), validate(updateHouseholdSchema), updateHousehold);
router.delete('/:id',              requireRole('MANAGER'), requireManagerPermission('residents'), deactivateResident);
router.delete('/families/:unitId', requireRole('MANAGER'), requireManagerPermission('residents'), deleteFamily);
router.post('/families/:unitId/restore', requireRole('MANAGER'), requireManagerPermission('residents'), restoreFamily);
router.post('/:id/credential-share', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('residents'), shareResidentCredential);
router.get('/:id/summary',         requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('residents'), getUnitSummary);

export { router as residentRouter };
