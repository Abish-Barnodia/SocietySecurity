import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  getOperationsOverview,
  generateMonthlyReport
} from './report.controller';

const router = Router();
router.use(authenticate);

// Managers and Committee can view operations overview
router.get('/overview', requireRole('MANAGER', 'COMMITTEE'), getOperationsOverview);

// Managers can generate monthly reports
router.get('/monthly', requireRole('MANAGER'), generateMonthlyReport);

export { router as reportRouter };
