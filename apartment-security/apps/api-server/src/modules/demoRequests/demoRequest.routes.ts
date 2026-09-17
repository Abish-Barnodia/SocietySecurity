import { Router } from 'express';
import {
  createDemoRequest,
  createDemoPaymentOrder,
  verifyDemoPaymentAndSubmit,
  getDemoRequests,
  updateDemoRequestStatus,
  approveAndProvision,
} from './demoRequest.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createDemoRequestSchema,
  updateDemoRequestStatusSchema,
  approveAndProvisionSchema,
} from './demoRequest.validation';

const router = Router();

// Public routes for 1-month demo trial & payment from landing page
router.post('/create-order', createDemoPaymentOrder);
router.post('/verify-and-submit', verifyDemoPaymentAndSubmit);
router.post('/', validate(createDemoRequestSchema), createDemoRequest);

// Super Admin protected routes
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/', getDemoRequests);
router.patch('/:id/status', validate(updateDemoRequestStatusSchema), updateDemoRequestStatus);
router.post('/:id/approve', validate(approveAndProvisionSchema), approveAndProvision);

export default router;
