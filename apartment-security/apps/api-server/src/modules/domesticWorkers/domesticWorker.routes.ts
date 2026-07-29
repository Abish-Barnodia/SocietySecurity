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
} from './domesticWorker.controller';
import { createWorkerSchema, updateWorkerSchema } from './domesticWorker.schema';

const router = Router();
router.use(authenticate);
router.use(requireRole('RESIDENT'));

router.get('/', listWorkers);
router.post('/', validate(createWorkerSchema), createWorker);
router.post('/uploads', upload.single('file'), uploadWorkerPhoto);
router.get('/:id', getWorker);
router.put('/:id', validate(updateWorkerSchema), updateWorker);
router.delete('/:id', deleteWorker);

export { router as domesticWorkerRouter };
