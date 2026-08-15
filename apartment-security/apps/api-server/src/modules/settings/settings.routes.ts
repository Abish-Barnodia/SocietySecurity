import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import { getSettings, updateSettings, getRoleSummary } from './settings.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER', 'COMMITTEE'));
router.use(requireManagerPermission('settings'));

router.get('/', getSettings);
router.put('/', updateSettings);
router.get('/role-summary', getRoleSummary);

export { router as settingsRouter };
