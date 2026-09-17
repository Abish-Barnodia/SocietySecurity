import { Router } from 'express';
import {
  getPlatformStats,
  getSocieties,
  getSocietyById,
  createSociety,
  updateSocietyStatus,
  updateSociety,
  getAllManagers,
  getAuditLogs,
  getSubscriptionPlans,
  getPlatformSettings,
  updatePlatformSettings,
} from './superAdmin.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/stats', getPlatformStats);
router.get('/societies', getSocieties);
router.post('/societies', createSociety);
router.get('/societies/:id', getSocietyById);
router.patch('/societies/:id/status', updateSocietyStatus);
router.patch('/societies/:id', updateSociety);
router.get('/managers', getAllManagers);
router.get('/audit-logs', getAuditLogs);
router.get('/subscription-plans', getSubscriptionPlans);
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSettings);

export default router;
