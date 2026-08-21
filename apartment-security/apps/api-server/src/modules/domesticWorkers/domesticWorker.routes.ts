import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { upload } from '../../middlewares/upload.middleware';
import {
  listWorkers,
  createWorker,
  getWorker,
  updateWorker,
  deleteWorker,
  uploadWorkerPhoto,
  listWorkersForGuard,
  logWorkerEntry,
} from './domesticWorker.controller';
import { createWorkerSchema, updateWorkerSchema, logWorkerEntrySchema } from './domesticWorker.schema';

const router = Router();
router.use(authenticate);

// Guard-facing: look up a unit's registered staff and clear one in directly.
router.get('/unit/:unitId', requireRole('GUARD'), listWorkersForGuard);
router.post('/entries', requireRole('GUARD'), validate(logWorkerEntrySchema), logWorkerEntry);

// Resident-facing CRUD for registering staff.
router.use(requireRole('RESIDENT'));
router.get('/', listWorkers);
router.post('/', validate(createWorkerSchema), createWorker);
router.post('/uploads', upload.single('file'), uploadWorkerPhoto);
router.get('/:id', getWorker);
router.put('/:id', validate(updateWorkerSchema), updateWorker);
router.delete('/:id', deleteWorker);

export { router as domesticWorkerRouter };
