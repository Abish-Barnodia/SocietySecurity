import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { upload } from '../../middlewares/upload.middleware';
import {
  listComplaints,
  createComplaint,
  getComplaint,
  updateComplaintStatus,
  assignComplaint,
  uploadComplaintAttachment,
} from './complaint.controller';
import { createComplaintSchema, updateStatusSchema, assignComplaintSchema } from './complaint.schema';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('RESIDENT', 'MANAGER', 'COMMITTEE'), listComplaints);
router.post('/', requireRole('RESIDENT'), validate(createComplaintSchema), createComplaint);
router.post('/uploads', requireRole('RESIDENT'), upload.single('file'), uploadComplaintAttachment);
router.get('/:id', requireRole('RESIDENT', 'MANAGER', 'COMMITTEE'), getComplaint);
router.post('/:id/status', requireRole('MANAGER', 'COMMITTEE'), validate(updateStatusSchema), updateComplaintStatus);
router.post('/:id/assign', requireRole('MANAGER', 'COMMITTEE'), validate(assignComplaintSchema), assignComplaint);

export { router as complaintRouter };
