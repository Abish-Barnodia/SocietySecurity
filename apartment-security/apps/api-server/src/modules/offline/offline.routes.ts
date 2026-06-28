import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  syncOfflineEntries,
  getPassCache
} from './offline.controller';
import {
  syncOfflineEntriesSchema
} from './offline.schema';

const router = Router();
router.use(authenticate);

// Guards can sync offline entries
router.post('/sync', requireRole('GUARD'), validate(syncOfflineEntriesSchema), syncOfflineEntries);

// Guards can pull down offline passes cache
router.get('/cache', requireRole('GUARD'), getPassCache);

export { router as offlineRouter };
