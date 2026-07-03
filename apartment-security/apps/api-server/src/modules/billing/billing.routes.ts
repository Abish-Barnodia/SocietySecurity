import { Router } from 'express';

const router = Router();

// Mock endpoints for billing/invoices
router.get('/invoices', (req, res) => {
  res.json({ message: "List of invoices" });
});

router.post('/invoices', (req, res) => {
  res.json({ message: "Invoice created" });
});

export default router;
