import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  broadcastAlert,
  triggerDuress,
  getAlerts
} from './alert.controller';
import {
  createAlertSchema,
  triggerDuressSchema
} from './alert.schema';

const router = Router();
router.use(authenticate);

// Manager / Committee / Guard broadcasts an alert
router.post('/broadcast', requireRole('MANAGER', 'COMMITTEE', 'GUARD'), validate(createAlertSchema), broadcastAlert);

// Anyone can trigger a silent duress alert
router.post('/duress', validate(triggerDuressSchema), triggerDuress);

// Anyone can fetch their relevant alerts
router.get('/', getAlerts);

export { router as alertRouter };
