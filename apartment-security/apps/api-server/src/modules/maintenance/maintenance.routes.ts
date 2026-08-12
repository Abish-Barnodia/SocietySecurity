import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  getMyInvoices,
  getAllInvoices,
  createPaymentOrder,
  verifyPayment,
  cancelPaymentOrder,
  createInvoice,
} from './maintenance.controller';

const router = Router();
router.use(authenticate);

// Resident routes
router.get('/invoices', requireRole('RESIDENT'), getMyInvoices);
router.post('/invoices/:id/order', requireRole('RESIDENT'), createPaymentOrder);
router.post('/invoices/:id/verify', requireRole('RESIDENT'), verifyPayment);
router.post('/invoices/:id/cancel', requireRole('RESIDENT'), cancelPaymentOrder);

// Manager routes
router.get('/invoices/all', requireRole('MANAGER', 'COMMITTEE'), getAllInvoices);
router.post('/invoices', requireRole('MANAGER'), createInvoice);

export { router as maintenanceRouter };
