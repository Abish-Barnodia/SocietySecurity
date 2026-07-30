import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  broadcastAlert,
  triggerDuress,
  getAlerts,
  acknowledgeAlertRoute,
  broadcastVehicleAlert,
  claimVehicleAlert
} from './alert.controller';
import {
  createAlertSchema,
  triggerDuressSchema,
  vehicleAlertSchema
} from './alert.schema';

const router = Router();
router.use(authenticate);

// Manager / Committee / Guard broadcasts an alert
router.post('/broadcast', requireRole('MANAGER', 'COMMITTEE', 'GUARD'), validate(createAlertSchema), broadcastAlert);

// Anyone can trigger a silent duress alert
router.post('/duress', validate(triggerDuressSchema), triggerDuress);

// Anyone can fetch their relevant alerts
router.get('/', getAlerts);

// Anyone can acknowledge an alert addressed to them (scoped to their property)
router.put('/:id/acknowledge', acknowledgeAlertRoute);

// Guard broadcasts an unknown vehicle to all residents, with photo
router.post('/vehicle', requireRole('GUARD'), validate(vehicleAlertSchema), broadcastVehicleAlert);

// Resident claims an unknown vehicle as their own
router.post('/:id/claim', requireRole('RESIDENT'), claimVehicleAlert);

export { router as alertRouter };
