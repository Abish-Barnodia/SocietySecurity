import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import { getFundSummary, addFundTransaction } from './fund.controller';

const router = Router();
router.use(authenticate);

// Resident and management can view
router.get('/summary', requireRole('RESIDENT', 'MANAGER', 'COMMITTEE'), requireManagerPermission('funds'), getFundSummary);

// Only manager/committee can add transactions
router.post('/transactions', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('funds'), addFundTransaction);

export { router as fundRouter };
