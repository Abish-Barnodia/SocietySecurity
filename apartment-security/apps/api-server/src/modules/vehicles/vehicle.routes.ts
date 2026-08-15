import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  registerVehicle,
  checkVehicle,
  getParkingSummary,
  getVehicleLog,
  updateParkingCapacity,
  getParkingSlots
} from './vehicle.controller';
import {
  registerVehicleSchema,
  checkVehicleSchema,
  updateParkingCapacitySchema
} from './vehicle.schema';

const router = Router();
router.use(authenticate);

// Manager: parking occupancy dashboard + full vehicle entry/exit log
router.get('/parking/summary', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('parking'), getParkingSummary);
router.get('/parking/log', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('parking'), getVehicleLog);
router.get('/parking/slots', requireRole('MANAGER', 'COMMITTEE'), requireManagerPermission('parking'), getParkingSlots);
router.put('/parking/capacity', requireRole('MANAGER'), requireManagerPermission('parking'), validate(updateParkingCapacitySchema), updateParkingCapacity);

// Resident registers a vehicle
router.post('/', requireRole('RESIDENT'), validate(registerVehicleSchema), registerVehicle);

// Guard checks a vehicle
router.get('/:registrationNo', requireRole('GUARD'), validate(checkVehicleSchema), checkVehicle);

export { router as vehicleRouter };
