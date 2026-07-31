import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  getOperationsOverview,
  generateMonthlyReport,
  getMonthlyReportSummary,
  getComplianceMetrics,
  getAuditLogs
} from './report.controller';

const router = Router();
router.use(authenticate);

// Managers and Committee can view operations overview
router.get('/overview', requireRole('MANAGER', 'COMMITTEE'), getOperationsOverview);

// Managers can generate monthly reports
router.get('/monthly', requireRole('MANAGER'), generateMonthlyReport);
router.get('/monthly/summary', requireRole('MANAGER', 'COMMITTEE'), getMonthlyReportSummary);

// Managers / Committee can view compliance metrics
router.get('/compliance', requireRole('MANAGER', 'COMMITTEE'), getComplianceMetrics);

// Managers / Committee can view audit logs
router.get('/audit', requireRole('MANAGER', 'COMMITTEE'), getAuditLogs);

export { router as reportRouter };
