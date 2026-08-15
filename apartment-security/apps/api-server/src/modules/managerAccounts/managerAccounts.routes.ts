import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  listManagers,
  createManager,
  updateManager,
  resetManagerPassword,
  activateManager,
  deactivateManager,
  forceLogoutActiveManager,
} from './managerAccounts.controller';
import { createManagerSchema, updateManagerSchema, resetManagerPasswordSchema } from './managerAccounts.schema';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER'));
router.use(requireManagerPermission('settings'));

router.get('/', listManagers);
router.post('/', validate(createManagerSchema), createManager);
router.put('/:id', validate(updateManagerSchema), updateManager);
router.post('/:id/reset-password', validate(resetManagerPasswordSchema), resetManagerPassword);
router.post('/:id/activate', activateManager);
router.post('/:id/deactivate', deactivateManager);
router.post('/force-logout', forceLogoutActiveManager);

export { router as managerAccountsRouter };
